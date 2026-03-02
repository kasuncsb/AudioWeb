/**
 * AudioWeb Cache Manager
 *
 * Provides persistent browser caching for audio tracks, metadata, album art,
 * frequency analysis results, and user configuration using:
 *  - Cache API  → audio file blobs (optimized for large binary streaming)
 *  - IndexedDB  → track metadata, album art (deduplicated), frequency analysis, config
 *
 * Design principles:
 *  - Two-phase load: metadata first (instant), blobs on-demand (lazy)
 *  - Only current + next track blob URLs alive at any time (memory-safe for 2GB devices)
 *  - LRU eviction when quota runs low
 *  - Album art deduplicated by SHA-256 hash
 */

import { createLogger } from './logger';

const logger = createLogger('CacheManager');

// ─── Constants ───────────────────────────────────────────────────────────────

const DB_NAME = 'aw-cache';
const DB_VERSION = 1;

/** IndexedDB store names */
const STORES = {
  TRACKS: 'tracks',
  ALBUM_ART: 'albumArt',
  FREQUENCY: 'frequency',
  CONFIG: 'config',
} as const;

/** Cache API cache name for audio blobs */
const AUDIO_CACHE_NAME = 'aw-audio-v1';

/** Prefix for Cache API keys so they look like URLs */
const CACHE_KEY_PREFIX = '/aw-cache/audio/';

/** Maximum cache size in bytes before LRU eviction kicks in (500 MB) */
const MAX_CACHE_BYTES = 500 * 1024 * 1024;

/** Minimum free quota percentage before eviction triggers */
const EVICTION_THRESHOLD_PERCENT = 15;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Composite key used to uniquely identify an audio file */
export interface TrackCacheKey {
  name: string;
  size: number;
  lastModified: number;
}

/** Metadata stored in IndexedDB for each cached track */
export interface CachedTrackMeta {
  /** Composite key string: "name|size|lastModified" */
  cacheKey: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  /** SHA-256 hash of album art blob (references albumArt store) */
  albumArtHash?: string;
  /** Plain text lyrics */
  lyrics?: string;
  /** Serialized LRC lyrics (JSON array of {time, text}) */
  lrcLyricsJson?: string;
  /** Full AudioMetadata as JSON string */
  metadataJson?: string;
  /** Playlist order index for restoration */
  playlistOrder: number;
  /** Last time this track was played (for LRU eviction) */
  lastPlayedAt: number;
  /** Original file MIME type (for reconstructing File from blob) */
  fileMimeType: string;
  /** Original file name */
  fileName: string;
  /** Original file size in bytes */
  fileSize: number;
  /** Original file lastModified timestamp */
  fileLastModified: number;
}

/** Frequency analysis result stored per track */
export interface CachedFrequency {
  cacheKey: string;
  bassPeak: number;
  subPeak: number;
  treblePeak: number;
  confidence: number;
}

/** Album art entry (deduplicated by hash) */
export interface CachedAlbumArt {
  hash: string;
  blob: Blob;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a composite cache key string from file properties */
export function buildCacheKey(file: File): string;
export function buildCacheKey(key: TrackCacheKey): string;
export function buildCacheKey(input: File | TrackCacheKey): string {
  if (input instanceof File) {
    return `${input.name}|${input.size}|${input.lastModified}`;
  }
  return `${input.name}|${input.size}|${input.lastModified}`;
}

/** Parse a composite cache key string back into parts */
export function parseCacheKey(key: string): TrackCacheKey {
  const parts = key.split('|');
  return {
    name: parts[0],
    size: parseInt(parts[1], 10),
    lastModified: parseInt(parts[2], 10),
  };
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

    request.onupgradeneeded = () => {
      const db = request.result;

      // Tracks store
      if (!db.objectStoreNames.contains(STORES.TRACKS)) {
        const trackStore = db.createObjectStore(STORES.TRACKS, { keyPath: 'cacheKey' });
        trackStore.createIndex('playlistOrder', 'playlistOrder', { unique: false });
        trackStore.createIndex('lastPlayedAt', 'lastPlayedAt', { unique: false });
        trackStore.createIndex('albumArtHash', 'albumArtHash', { unique: false });
      }

      // Album art store (deduplicated by SHA-256 hash)
      if (!db.objectStoreNames.contains(STORES.ALBUM_ART)) {
        db.createObjectStore(STORES.ALBUM_ART, { keyPath: 'hash' });
      }

      // Frequency analysis cache
      if (!db.objectStoreNames.contains(STORES.FREQUENCY)) {
        db.createObjectStore(STORES.FREQUENCY, { keyPath: 'cacheKey' });
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

/** Get all records from a store */
async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
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
    const url = CACHE_KEY_PREFIX + encodeURIComponent(cacheKey);
    const response = new Response(file, {
      headers: {
        'Content-Type': file.type || 'audio/mpeg',
        'Content-Length': String(file.size),
        // Note: X-Cache-Key header removed — non-ASCII filenames cause Response constructor to fail
        // The cache key is already encoded in the URL path
      },
    });
    await cache.put(url, response);
    logger.debug(`Cached audio blob: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  } catch (error) {
    logger.error('Failed to cache audio blob:', error);
  }
}

/** Retrieve an audio file blob from Cache API */
async function getAudioBlob(cacheKey: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const url = CACHE_KEY_PREFIX + encodeURIComponent(cacheKey);
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
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const url = CACHE_KEY_PREFIX + encodeURIComponent(cacheKey);
    await cache.delete(url);
  } catch (error) {
    logger.error('Failed to delete audio blob:', error);
  }
}

// ─── Album Art (deduplicated) ────────────────────────────────────────────────

/**
 * Store album art with deduplication.
 * Returns the SHA-256 hash used as key, or undefined if no art.
 */
export async function cacheAlbumArt(artBlob: Blob): Promise<string> {
  const buffer = await artBlob.arrayBuffer();
  const hash = await sha256(buffer);

  // Check if already stored
  const existing = await idbGet<CachedAlbumArt>(STORES.ALBUM_ART, hash);
  if (existing) {
    logger.debug(`Album art already cached (dedup hit): ${hash.slice(0, 8)}…`);
    return hash;
  }

  await idbPut(STORES.ALBUM_ART, { hash, blob: artBlob });
  logger.debug(`Cached album art: ${hash.slice(0, 8)}… (${(artBlob.size / 1024).toFixed(1)}KB)`);
  return hash;
}

/** Retrieve album art blob by hash */
export async function getAlbumArt(hash: string): Promise<Blob | null> {
  const entry = await idbGet<CachedAlbumArt>(STORES.ALBUM_ART, hash);
  return entry?.blob ?? null;
}

/**
 * Clean up orphaned album art entries that no tracks reference.
 * Export for use when tracks are manually removed.
 */
export async function cleanOrphanedAlbumArt(): Promise<void> {
  try {
    const tracks = await idbGetAll<CachedTrackMeta>(STORES.TRACKS);
    const usedHashes = new Set(tracks.map(t => t.albumArtHash).filter(Boolean));

    const allArt = await idbGetAll<CachedAlbumArt>(STORES.ALBUM_ART);
    let removed = 0;
    for (const art of allArt) {
      if (!usedHashes.has(art.hash)) {
        await idbDelete(STORES.ALBUM_ART, art.hash);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`Cleaned ${removed} orphaned album art entries`);
    }
  } catch (error) {
    logger.error('Failed to clean orphaned album art:', error);
  }
}

// ─── Track Metadata ──────────────────────────────────────────────────────────

/** Cache a track's metadata and audio blob */
export async function cacheTrack(
  file: File,
  meta: Omit<CachedTrackMeta, 'cacheKey' | 'fileName' | 'fileSize' | 'fileLastModified' | 'fileMimeType'>
): Promise<string> {
  const cacheKey = buildCacheKey(file);

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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.TRACKS, 'readwrite');
    const store = tx.objectStore(STORES.TRACKS);

    let completed = 0;
    for (let i = 0; i < orderedCacheKeys.length; i++) {
      const getReq = store.get(orderedCacheKeys[i]);
      getReq.onsuccess = () => {
        const meta = getReq.result as CachedTrackMeta | undefined;
        if (meta) {
          meta.playlistOrder = i;
          store.put(meta);
        }
        completed++;
        if (completed === orderedCacheKeys.length) {
          // All updates done — transaction will auto-commit
        }
      };
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Update lastPlayedAt for a track (for LRU eviction) */
export async function touchTrack(cacheKey: string): Promise<void> {
  try {
    const meta = await idbGet<CachedTrackMeta>(STORES.TRACKS, cacheKey);
    if (meta) {
      meta.lastPlayedAt = Date.now();
      await idbPut(STORES.TRACKS, meta);
    }
  } catch (error) {
    logger.error('Failed to touch track:', error);
  }
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

    // Clear frequency store
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.FREQUENCY, 'readwrite');
      const req = tx.objectStore(STORES.FREQUENCY).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Clear album art store
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.ALBUM_ART, 'readwrite');
      const req = tx.objectStore(STORES.ALBUM_ART).clear();
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

// ─── Frequency Analysis Cache ────────────────────────────────────────────────

/** Cache frequency analysis result for a track */
export async function cacheFrequencyAnalysis(
  cacheKey: string,
  result: { bassPeak: number; subPeak: number; treblePeak: number; confidence: number }
): Promise<void> {
  try {
    await idbPut(STORES.FREQUENCY, { cacheKey, ...result });
    logger.debug(`Cached frequency analysis for: ${cacheKey.split('|')[0]}`);
  } catch (error) {
    logger.error('Failed to cache frequency analysis:', error);
  }
}

/** Get cached frequency analysis for a track */
export async function getCachedFrequency(cacheKey: string): Promise<CachedFrequency | null> {
  try {
    const entry = await idbGet<CachedFrequency>(STORES.FREQUENCY, cacheKey);
    return entry ?? null;
  } catch {
    return null;
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

// ─── Quota & Eviction ────────────────────────────────────────────────────────

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

/** Request persistent storage to avoid browser auto-eviction */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      logger.info(`Persistent storage ${granted ? 'granted' : 'denied'}`);
      return granted;
    }
  } catch (error) {
    logger.error('Failed to request persistent storage:', error);
  }
  return false;
}

/**
 * Evict least-recently-played tracks until usage is under threshold.
 * Returns the number of tracks evicted.
 */
export async function evictLRU(targetFreeBytes?: number): Promise<number> {
  try {
    const estimate = await getStorageEstimate();

    // Determine if eviction is needed
    const freePercent = 100 - estimate.percentUsed;
    const needsEviction =
      freePercent < EVICTION_THRESHOLD_PERCENT ||
      (targetFreeBytes && (estimate.quota - estimate.usage) < targetFreeBytes);

    if (!needsEviction) return 0;

    // Get tracks sorted by lastPlayedAt ascending (oldest first)
    const tracks = await idbGetAllByIndex<CachedTrackMeta>(STORES.TRACKS, 'lastPlayedAt');

    let evicted = 0;
    let freedBytes = 0;
    const targetFree = targetFreeBytes || MAX_CACHE_BYTES * 0.2; // Free 20% of max cache

    for (const track of tracks) {
      if (freedBytes >= targetFree) break;

      // Don't evict if we only have a few tracks left
      const remaining = await idbCount(STORES.TRACKS);
      if (remaining <= 1) break;

      freedBytes += track.fileSize;
      await removeCachedTrack(track.cacheKey);
      evicted++;
      logger.info(`Evicted: ${track.fileName} (${(track.fileSize / 1024 / 1024).toFixed(1)}MB, last played ${new Date(track.lastPlayedAt).toLocaleDateString()})`);
    }

    // Clean up orphaned album art
    if (evicted > 0) {
      await cleanOrphanedAlbumArt();
    }

    logger.info(`LRU eviction complete: ${evicted} track(s), freed ${(freedBytes / 1024 / 1024).toFixed(1)}MB`);
    return evicted;
  } catch (error) {
    logger.error('LRU eviction failed:', error);
    return 0;
  }
}

/**
 * Ensure there's enough space to cache a file of the given size.
 * Triggers LRU eviction if needed.
 */
export async function ensureSpace(neededBytes: number): Promise<boolean> {
  try {
    const estimate = await getStorageEstimate();
    const available = estimate.quota - estimate.usage;

    if (available > neededBytes * 1.2) return true; // 20% headroom

    // Try to free space
    const evicted = await evictLRU(neededBytes);
    return evicted > 0;
  } catch {
    return true; // Optimistic fallback — let the write attempt proceed
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;

/**
 * Initialize the cache system.
 * Safe to call multiple times — will only run once.
 * Requests persistent storage on first call.
 */
export function initCache(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await openDB();
      logger.info('Cache system initialized');

      // Request persistent storage (non-blocking)
      requestPersistentStorage().catch(() => {});

      // Log storage stats
      const estimate = await getStorageEstimate();
      if (estimate.quota > 0) {
        logger.info(
          `Storage: ${(estimate.usage / 1024 / 1024).toFixed(1)}MB used / ` +
          `${(estimate.quota / 1024 / 1024).toFixed(0)}MB quota ` +
          `(${estimate.percentUsed.toFixed(1)}%)`
        );
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
  const cacheKey = buildCacheKey(file);
  const meta = await idbGet<CachedTrackMeta>(STORES.TRACKS, cacheKey);
  return !!meta;
}

/**
 * Get the total number of cached tracks
 */
export async function getCachedTrackCount(): Promise<number> {
  return idbCount(STORES.TRACKS);
}
