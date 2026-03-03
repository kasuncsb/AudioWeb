import { useEffect, useRef, useCallback } from 'react';
import { AudioTrack, LyricLine } from '../types';
import { createLogger } from '@/utils/logger';
import { STORAGE_KEYS } from '@/config/constants';
import {
  initCache,
  prewarmCache,
  getAllCachedTracksLight,
  getTrackBlobURL,
  getAlbumArt,
  getTrackMeta,
  isBlobURLActive,
  retainOnlyBlobURLs,
  revokeTrackBlobURL,
  removeCachedTrack,
  updatePlaylistOrder,
  CachedTrackMetaLight,
} from '@/utils/cacheManager';

const logger = createLogger('CacheRestore');

// Pre-warm IndexedDB connection during idle time
prewarmCache();

/**
 * Hook to restore cached tracks on page load and manage cache blob URLs
 * during playback.
 *
 * Flow:
 *  1. On mount, reads all track metadata from IndexedDB (instant, ~5-20ms)
 *  2. Reconstructs AudioTrack[] with placeholder blob URLs
 *  3. When a track is selected for playback, loads its audio blob on demand
 *  4. Keeps only current + next track blob URLs alive for memory safety
 */
export function useCacheRestore(
  playlist: AudioTrack[],
  setPlaylist: (tracks: AudioTrack[] | ((prev: AudioTrack[]) => AudioTrack[])) => void,
  setCurrentTrackIndex: (index: number) => void,
  currentTrackIndex: number,
  currentTime: number,
) {
  const hasRestoredRef = useRef(false);
  const isRestoringRef = useRef(false);
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;

  // ── Phase 1: Restore metadata on mount ──
  useEffect(() => {
    if (hasRestoredRef.current || isRestoringRef.current) return;
    // Only restore if playlist is empty (first load)
    if (playlist.length > 0) {
      hasRestoredRef.current = true;
      return;
    }

    isRestoringRef.current = true;

    (async () => {
      try {
        await initCache();
        const cached = await getAllCachedTracksLight();

        if (cached.length === 0) {
          logger.debug('No cached tracks to restore');
          hasRestoredRef.current = true;
          isRestoringRef.current = false;
          return;
        }

        logger.info(`Restoring ${cached.length} cached track(s)...`);
        const startTime = performance.now();

        const tracks = await Promise.all(
          cached.map(async (meta, index) => reconstructTrackLight(meta, index))
        );

        // Filter out any that failed to reconstruct
        const validTracks = tracks.filter((t): t is AudioTrack => t !== null);

        if (validTracks.length > 0) {
          // Restore last played track from localStorage
          let restoredIndex = 0;
          try {
            const savedKey = localStorage.getItem(STORAGE_KEYS.LAST_TRACK_KEY);
            if (savedKey) {
              const idx = validTracks.findIndex(t => t.cacheKey === savedKey);
              if (idx >= 0) restoredIndex = idx;
            }
          } catch { /* localStorage unavailable */ }

          validTracks.forEach((t, i) => { t.isActive = i === restoredIndex; });
          setPlaylist(validTracks);
          setCurrentTrackIndex(restoredIndex);

          const elapsed = performance.now() - startTime;
          logger.info(`Restored ${validTracks.length} track(s) at index ${restoredIndex} in ${elapsed.toFixed(0)}ms`);
        }
      } catch (error) {
        logger.error('Failed to restore cached tracks:', error);
      } finally {
        hasRestoredRef.current = true;
        isRestoringRef.current = false;
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // ── Phase 2: Lazy blob URL loading on track change ──

  /** Check if a cached track needs its blob URL (re)loaded */
  const trackNeedsBlobLoad = useCallback((track: AudioTrack): boolean => {
    if (!track.cacheKey || !track.isCached) return false;
    return track.url === '' ||
      track.url.startsWith('pending:') ||
      (track.url.startsWith('blob:') && !isBlobURLActive(track.cacheKey));
  }, []);

  // Use a ref to read latest playlist without adding it as a dep
  // (playlistRef is declared at the top of the hook)

  useEffect(() => {
    const pl = playlistRef.current;
    if (pl.length === 0) return;

    const currentTrack = pl[currentTrackIndex];
    if (!currentTrack?.cacheKey || !currentTrack.isCached) return;

    // Capture values for the async closure
    const cacheKey = currentTrack.cacheKey;
    const trackIndex = currentTrackIndex;
    let cancelled = false;

    (async () => {
      try {
        // ── Load current track (blob + art + lyrics in parallel) ──
        const needsBlob = trackNeedsBlobLoad(currentTrack);
        const needsArt = !!currentTrack.hasAlbumArt && !currentTrack.albumArt;
        const needsLyrics = currentTrack.lyrics === undefined && currentTrack.lrcLyrics === undefined;

        if (needsBlob || needsArt || needsLyrics) {
          const [blobUrl, artBlob, fullMeta] = await Promise.all([
            needsBlob ? getTrackBlobURL(cacheKey) : Promise.resolve(null),
            needsArt ? getAlbumArt(cacheKey) : Promise.resolve(null),
            needsLyrics ? getTrackMeta(cacheKey) : Promise.resolve(null),
          ]);

          if (cancelled) return;

          // If blob is missing, track is corrupted — remove it
          if (needsBlob && !blobUrl) {
            logger.warn(`Audio blob missing for cached track: ${currentTrack.title}`);
            await removeCachedTrack(cacheKey);
            setPlaylist(prev => prev.filter((_, i) => i !== trackIndex));
            return;
          }

          // Build update object for a single setPlaylist call
          const updates: Partial<AudioTrack> = {};
          if (blobUrl) updates.url = blobUrl;
          if (artBlob) updates.albumArt = URL.createObjectURL(artBlob);
          if (fullMeta) {
            updates.lyrics = fullMeta.lyrics;
            if (fullMeta.lrcLyricsJson) {
              try {
                updates.lrcLyrics = JSON.parse(fullMeta.lrcLyricsJson) as LyricLine[];
              } catch { /* ignore malformed JSON */ }
            }
          }

          if (Object.keys(updates).length > 0) {
            setPlaylist(prev => prev.map((t, i) =>
              i === trackIndex ? { ...t, ...updates } : t
            ));
            logger.debug(`Loaded cache data for: ${currentTrack.title} (${Object.keys(updates).join(', ')})`);
          }
        }

        if (cancelled) return;

        // ── Prefetch adjacent tracks (previous + next) for seamless navigation ──
        const adjacentIndices = [currentTrackIndex - 1, currentTrackIndex + 1];
        const adjUpdates: Array<{ index: number; updates: Partial<AudioTrack> }> = [];

        await Promise.all(
          adjacentIndices
            .filter(i => i >= 0 && i < pl.length)
            .map(async (adjIndex) => {
              const adjTrack = pl[adjIndex];
              const adjNeedsBlob = trackNeedsBlobLoad(adjTrack);
              const adjNeedsArt = !!adjTrack.hasAlbumArt && !adjTrack.albumArt && !!adjTrack.cacheKey;

              if (!adjNeedsBlob && !adjNeedsArt) return;

              const [adjBlobUrl, adjArtBlob] = await Promise.all([
                adjNeedsBlob ? getTrackBlobURL(adjTrack.cacheKey!) : Promise.resolve(null),
                adjNeedsArt ? getAlbumArt(adjTrack.cacheKey!) : Promise.resolve(null),
              ]);

              if (cancelled) return;

              const partialUpdate: Partial<AudioTrack> = {};
              if (adjBlobUrl) partialUpdate.url = adjBlobUrl;
              if (adjArtBlob) partialUpdate.albumArt = URL.createObjectURL(adjArtBlob);

              if (Object.keys(partialUpdate).length > 0) {
                adjUpdates.push({ index: adjIndex, updates: partialUpdate });
                logger.debug(`Prefetched ${Object.keys(partialUpdate).join('+')} for ${adjIndex < currentTrackIndex ? 'prev' : 'next'}: ${adjTrack.title}`);
              }
            })
        );

        if (cancelled) return;

        // Apply all adjacent updates in one setPlaylist call
        if (adjUpdates.length > 0) {
          const adjMap = new Map(adjUpdates.map(u => [u.index, u.updates]));
          setPlaylist(prev => prev.map((t, i) =>
            adjMap.has(i) ? { ...t, ...adjMap.get(i)! } : t
          ));
        }

        // Retain only current + prev + next blob URLs, revoke all others
        const keysToKeep: string[] = [];
        if (cacheKey) keysToKeep.push(cacheKey);
        for (const adjIndex of adjacentIndices) {
          if (adjIndex >= 0 && adjIndex < pl.length && pl[adjIndex]?.cacheKey) {
            keysToKeep.push(pl[adjIndex].cacheKey!);
          }
        }
        retainOnlyBlobURLs(keysToKeep);

      } catch (error) {
        logger.error('Failed to load blob URL for track:', error);
      }
    })();

    return () => { cancelled = true; };
  // Re-run when track index changes or playlist grows/shrinks (not on property updates)
  }, [currentTrackIndex, playlist.length, setPlaylist, trackNeedsBlobLoad]);

  // ── Phase 3: Background-load album art for all playlist tracks ──
  const hasLoadedAllArtRef = useRef(false);

  useEffect(() => {
    // Wait until Phase 1 restore is done and playlist is populated
    if (!hasRestoredRef.current || playlist.length === 0) return;
    // Only run once
    if (hasLoadedAllArtRef.current) return;
    hasLoadedAllArtRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const pl = playlistRef.current;
        const artUpdates = new Map<number, string>();

        // Load album art for all tracks that need it, in small batches
        const BATCH_SIZE = 5;
        for (let i = 0; i < pl.length; i += BATCH_SIZE) {
          if (cancelled) return;

          const batch = pl.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (track, batchIdx) => {
              const idx = i + batchIdx;
              if (!track.hasAlbumArt || track.albumArt || !track.cacheKey) return;
              const artBlob = await getAlbumArt(track.cacheKey);
              if (artBlob && !cancelled) {
                artUpdates.set(idx, URL.createObjectURL(artBlob));
              }
            })
          );
        }

        if (cancelled || artUpdates.size === 0) return;

        setPlaylist(prev => prev.map((t, i) =>
          artUpdates.has(i) ? { ...t, albumArt: artUpdates.get(i)! } : t
        ));
        logger.info(`Background-loaded album art for ${artUpdates.size} track(s)`);
      } catch (error) {
        logger.error('Failed to background-load album art:', error);
      }
    })();

    return () => { cancelled = true; };
  }, [playlist.length, setPlaylist]); // Trigger when playlist first populates

  // ── Sync playlist order to cache on changes ──
  const syncPlaylistOrder = useCallback((tracks: AudioTrack[]) => {
    const cacheKeys = tracks
      .map(t => t.cacheKey)
      .filter((k): k is string => !!k);

    if (cacheKeys.length > 0) {
      updatePlaylistOrder(cacheKeys).catch(err =>
        logger.error('Failed to sync playlist order:', err)
      );
    }
  }, []);

  // Sync order when playlist changes (debounced via ref)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPlaylistLenRef = useRef(playlist.length);

  useEffect(() => {
    // Don't sync during initial restore phase
    if (!hasRestoredRef.current) return;
    // Only sync when length actually changed
    if (playlist.length === 0) return;
    if (playlist.length === prevPlaylistLenRef.current) return;
    prevPlaylistLenRef.current = playlist.length;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncPlaylistOrder(playlist);
    }, 1000);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [playlist, syncPlaylistOrder]);

  // ── Persist playback state to localStorage every 1s ──
  const currentTrackIndexRef = useRef(currentTrackIndex);
  const currentTimeRef = useRef(currentTime);
  currentTrackIndexRef.current = currentTrackIndex;
  currentTimeRef.current = currentTime;

  useEffect(() => {
    // Don't gate on hasRestoredRef - the interval callback handles empty playlist.
    // The effect runs once on mount; refs keep it current.
    const interval = setInterval(() => {
      const pl = playlistRef.current;
      const idx = currentTrackIndexRef.current;
      const time = currentTimeRef.current;

      // If playlist is empty, clear stale localStorage keys
      if (pl.length === 0) {
        try {
          localStorage.removeItem(STORAGE_KEYS.LAST_TRACK_KEY);
          localStorage.removeItem(STORAGE_KEYS.LAST_POSITION);
        } catch { /* ignore */ }
        return;
      }

      const track = pl[idx];
      if (!track) return;

      try {
        // Only save if we have a valid cache key
        if (track.cacheKey) {
          localStorage.setItem(STORAGE_KEYS.LAST_TRACK_KEY, track.cacheKey);
          localStorage.setItem(STORAGE_KEYS.LAST_POSITION, String(time));
        }
      } catch { /* quota or private mode */ }
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Stable interval, reads from refs

  // ── Handle track removal from cache ──
  const removeFromCache = useCallback(async (track: AudioTrack) => {
    // Revoke album art blob URL to prevent memory leak
    if (track.albumArt && track.albumArt.startsWith('blob:')) {
      URL.revokeObjectURL(track.albumArt);
    }
    if (track.cacheKey) {
      revokeTrackBlobURL(track.cacheKey);
      await removeCachedTrack(track.cacheKey);
      logger.debug(`Removed from cache: ${track.title}`);
    }
  }, []);

  return { removeFromCache, syncPlaylistOrder };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reconstruct an AudioTrack from lightweight cached metadata.
 * Album art and lyrics are loaded lazily to speed up initial restore.
 */
async function reconstructTrackLight(
  meta: CachedTrackMetaLight,
  index: number
): Promise<AudioTrack | null> {
  try {
    // Create a minimal placeholder File so existing code that accesses
    // track.file.name / .size / .type doesn't break.  The actual audio
    // data will be streamed from the Cache API blob URL when needed.
    const placeholderFile = new File([], meta.fileName, {
      type: meta.fileMimeType,
      lastModified: meta.fileLastModified,
    });

    // Override size getter to reflect original file size
    // (File constructor creates a 0-byte file; we need the real size for duplicate checks)
    Object.defineProperty(placeholderFile, 'size', {
      value: meta.fileSize,
      writable: false,
    });

    const track: AudioTrack = {
      id: `cached-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      year: meta.year,
      genre: meta.genre,
      duration: meta.duration,
      file: placeholderFile,
      url: '', // Will be lazily loaded from Cache API
      isActive: false,
      // albumArt loaded lazily when track becomes active (Phase 2)
      // lyrics and lrcLyrics loaded on-demand via getTrackMeta
      cacheKey: meta.cacheKey,
      isCached: true,
      hasAlbumArt: meta.hasAlbumArt, // Track whether we need to load album art
    };

    return track;
  } catch (error) {
    logger.error(`Failed to reconstruct track "${meta.title}":`, error);
    return null;
  }
}
