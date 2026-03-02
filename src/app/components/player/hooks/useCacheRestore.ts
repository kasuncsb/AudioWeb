import { useEffect, useRef, useCallback } from 'react';
import { AudioTrack, LyricLine, AudioMetadata } from '../types';
import { createLogger } from '@/utils/logger';
import { STORAGE_KEYS } from '@/config/constants';
import {
  initCache,
  getAllCachedTracks,
  getTrackBlobURL,
  retainOnlyBlobURLs,
  revokeTrackBlobURL,
  removeCachedTrack,
  updatePlaylistOrder,
  CachedTrackMeta,
} from '@/utils/cacheManager';

const logger = createLogger('CacheRestore');

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
        const cached = await getAllCachedTracks();

        if (cached.length === 0) {
          logger.debug('No cached tracks to restore');
          hasRestoredRef.current = true;
          isRestoringRef.current = false;
          return;
        }

        logger.info(`Restoring ${cached.length} cached track(s)...`);
        const startTime = performance.now();

        const tracks = await Promise.all(
          cached.map(async (meta, index) => reconstructTrack(meta, index))
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
  useEffect(() => {
    if (playlist.length === 0) return;

    const currentTrack = playlist[currentTrackIndex];
    if (!currentTrack?.cacheKey || !currentTrack.isCached) return;

    // Load current track's blob URL if not already set (placeholder URL)
    (async () => {
      try {
        // Load current track
        if (currentTrack.url === '' || currentTrack.url.startsWith('pending:')) {
          const blobUrl = await getTrackBlobURL(currentTrack.cacheKey!);
          if (blobUrl) {
            setPlaylist(prev => prev.map((t, i) =>
              i === currentTrackIndex ? { ...t, url: blobUrl } : t
            ));
            logger.debug(`Loaded blob URL for: ${currentTrack.title}`);
          } else {
            // Blob evicted or corrupted — remove from cache & playlist
            logger.warn(`Audio blob missing for cached track: ${currentTrack.title}`);
            await removeCachedTrack(currentTrack.cacheKey!);
            setPlaylist(prev => prev.filter((_, i) => i !== currentTrackIndex));
            return;
          }
        }

        // Prefetch next track
        const nextIndex = currentTrackIndex + 1;
        if (nextIndex < playlist.length) {
          const nextTrack = playlist[nextIndex];
          if (nextTrack?.cacheKey && nextTrack.isCached &&
            (nextTrack.url === '' || nextTrack.url.startsWith('pending:'))) {
            const nextBlobUrl = await getTrackBlobURL(nextTrack.cacheKey);
            if (nextBlobUrl) {
              setPlaylist(prev => prev.map((t, i) =>
                i === nextIndex ? { ...t, url: nextBlobUrl } : t
              ));
              logger.debug(`Prefetched blob URL for next: ${nextTrack.title}`);
            }
          }
        }

        // Retain only current + next blob URLs, revoke all others
        const keysToKeep: string[] = [];
        if (currentTrack.cacheKey) keysToKeep.push(currentTrack.cacheKey);
        if (nextIndex < playlist.length && playlist[nextIndex]?.cacheKey) {
          keysToKeep.push(playlist[nextIndex].cacheKey!);
        }
        retainOnlyBlobURLs(keysToKeep);

      } catch (error) {
        logger.error('Failed to load blob URL for track:', error);
      }
    })();
  }, [currentTrackIndex, playlist, setPlaylist]);

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
  const playlistRef = useRef(playlist);
  currentTrackIndexRef.current = currentTrackIndex;
  currentTimeRef.current = currentTime;
  playlistRef.current = playlist;

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
        const key = track.cacheKey || `${track.file?.name}|${track.file?.size}|${track.file?.lastModified}`;
        localStorage.setItem(STORAGE_KEYS.LAST_TRACK_KEY, key);
        localStorage.setItem(STORAGE_KEYS.LAST_POSITION, String(time));
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

  return { removeFromCache };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reconstruct an AudioTrack from cached metadata.
 * The audio blob URL is set to '' (placeholder) — it will be loaded lazily
 * when the track is selected for playback.
 */
async function reconstructTrack(
  meta: CachedTrackMeta,
  index: number
): Promise<AudioTrack | null> {
  try {
    // Reconstruct album art URL from inline blob
    let albumArt: string | undefined;
    if (meta.albumArt) {
      albumArt = URL.createObjectURL(meta.albumArt);
    }

    // Parse serialized LRC lyrics
    let lrcLyrics: LyricLine[] | undefined;
    if (meta.lrcLyricsJson) {
      try {
        lrcLyrics = JSON.parse(meta.lrcLyricsJson) as LyricLine[];
      } catch { /* ignore parse error */ }
    }

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
      albumArt,
      lyrics: meta.lyrics,
      lrcLyrics,
      cacheKey: meta.cacheKey,
      isCached: true,
    };

    return track;
  } catch (error) {
    logger.error(`Failed to reconstruct track "${meta.title}":`, error);
    return null;
  }
}
