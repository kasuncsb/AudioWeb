/**
 * AudioWeb Cache Manager
 *
 * Provides persistent browser caching for audio tracks and metadata using:
 *  - Cache API  → audio file blobs (optimized for large binary streaming)
 *  - IndexedDB  → track metadata (including inline album art) and config
 *
 * Design principles:
 *  - Two-phase load: metadata first (instant), blobs on-demand (lazy)
 *  - Only current + next track blob URLs alive at any time (memory-safe for mobile)
 *  - Cache keys use composite string (name|size|lastModified) for identification
 *  - Trust browser's built-in quota management
 *  - Global cache version triggers complete site data flush on mismatch
 */

import { createLogger } from './logger';

const logger = createLogger('CacheManager');

// ─── Global Cache Version ────────────────────────────────────────────────────
// Increment this when making ANY breaking changes to cache format.
// This triggers a complete flush of all site data (IndexedDB, Cache API, localStorage, sessionStorage).

const CACHE_VERSION = 3;
const CACHE_VERSION_KEY = 'aw_cache_v';

// ─── Constants ───────────────────────────────────────────────────────────────

const DB_NAME = 'aw-cache';
const DB_VERSION = 4; // v4: Remove CONFIG store, album art moved to Cache API

/** IndexedDB store names */
const STORES = {
  TRACKS: 'tracks',
} as const;

/** Cache API cache name for audio blobs and album art */
const AUDIO_CACHE_NAME = 'aw-media';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Metadata stored in IndexedDB for each cached track */
export interface CachedTrackMeta {
  /** Unique key: name|size|lastModified */
  cacheKey: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  /** @deprecated Album art now stored in Cache API, this field kept for migration */
  albumArt?: Blob;
  /** Plain text lyrics */
  lyrics?: string;
  /** Serialized LRC lyrics (JSON array of {time, text}) */
  lrcLyricsJson?: string;
  /** Playlist order index for restoration */
  playlistOrder: number;
  /** Original file MIME type (for reconstructing File from blob) */
  fileMimeType: string;
  /** Original file name */
  fileName: string;
  /** Original file size in bytes */
  fileSize: number;
  /** Original file lastModified timestamp */
  fileLastModified: number;
  /** Whether album art exists in Cache API */
  hasAlbumArt?: boolean;
}

/** Lightweight metadata for initial playlist load (excludes large blobs) */
export interface CachedTrackMetaLight {
  cacheKey: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  playlistOrder: number;
  fileMimeType: string;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  hasAlbumArt?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a cache key from file properties (name|size|lastModified) */
export function buildCacheKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

// ─── IndexedDB ───────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Migrate from v1 to v2
      if (oldVersion < 2) {
        // Remove old stores if they exist
        if (db.objectStoreNames.contains('albumArt')) {
          db.deleteObjectStore('albumArt');
        }
        if (db.objectStoreNames.contains('frequency')) {
          db.deleteObjectStore('frequency');
        }
      }

      // Migrate from v2 to v3: cache key format changed from hash to composite string
      // Must delete old tracks since the keyPath values are incompatible
      if (oldVersion < 3 && oldVersion >= 1) {
        if (db.objectStoreNames.contains(STORES.TRACKS)) {
          db.deleteObjectStore(STORES.TRACKS);
        }
      }

      // Migrate from v3 to v4: remove CONFIG store (unused), album art moved to Cache API
      if (oldVersion < 4 && oldVersion >= 1) {
        if (db.objectStoreNames.contains('config')) {
          db.deleteObjectStore('config');
        }
      }

      // Create tracks store
      if (!db.objectStoreNames.contains(STORES.TRACKS)) {
        const trackStore = db.createObjectStore(STORES.TRACKS, { keyPath: 'cacheKey' });
        trackStore.createIndex('playlistOrder', 'playlistOrder', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      logger.error('Failed to open IndexedDB:', request.error);
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/** Generic IndexedDB delete */
async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite', { durability: 'relaxed' });
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Cache API (audio blobs) ─────────────────────────────────────────────────

/** Memoized Cache API handle (avoids repeated caches.open() calls) */
let cachePromise: Promise<Cache> | null = null;

function openAudioCache(): Promise<Cache> {
  if (cachePromise) return cachePromise;
  cachePromise = caches.open(AUDIO_CACHE_NAME);
  // Reset on failure so next call retries
  cachePromise.catch(() => { cachePromise = null; });
  return cachePromise;
}

/** Convert cache key to a proper URL for Cache API (URL-encodes special chars) */
function cacheKeyToUrl(cacheKey: string): string {
  return `https://audioweb.local/_cache/${encodeURIComponent(cacheKey)}`;
}

/** Convert cache key to album art URL in Cache API */
function albumArtKeyToUrl(cacheKey: string): string {
  return `https://audioweb.local/_albumart/${encodeURIComponent(cacheKey)}`;
}

/** Store an audio file blob in Cache API */
async function cacheAudioBlob(cacheKey: string, file: File): Promise<void> {
  try {
    const cache = await openAudioCache();
    const url = cacheKeyToUrl(cacheKey);
    const response = new Response(file, {
      headers: {
        'Content-Type': file.type || 'audio/mpeg',
        'Content-Length': String(file.size),
      },
    });
    await cache.put(url, response);
    logger.debug(`Cached audio blob: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  } catch (error) {
    logger.error('Failed to cache audio blob:', error);
  }
}

/** Retrieve an audio file blob from Cache API */
export async function getAudioBlob(cacheKey: string): Promise<Blob | null> {
  try {
    const cache = await openAudioCache();
    const url = cacheKeyToUrl(cacheKey);
    const response = await cache.match(url);
    if (!response) return null;
    return await response.blob();
  } catch (error) {
    logger.error('Failed to retrieve audio blob:', error);
    return null;
  }
}

/** Delete an audio blob from Cache API */
async function deleteAudioBlob(cacheKey: string): Promise<void> {
  try {
    const cache = await openAudioCache();
    const url = cacheKeyToUrl(cacheKey);
    await cache.delete(url);
  } catch (error) {
    logger.error('Failed to delete audio blob:', error);
  }
}

/** Store album art blob in Cache API (separate from audio for lazy loading) */
async function cacheAlbumArt(cacheKey: string, blob: Blob): Promise<void> {
  try {
    const cache = await openAudioCache();
    const url = albumArtKeyToUrl(cacheKey);
    const response = new Response(blob, {
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
    });
    await cache.put(url, response);
  } catch (error) {
    logger.error('Failed to cache album art:', error);
  }
}

/** Retrieve album art blob from Cache API */
export async function getAlbumArt(cacheKey: string): Promise<Blob | null> {
  try {
    const cache = await openAudioCache();
    const url = albumArtKeyToUrl(cacheKey);
    const response = await cache.match(url);
    if (!response) return null;
    return await response.blob();
  } catch (error) {
    logger.error('Failed to retrieve album art:', error);
    return null;
  }
}

/** Delete album art from Cache API */
async function deleteAlbumArt(cacheKey: string): Promise<void> {
  try {
    const cache = await openAudioCache();
    const url = albumArtKeyToUrl(cacheKey);
    await cache.delete(url);
  } catch {
    // Ignore - may not exist
  }
}

// ─── Track Metadata ──────────────────────────────────────────────────────────

/** Input for caching a track */
export interface CacheTrackInput {
  file: File;
  meta: Omit<CachedTrackMeta, 'cacheKey' | 'fileName' | 'fileSize' | 'fileLastModified' | 'fileMimeType' | 'hasAlbumArt'>;
  precomputedCacheKey?: string;
}

/**
 * Batch cache multiple tracks in a single IndexedDB transaction.
 * Audio blobs and album art are written to Cache API in parallel and
 * awaited so data is durable before the function resolves.
 */
export async function cacheTracksBatch(inputs: CacheTrackInput[]): Promise<string[]> {
  if (inputs.length === 0) return [];
  
  const db = await openDB();
  const cacheKeys: string[] = [];
  const blobPromises: Promise<void>[] = [];
  
  // Prepare records and collect blob write promises
  const records: CachedTrackMeta[] = inputs.map(({ file, meta, precomputedCacheKey }) => {
    const cacheKey = precomputedCacheKey || buildCacheKey(file);
    cacheKeys.push(cacheKey);
    
    // Queue blob writes (awaited below)
    blobPromises.push(cacheAudioBlob(cacheKey, file));
    if (meta.albumArt) {
      blobPromises.push(cacheAlbumArt(cacheKey, meta.albumArt));
    }
    
    return {
      cacheKey,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      year: meta.year,
      genre: meta.genre,
      duration: meta.duration,
      lyrics: meta.lyrics,
      lrcLyricsJson: meta.lrcLyricsJson,
      playlistOrder: meta.playlistOrder,
      fileName: file.name,
      fileSize: file.size,
      fileLastModified: file.lastModified,
      fileMimeType: file.type || 'audio/mpeg',
      hasAlbumArt: !!meta.albumArt,
    };
  });
  
  // Write all metadata in a single IndexedDB transaction with relaxed durability
  // AND write all blobs to Cache API in parallel
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.TRACKS, 'readwrite', { durability: 'relaxed' });
      const store = tx.objectStore(STORES.TRACKS);
      for (const record of records) {
        store.put(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }),
    ...blobPromises,
  ]);
  
  logger.debug(`Batch cached ${inputs.length} track(s)`);
  return cacheKeys;
}

/**
 * Get lightweight metadata for all cached tracks (excludes large blobs).
 * Use this for initial playlist restoration - much faster than getAllCachedTracks.
 */
export async function getAllCachedTracksLight(): Promise<CachedTrackMetaLight[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRACKS, 'readonly');
    const store = tx.objectStore(STORES.TRACKS);
    const index = store.index('playlistOrder');
    const results: CachedTrackMetaLight[] = [];
    
    const cursorReq = index.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const full = cursor.value as CachedTrackMeta;
        // Project only lightweight fields (exclude albumArt, lyrics, lrcLyricsJson)
        results.push({
          cacheKey: full.cacheKey,
          title: full.title,
          artist: full.artist,
          album: full.album,
          year: full.year,
          genre: full.genre,
          duration: full.duration,
          playlistOrder: full.playlistOrder,
          fileMimeType: full.fileMimeType,
          fileName: full.fileName,
          fileSize: full.fileSize,
          fileLastModified: full.fileLastModified,
          hasAlbumArt: full.hasAlbumArt ?? !!full.albumArt, // Migration: check inline blob
        });
        cursor.continue();
      }
    };
    
    tx.oncomplete = () => {
      logger.info(`Loaded ${results.length} cached track(s) (lightweight)`);
      resolve(results);
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Get full track metadata including lyrics (for single track) */
export async function getTrackMeta(cacheKey: string): Promise<CachedTrackMeta | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRACKS, 'readonly');
    const store = tx.objectStore(STORES.TRACKS);
    const req = store.get(cacheKey);
    req.onsuccess = () => resolve(req.result as CachedTrackMeta | null);
    req.onerror = () => reject(req.error);
  });
}

/** Batch update playlist order for all tracks */
export async function updatePlaylistOrder(orderedCacheKeys: string[]): Promise<void> {
  const db = await openDB();
  const orderMap = new Map(orderedCacheKeys.map((key, index) => [key, index]));
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRACKS, 'readwrite', { durability: 'relaxed' });
    const store = tx.objectStore(STORES.TRACKS);
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const meta = cursor.value as CachedTrackMeta;
        const newOrder = orderMap.get(meta.cacheKey);
        if (newOrder !== undefined) {
          meta.playlistOrder = newOrder;
          cursor.update(meta);
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove a track from cache (metadata + audio blob + album art) */
export async function removeCachedTrack(cacheKey: string): Promise<void> {
  try {
    await idbDelete(STORES.TRACKS, cacheKey);
    await deleteAudioBlob(cacheKey);
    await deleteAlbumArt(cacheKey);
    logger.debug(`Removed cached track: ${cacheKey}`);
  } catch (error) {
    logger.error('Failed to remove cached track:', error);
  }
}

/** Remove all cached tracks and associated data */
export async function clearAllCachedTracks(): Promise<void> {
  try {
    const db = await openDB();

    // Clear tracks store with relaxed durability
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.TRACKS, 'readwrite', { durability: 'relaxed' });
      const req = tx.objectStore(STORES.TRACKS).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Clear audio cache (includes album art; also reset memoized handle)
    cachePromise = null;
    await caches.delete(AUDIO_CACHE_NAME);

    logger.info('Cleared all cached tracks and data');
  } catch (error) {
    logger.error('Failed to clear all caches:', error);
  }
}

// ─── Blob URL Management ─────────────────────────────────────────────────────

/**
 * Active blob URL tracker.
 * Keeps at most `current` + `next` URLs alive to limit memory usage.
 */
const activeBlobURLs = new Map<string, string>();

/**
 * Get or create a blob URL for a cached track.
 * If the track isn't in cache, returns null.
 */
export async function getTrackBlobURL(cacheKey: string): Promise<string | null> {
  // Return existing URL if already active
  const existing = activeBlobURLs.get(cacheKey);
  if (existing) return existing;

  const blob = await getAudioBlob(cacheKey);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  activeBlobURLs.set(cacheKey, url);
  return url;
}

/**
 * Check if a blob URL is still active (not yet revoked) for a given cache key
 */
export function isBlobURLActive(cacheKey: string): boolean {
  return activeBlobURLs.has(cacheKey);
}

/**
 * Revoke a specific blob URL (call when track is no longer current or next)
 */
export function revokeTrackBlobURL(cacheKey: string): void {
  const url = activeBlobURLs.get(cacheKey);
  if (url) {
    URL.revokeObjectURL(url);
    activeBlobURLs.delete(cacheKey);
  }
}

/**
 * Keep only the specified cache keys' blob URLs alive, revoke all others.
 * Call this when track changes with [currentKey, nextKey].
 */
export function retainOnlyBlobURLs(keysToKeep: string[]): void {
  const keepSet = new Set(keysToKeep);
  for (const [key, url] of activeBlobURLs) {
    if (!keepSet.has(key)) {
      URL.revokeObjectURL(url);
      activeBlobURLs.delete(key);
    }
  }
}

/** Revoke all active blob URLs */
export function revokeAllCachedBlobURLs(): void {
  for (const url of activeBlobURLs.values()) {
    URL.revokeObjectURL(url);
  }
  activeBlobURLs.clear();
}

// ─── Storage Info ────────────────────────────────────────────────────────────

/** Check current storage usage */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percentUsed: number }> {
  try {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota, percentUsed: quota > 0 ? (usage / quota) * 100 : 0 };
    }
  } catch {
    // fallback
  }
  return { usage: 0, quota: 0, percentUsed: 0 };
}

// ─── Initialization ──────────────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;

/**
 * Check if cache version matches, flush all site data if outdated.
 * This performs a complete flush similar to DevTools "Clear site data".
 */
async function checkAndFlushIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return;

  const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
  const currentVersion = CACHE_VERSION;

  // If version matches, nothing to do
  if (storedVersion === String(currentVersion)) {
    return;
  }

  logger.info(
    storedVersion
      ? `Cache version mismatch (stored: ${storedVersion}, current: ${currentVersion}) — flushing all site data`
      : `No cache version found — flushing all site data for clean start`
  );

  // 1. Delete IndexedDB database
  try {
    // Close existing connection first
    if (dbPromise) {
      try {
        const existingDb = await dbPromise;
        existingDb.close();
      } catch {
        // Ignore - db might not have been opened successfully
      }
      dbPromise = null;
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        logger.warn('IndexedDB deletion blocked — retrying');
        resolve(); // Continue anyway
      };
    });
    logger.info('IndexedDB database deleted');
  } catch (error) {
    logger.error('Failed to delete IndexedDB:', error);
  }

  // 2. Delete all Cache API caches
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    // Reset memoized cache handle
    cachePromise = null;
    logger.info(`Deleted ${cacheNames.length} Cache API cache(s)`);
  } catch (error) {
    logger.error('Failed to clear Cache API:', error);
  }

  // 3. Clear localStorage (except preserve nothing — full flush)
  try {
    localStorage.clear();
    logger.info('localStorage cleared');
  } catch (error) {
    logger.error('Failed to clear localStorage:', error);
  }

  // 4. Clear sessionStorage
  try {
    sessionStorage.clear();
    logger.info('sessionStorage cleared');
  } catch (error) {
    logger.error('Failed to clear sessionStorage:', error);
  }

  // 5. Revoke any active blob URLs
  revokeAllCachedBlobURLs();

  // 6. Set current version so we don't flush again
  try {
    localStorage.setItem(CACHE_VERSION_KEY, String(currentVersion));
    logger.info(`Cache version set to ${currentVersion}`);
  } catch (error) {
    logger.error('Failed to set cache version:', error);
  }
}

/**
 * Initialize the cache system.
 * Safe to call multiple times — will only run once.
 */
export function initCache(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check cache version and flush all site data if outdated
      await checkAndFlushIfNeeded();
      
      await openDB();
      
      logger.info('Cache system initialized');
      
      // Request persistent storage in the background (non-blocking)
      // This prevents mobile browsers from clearing cached tracks and playback
      // position, but shouldn't block cache initialization if it fails or hangs.
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist()
          .then(isPersisted => {
            if (isPersisted) {
              logger.info('Persistent storage granted — cache will survive across sessions');
            } else {
              logger.warn('Persistent storage denied — cache may be cleared by browser');
            }
          })
          .catch(err => {
            logger.warn('Failed to request persistent storage:', err);
          });
      }

      // Log storage stats (debug only)
      if (process.env.NODE_ENV === 'development') {
        const estimate = await getStorageEstimate();
        if (estimate.quota > 0) {
          logger.info(
            `Storage: ${(estimate.usage / 1024 / 1024).toFixed(1)}MB / ` +
            `${(estimate.quota / 1024 / 1024).toFixed(0)}MB ` +
            `(${estimate.percentUsed.toFixed(1)}%)`
          );
        }
      }
    } catch (error) {
      logger.error('Cache initialization failed:', error);
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Pre-warm IndexedDB by opening the connection during idle time.
 * Call this early (e.g., in requestIdleCallback) to reduce latency
 * when the cache is first accessed.
 */
export function prewarmCache(): void {
  if (typeof window === 'undefined') return;
  
  // Use requestIdleCallback if available, otherwise setTimeout
  const scheduleIdle = window.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1));
  
  scheduleIdle(() => {
    openDB().catch(() => {
      // Ignore errors - this is just an optimization
    });
    openAudioCache().catch(() => {
      // Ignore errors
    });
  });
}
