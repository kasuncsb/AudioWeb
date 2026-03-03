import { useState, useCallback } from 'react';
import React from 'react';
import { AudioTrack, LyricLine } from '../types';
// Dynamically imported on first use to reduce initial bundle size
let musicMetadataModule: typeof import('music-metadata-browser') | null = null;
const getMusicMetadata = async () => {
  if (!musicMetadataModule) {
    musicMetadataModule = await import('music-metadata-browser');
  }
  return musicMetadataModule;
};
import { createLogger } from '@/utils/logger';
import { 
  isAudioFile, 
  isLyricsFile, 
  getAudioFormat, 
  isLosslessFormat,
  createObjectURL,
  formatBitrate,
  formatSampleRate,
  getQualityDescription,
  sanitizeFilename,
  extractTrackNumber,
} from '@/utils/audioUtils';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, PERFORMANCE } from '@/config/constants';
import {
  buildCacheKey,
  cacheTracksBatch,
  CacheTrackInput,
} from '@/utils/cacheManager';

const logger = createLogger('FileHandler');

// Parse LRC format lyrics with timing information
const parseLrcFormat = (lrcContent: string): LyricLine[] => {
  const startTime = performance.now();
  
  // Remove language prefix if present (e.g., "eng||" or "eng:")
  const content = lrcContent.replace(/^[a-z]{2,3}(\|\||:)/i, '').trim();
  
  const lines = content.split('\n');
  const lyrics: LyricLine[] = [];
  
  for (let line of lines) {
    line = line.trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Remove language prefix like "eng||" from individual lines too
    line = line.replace(/^[a-z]{2,3}(\|\||:)/i, '');
    
    // Skip metadata lines like [ar:Artist], [ti:Title], etc.
    if (line.match(/^\[(ar|al|ti|length|offset|by|tool|ve|re):/i)) {
      continue;
    }
    
    // Extract lyrics text from timestamp lines - handle various timestamp formats
    const timestampMatch = line.match(/^\[(\d{1,2}):(\d{2})\.(\d{2})\]\s*(.*)$/) || 
                          line.match(/^\[(\d{1,2}):(\d{2}):(\d{2})\]\s*(.*)$/) ||
                          line.match(/^\[(\d{1,2}):(\d{2})\]\s*(.*)$/);
    
    if (timestampMatch) {
      const minutes = parseInt(timestampMatch[1]);
      const seconds = parseInt(timestampMatch[2]);
      const milliseconds = timestampMatch[3] ? parseInt(timestampMatch[3]) : 0;
      const text = timestampMatch[timestampMatch.length - 1].trim();
      
      if (text) {
        const time = minutes * 60 + seconds + milliseconds / 100;
        lyrics.push({ time, text });
      }
    }
  }
  
  // Sort by time
  lyrics.sort((a, b) => a.time - b.time);
  
  const duration = performance.now() - startTime;
  logger.debug(`Parsed ${lyrics.length} LRC lyrics lines in ${duration.toFixed(2)}ms`);
  
  return lyrics;
};

// Extract USLT lyrics using jsmediatags
const extractUSLTLyrics = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    // Dynamically import jsmediatags only on client side
    if (typeof window === 'undefined') {
      resolve('');
      return;
    }
    
    // Timeout for metadata extraction
    const timeout = setTimeout(() => {
      logger.warn('USLT extraction timed out for:', file.name);
      resolve('');
    }, PERFORMANCE.METADATA_EXTRACTION_TIMEOUT);
    
    import('jsmediatags').then(({ default: jsmediatags }) => {
      jsmediatags.read(file, {
        onSuccess: (tag: { tags: { USLT?: { lyrics: string }; lyrics?: { lyrics: string }; [key: string]: unknown } }) => {
          clearTimeout(timeout);
          logger.debug('jsmediatags read success for:', file.name);
          
          // Check for USLT tag (Unsynchronized lyrics)
          if (tag.tags.USLT && tag.tags.USLT.lyrics) {
            logger.info('Found USLT lyrics via jsmediatags, length:', tag.tags.USLT.lyrics.length);
            resolve(tag.tags.USLT.lyrics);
            return;
          }
          
          // Also check for 'lyrics' tag
          if (tag.tags.lyrics && typeof tag.tags.lyrics === 'object' && 'lyrics' in tag.tags.lyrics) {
            logger.info('Found lyrics tag via jsmediatags');
            resolve(tag.tags.lyrics.lyrics);
            return;
          }
          
          logger.debug('No USLT/lyrics found via jsmediatags for:', file.name);
          resolve('');
        },
        onError: (error: { type: string; info: string }) => {
          clearTimeout(timeout);
          logger.warn('jsmediatags error:', error.type, error.info);
          resolve('');
        }
      });
    }).catch((error: unknown) => {
      clearTimeout(timeout);
      logger.error('Failed to load jsmediatags:', error);
      resolve('');
    });
  });
};

export const useFileHandler = (
  playlist: AudioTrack[],
  setPlaylist: (tracks: AudioTrack[] | ((prev: AudioTrack[]) => AudioTrack[])) => void,
  setCurrentTrackIndex: (index: number) => void
) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<{
    active: boolean;
    total: number;
    processed: number;
    currentFile?: string;
    items: Array<{ name: string; status: 'pending' | 'done' | 'error'; error?: string }>;
  }>({ active: false, total: 0, processed: 0, items: [] });

  // Extract metadata from audio file
  const extractMetadata = async (file: File): Promise<{
    title?: string;
    artist?: string;
    album?: string;
    albumArtist?: string;
    year?: number;
    genre?: string;
    composer?: string;
    conductor?: string;
    trackNumber?: number;
    trackTotal?: number;
    discNumber?: number;
    discTotal?: number;
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    codec?: string;
    lossless?: boolean;
    albumArt?: string;
    /** Raw album art blob for direct cache storage (avoids URL→fetch→blob round-trip) */
    albumArtBlob?: Blob;
    lyrics?: string;
    lrcLyrics?: LyricLine[];
  }> => {
    const startTime = performance.now();
    
    try {
      logger.start(`Extracting metadata from: ${file.name}`);
      
      const musicMetadata = await getMusicMetadata();
      const metadata = await musicMetadata.parseBlob(file);
      const { common, format } = metadata;
      
      // Extract album art
      let albumArt = '';
      let albumArtBlob: Blob | undefined;
      if (common.picture && common.picture.length > 0) {
        const picture = common.picture[0];
        
        // Check album art size
        const artSize = picture.data.length;
        if (artSize > PERFORMANCE.MAX_ALBUM_ART_SIZE) {
          logger.warn(`Album art too large (${(artSize / 1024 / 1024).toFixed(2)}MB), skipping`);
        } else {
          albumArtBlob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
          albumArt = createObjectURL(albumArtBlob);
          logger.debug(`Extracted album art: ${picture.format}, ${(artSize / 1024).toFixed(2)}KB`);
        }
      }

      // Extract lyrics - first try jsmediatags for USLT
      let lyrics = '';
      let lrcLyrics: LyricLine[] | undefined;
      
      logger.debug('Attempting to extract USLT lyrics...');
      const usltLyrics = await extractUSLTLyrics(file);
      
      if (usltLyrics) {
        lyrics = usltLyrics;
        logger.info(`Extracted USLT lyrics (${lyrics.length} chars)`);
        
        // Check if it's LRC format
        if (/\[\d{1,2}:\d{2}[\.\:]\d{2}\]/.test(lyrics)) {
          logger.debug('Detected LRC format in USLT lyrics');
          lrcLyrics = parseLrcFormat(lyrics);
          lyrics = ''; // Clear simple lyrics since we have LRC
        }
      }
      
      // Fallback to music-metadata-browser if no USLT found
      if (!lyrics && !lrcLyrics) {
        logger.debug('No USLT found, trying music-metadata-browser...');
        
        if (common.lyrics && common.lyrics.length > 0) {
          lyrics = common.lyrics[0];
          logger.debug(`Found common.lyrics (${lyrics.length} chars)`);
        }
      }
      
      // Process lyrics if found
      if (lyrics && !lrcLyrics) {
        lyrics = lyrics.trim();
        
        // Remove language prefix if present
        lyrics = lyrics.replace(/^[a-z]{2,3}(\|\||:)/i, '');
        lyrics = lyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        lyrics = lyrics.replace(/\n{3,}/g, '\n\n');
        
        // Parse LRC format if it contains timestamp patterns
        if (/\[\d{1,2}:\d{2}[\.\:]\d{2}\]/.test(lyrics)) {
          logger.debug('Detected LRC format in metadata');
          lrcLyrics = parseLrcFormat(lyrics);
          lyrics = ''; // Clear simple lyrics since we have LRC
        }
      }

      // Detect format information
      const formatInfo = getAudioFormat(file);
      const lossless = formatInfo ? isLosslessFormat(formatInfo.format) : false;
      
      // Extract comprehensive metadata
      const extractedMetadata = {
        title: common.title || sanitizeFilename(file.name),
        artist: common.artist || "Unknown Artist",
        album: common.album || "Unknown Album",
        albumArtist: common.albumartist,
        year: common.year,
        genre: common.genre && common.genre.length > 0 ? common.genre[0] : undefined,
        composer: common.composer && common.composer.length > 0 ? common.composer.join(', ') : undefined,
        conductor: common.conductor && Array.isArray(common.conductor) ? common.conductor.join(', ') : common.conductor,
        trackNumber: common.track?.no || extractTrackNumber(file.name),
        trackTotal: common.track?.of ?? undefined,
        discNumber: common.disk?.no ?? undefined,
        discTotal: common.disk?.of ?? undefined,
        duration: format.duration || 0,
        bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
        sampleRate: format.sampleRate,
        channels: format.numberOfChannels,
        codec: format.codec,
        lossless,
        albumArt,
        albumArtBlob,
        lyrics,
        lrcLyrics,
      };
      
      const duration = performance.now() - startTime;
      logger.complete(`Metadata extraction for ${file.name}`, duration);
      
      if (extractedMetadata.bitrate && extractedMetadata.sampleRate) {
        logger.info(
          `Audio quality: ${formatBitrate(extractedMetadata.bitrate)}, ` +
          `${formatSampleRate(extractedMetadata.sampleRate)}, ` +
          `${getQualityDescription(extractedMetadata.bitrate, extractedMetadata.sampleRate, lossless)}`
        );
      }

      return extractedMetadata;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Failed to extract metadata:', error);
      logger.performance('Failed metadata extraction', duration);
      
      return {
        title: sanitizeFilename(file.name),
        artist: "Unknown Artist",
        album: "Unknown Album",
        duration: 0,
        lyrics: ''
      };
    }
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    const startTime = performance.now();
    logger.start(`Processing ${files.length} files`);
    // Initialize upload state for UI
    setUploadState({ active: true, total: files.length, processed: 0, currentFile: '', items: [] });
    
    // Separate audio and lyrics files using utility functions
    const audioFiles = Array.from(files).filter(file => isAudioFile(file));
    const lrcFiles = Array.from(files).filter(file => isLyricsFile(file));

    logger.info(`Found ${audioFiles.length} audio files and ${lrcFiles.length} lyrics files`);
    
    // Warn about unsupported files
    const unsupportedFiles = Array.from(files).filter(file => 
      !isAudioFile(file) && !isLyricsFile(file)
    );
    
    if (unsupportedFiles.length > 0) {
      logger.warn(`Skipping ${unsupportedFiles.length} unsupported files:`, 
        unsupportedFiles.map(f => f.name).join(', '));
    }

    // Create a map of LRC files by their base name (without extension)
    const lrcMap = new Map<string, File>();
    lrcFiles.forEach(file => {
      const baseName = file.name.replace(/\.(lrc|txt)$/i, '').toLowerCase();
      logger.debug('Adding LRC file to map:', baseName, '→', file.name);
      lrcMap.set(baseName, file);
    });

    const newTracks: AudioTrack[] = [];
    const cacheInputs: CacheTrackInput[] = []; // Collect for batch caching
    
    // Process audio files in batches for better performance
    const batchSize = PERFORMANCE.PARALLEL_METADATA_EXTRACTION;
    for (let i = 0; i < audioFiles.length; i += batchSize) {
      const batch = audioFiles.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file, batchIndex) => {
        // Update current file name for UI
        setUploadState(prev => ({ ...prev, currentFile: file.name }));
        const globalIndex = i + batchIndex;
        
        try {
          const metadata = await extractMetadata(file);
          
          // Check for corresponding LRC file
          const audioBaseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
          const lrcFile = lrcMap.get(audioBaseName);
          let lrcLyrics: LyricLine[] | undefined;
          
          logger.debug('Looking for LRC file for:', audioBaseName, 'Found:', !!lrcFile);
          
          if (lrcFile) {
            try {
              const lrcContent = await lrcFile.text();
              logger.debug(`LRC content length: ${lrcContent.length}`);
              lrcLyrics = parseLrcFormat(lrcContent);
              logger.info(`Parsed ${lrcLyrics.length} LRC lyrics lines from file`);
            } catch (error) {
              logger.error('Failed to read LRC file:', error);
            }
          }
          
          // Use LRC file if available, otherwise fall back to metadata LRC lyrics
          const finalLrcLyrics = lrcLyrics || metadata.lrcLyrics;
          const finalLyrics = finalLrcLyrics ? '' : (metadata.lyrics || ''); // Clear simple lyrics if we have LRC
          
          if (finalLrcLyrics) {
            logger.info(`Using ${finalLrcLyrics.length} LRC lyrics lines for ${audioBaseName}`);
          } else if (finalLyrics) {
            logger.info(`Using ${finalLyrics.length} chars of simple lyrics for ${audioBaseName}`);
          }

          const cacheKey = buildCacheKey(file);
          const track: AudioTrack = {
            id: `${Date.now()}-${globalIndex}-${Math.random().toString(36).substr(2, 9)}`,
            title: metadata.title || sanitizeFilename(file.name),
            artist: metadata.artist || "Unknown Artist",
            album: metadata.album || "Unknown Album",
            year: metadata.year,
            genre: metadata.genre,
            duration: metadata.duration || 0,
            file,
            url: createObjectURL(file),
            isActive: playlist.length === 0 && globalIndex === 0,
            albumArt: metadata.albumArt,
            lyrics: finalLyrics,
            lrcLyrics: finalLrcLyrics,
            cacheKey,
            isCached: true, // Track will be persisted to cache
            hasAlbumArt: !!metadata.albumArtBlob,
            metadata: {
              albumArtist: metadata.albumArtist,
              composer: metadata.composer,
              conductor: metadata.conductor,
              trackNumber: metadata.trackNumber,
              trackTotal: metadata.trackTotal,
              discNumber: metadata.discNumber,
              discTotal: metadata.discTotal,
              bitrate: metadata.bitrate,
              sampleRate: metadata.sampleRate,
              channels: metadata.channels,
              codec: metadata.codec,
              lossless: metadata.lossless,
            },
          };

          // Collect cache input for batch write later
          cacheInputs.push({
            file,
            meta: {
              title: track.title,
              artist: track.artist,
              album: track.album || 'Unknown Album',
              year: track.year,
              genre: track.genre,
              duration: track.duration,
              albumArt: metadata.albumArtBlob,
              lyrics: finalLyrics || undefined,
              lrcLyricsJson: finalLrcLyrics ? JSON.stringify(finalLrcLyrics) : undefined,
              playlistOrder: playlist.length + globalIndex,
            },
            precomputedCacheKey: cacheKey,
          });

          return track;
        } catch (error) {
          logger.error(`Failed to process file ${file.name}:`, error);
          
          // update upload state for error
          setUploadState(prev => ({
            ...prev,
            processed: prev.processed + 1,
            items: [...prev.items, { name: file.name, status: 'error', error: String(error) }]
          }));

          // Create a minimal track with error
          return {
            id: `${Date.now()}-${globalIndex}-error`,
            title: sanitizeFilename(file.name),
            artist: "Unknown Artist",
            album: "Unknown Album",
            duration: 0,
            file,
            url: createObjectURL(file),
            isActive: false,
            error: ERROR_MESSAGES.METADATA_EXTRACTION_FAILED,
          } as AudioTrack;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      // mark batch results processed in upload state
      setUploadState(prev => ({
        ...prev,
        processed: prev.processed + batchResults.length,
        items: [...prev.items, ...batchResults.map(r => ({ name: r.file?.name || r.title, status: (r.error ? 'error' : 'done') as 'error' | 'done', error: r.error }))]
      }));
      newTracks.push(...batchResults);
    }

    // Batch write all tracks to IndexedDB + Cache API (awaited for durability)
    if (cacheInputs.length > 0) {
      try {
        await cacheTracksBatch(cacheInputs);
        logger.debug(`Persisted ${cacheInputs.length} track(s) to cache`);
      } catch (err) {
        logger.error('Failed to batch cache tracks:', err);
      }
    }

    setPlaylist(prev => {
      // Filter out duplicates based on cacheKey (already computed during track creation)
      const filteredTracks = newTracks.filter(newTrack => {
        const newKey = newTrack.cacheKey;
        if (!newKey) return true; // Keep tracks without cache keys
        return !prev.some(existingTrack => {
          const existingKey = existingTrack.cacheKey;
          return existingKey === newKey;
        });
      });
      
      const duplicateCount = newTracks.length - filteredTracks.length;
      if (duplicateCount > 0) {
        logger.info(`Skipped ${duplicateCount} duplicate track(s)`);
      }
      
      if (filteredTracks.length > 0) {
        logger.info(SUCCESS_MESSAGES.TRACKS_ADDED(filteredTracks.length));
      }
      
      const updated = [...prev, ...filteredTracks];
      if (prev.length === 0 && updated.length > 0) {
        updated[0].isActive = true;
      }
      return updated;
    });

    if (playlist.length === 0 && newTracks.length > 0) {
      setCurrentTrackIndex(0);
    }
    
    const duration = performance.now() - startTime;
    logger.complete(`File upload processing`, duration);
    // finalize upload state
    setUploadState(prev => ({ ...prev, active: false, currentFile: undefined }));
  }, [playlist.length, setPlaylist, setCurrentTrackIndex]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {
      // Ignore passive event listener error
    }
    
    // Always show drag over state to be user-friendly
    // File type validation will happen on drop
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {
      // Ignore passive event listener error
    }
    
    // Only remove drag over state if we're actually leaving the drop zone
    // Check if we're leaving to a child element
    const relatedTarget = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;
    
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {
      // Ignore passive event listener error
    }
    
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      logger.info(`Dropped ${e.dataTransfer.files.length} files`);
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  return {
    isDragOver,
    handleFileUpload,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    uploadState
  };
};
