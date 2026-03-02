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
 *  - Cache keys use SHA-256 hash for fast lookups
 *  - Trust browser's built-in quota management
 */

import { createLogger } from './logger';

const logger = createLogger('CacheManager');

// ─── Constants ───────────────────────────────────────────────────────────────

const DB_NAME = 'aw-cache';
const DB_VERSION = 2; // Incremented for schema changes

/** IndexedDB store names */
const STORES = {
  TRACKS: 'tracks',
  CONFIG: 'config',
} as const;

/** Cache API cache name for audio blobs */
const AUDIO_CACHE_NAME = 'aw-media';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Metadata stored in IndexedDB for each cached track */
export interface CachedTrackMeta {
  /** SHA-256 hash used as unique key: hash(name|size|lastModified) */
  cacheKey: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  /** Album art blob stored inline */
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a SHA-256 hash cache key from file properties */
export async function buildCacheKey(file: File): Promise<string> {
  const composite = `${file.name}|${file.size}|${file.lastModified}`;
  return sha256Text(composite);
}

/** SHA-256 hash of text string, returned as hex string */
async function sha256Text(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return sha256(data.buffer);
}

/** SHA-256 hash of an ArrayBuffer, returned as hex string */
async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
        
        // Delete old tracks store to rebuild with new schema
        if (db.objectStoreNames.contains(STORES.TRACKS)) {
          db.deleteObjectStore(STORES.TRACKS);
        }
      }

      // Create tracks store with simplified schema
      if (!db.objectStoreNames.contains(STORES.TRACKS)) {
        const trackStore = db.createObjectStore(STORES.TRACKS, { keyPath: 'cacheKey' });
        trackStore.createIndex('playlistOrder', 'playlistOrder', { unique: false });
      }

      // Config store (EQ, visualizer, etc.)
      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        db.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
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

/** Generic IndexedDB get */
async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Generic IndexedDB put */
async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Generic IndexedDB delete */
async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Get all records from a store, ordered by an index */
async function idbGetAllByIndex<T>(storeName: string, indexName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Count records in a store */
async function idbCount(storeName: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Cache API (audio blobs) ─────────────────────────────────────────────────

/** Store an audio file blob in Cache API */
async function cacheAudioBlob(cacheKey: string, file: File): Promise<void> {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const response = new Response(file, {
      headers: {
        'Content-Type': file.type || 'audio/mpeg',
        'Content-Length': String(file.size),
      },
    });
    await cache.put(cacheKey, response);
    logger.debug(`Cached audio blob: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  } catch (error) {
    logger.error('Failed to cache audio blob:', error);
  }
}

/** Retrieve an audio file blob from Cache API */
async function getAudioBlob(cacheKey: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const response = await cache.match(cacheKey);
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
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.delete(cacheKey);
  } catch (error) {
    logger.error('Failed to delete audio blob:', error);
  }
}

// ─── Track Metadata ──────────────────────────────────────────────────────────

/** Cache a track's metadata and audio blob */
export async function cacheTrack(
  file: File,
  meta: Omit<CachedTrackMeta, 'cacheKey' | 'fileName' | 'fileSize' | 'fileLastModified' | 'fileMimeType'>
): Promise<string> {
  const cacheKey = await buildCacheKey(file);

  // Store metadata in IndexedDB
  const record: CachedTrackMeta = {
    ...meta,
    cacheKey,
    fileName: file.name,
    fileSize: file.size,
    fileLastModified: file.lastModified,
    fileMimeType: file.type || 'audio/mpeg',
  };
  await idbPut(STORES.TRACKS, record);

  // Store audio blob in Cache API (async, don't block)
  cacheAudioBlob(cacheKey, file).catch(err =>
    logger.error('Background audio blob caching failed:', err)
  );

  return cacheKey;
}

/** Get all cached track metadata, ordered by playlist order */
export async function getAllCachedTracks(): Promise<CachedTrackMeta[]> {
  try {
    const tracks = await idbGetAllByIndex<CachedTrackMeta>(STORES.TRACKS, 'playlistOrder');
    logger.info(`Loaded ${tracks.length} cached track(s) from IndexedDB`);
    return tracks;
  } catch (error) {
    logger.error('Failed to load cached tracks:', error);
    return [];
  }
}

/** Update a track's playlist order */
export async function updateTrackOrder(cacheKey: string, playlistOrder: number): Promise<void> {
  const meta = await idbGet<CachedTrackMeta>(STORES.TRACKS, cacheKey);
  if (meta) {
    meta.playlistOrder = playlistOrder;
    await idbPut(STORES.TRACKS, meta);
  }
}

/** Batch update playlist order for all tracks */
export async function updatePlaylistOrder(orderedCacheKeys: string[]): Promise<void> {
  const db = await openDB();
  const orderMap = new Map(orderedCacheKeys.map((key, index) => [key, index]));
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRACKS, 'readwrite');
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

/** Remove a track from cache (metadata + audio blob) */
export async function removeCachedTrack(cacheKey: string): Promise<void> {
  try {
    await idbDelete(STORES.TRACKS, cacheKey);
    await deleteAudioBlob(cacheKey);
    logger.debug(`Removed cached track: ${cacheKey}`);
  } catch (error) {
    logger.error('Failed to remove cached track:', error);
  }
}

/** Remove all cached tracks and associated data */
export async function clearAllCachedTracks(): Promise<void> {
  try {
    const db = await openDB();

    // Clear tracks store
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.TRACKS, 'readwrite');
      const req = tx.objectStore(STORES.TRACKS).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Clear audio cache
    await caches.delete(AUDIO_CACHE_NAME);

    logger.info('Cleared all cached tracks and data');
  } catch (error) {
    logger.error('Failed to clear all caches:', error);
  }
}

// ─── Configuration Cache ─────────────────────────────────────────────────────

/** Save a configuration value */
export async function saveConfig(key: string, value: unknown): Promise<void> {
  try {
    await idbPut(STORES.CONFIG, { key, value });
  } catch (error) {
    logger.error(`Failed to save config "${key}":`, error);
  }
}

/** Load a configuration value */
export async function loadConfig<T>(key: string): Promise<T | null> {
  try {
    const entry = await idbGet<{ key: string; value: T }>(STORES.CONFIG, key);
    return entry?.value ?? null;
  } catch {
    return null;
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
 * Initialize the cache system.
 * Safe to call multiple times — will only run once.
 */
export function initCache(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await openDB();
      logger.info('Cache system initialized');

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
 * Check if a track is cached (has metadata in IndexedDB)
 */
export async function isTrackCached(file: File): Promise<boolean> {
  const cacheKey = await buildCacheKey(file);
  const meta = await idbGet<CachedTrackMeta>(STORES.TRACKS, cacheKey);
  return !!meta;
}

/**
 * Get the total number of cached tracks
 */
export async function getCachedTrackCount(): Promise<number> {
  return idbCount(STORES.TRACKS);
}
