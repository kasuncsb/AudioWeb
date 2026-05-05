/**
 * AudioWeb Configuration and Constants
 * Centralized configuration for audio formats, MIME types, and application settings
 */

/**
 * Comprehensive audio format support
 * Includes lossy, lossless, and various codec formats
 */
export const AUDIO_FORMATS = {
  // Lossy formats
  MP3: { extension: '.mp3', mimeTypes: ['audio/mpeg', 'audio/mp3'], description: 'MPEG Audio Layer III' },
  AAC: { extension: '.aac', mimeTypes: ['audio/aac', 'audio/aacp', 'audio/x-aac'], description: 'Advanced Audio Coding' },
  M4A: { extension: '.m4a', mimeTypes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'], description: 'MPEG-4 Audio' },
  OGG: { extension: '.ogg', mimeTypes: ['audio/ogg', 'audio/vorbis', 'application/ogg'], description: 'Ogg Vorbis' },
  OPUS: { extension: '.opus', mimeTypes: ['audio/opus', 'audio/ogg; codecs=opus'], description: 'Opus Audio Codec' },
  WEBM: { extension: '.webm', mimeTypes: ['audio/webm'], description: 'WebM Audio' },
  WMA: { extension: '.wma', mimeTypes: ['audio/x-ms-wma'], description: 'Windows Media Audio' },

  // Lossless formats
  FLAC: { extension: '.flac', mimeTypes: ['audio/flac', 'audio/x-flac'], description: 'Free Lossless Audio Codec' },
  WAV: { extension: '.wav', mimeTypes: ['audio/wav', 'audio/wave', 'audio/x-wav'], description: 'Waveform Audio File Format' },
  AIFF: { extension: '.aiff', mimeTypes: ['audio/aiff', 'audio/x-aiff'], description: 'Audio Interchange File Format' },
  AIFC: { extension: '.aifc', mimeTypes: ['audio/x-aifc'], description: 'Compressed AIFF' },
  APE: { extension: '.ape', mimeTypes: ['audio/ape', 'audio/x-ape'], description: "Monkey's Audio" },
  ALAC: { extension: '.m4a', mimeTypes: ['audio/mp4', 'audio/x-m4a'], description: 'Apple Lossless Audio Codec' },
  WV: { extension: '.wv', mimeTypes: ['audio/x-wavpack'], description: 'WavPack' },
  TTA: { extension: '.tta', mimeTypes: ['audio/x-tta'], description: 'True Audio' },

  // Module and tracker formats
  MOD: { extension: '.mod', mimeTypes: ['audio/mod', 'audio/x-mod'], description: 'Module Audio' },
  S3M: { extension: '.s3m', mimeTypes: ['audio/s3m', 'audio/x-s3m'], description: 'ScreamTracker 3 Module' },
  XM: { extension: '.xm', mimeTypes: ['audio/xm', 'audio/x-xm'], description: 'Extended Module' },
  IT: { extension: '.it', mimeTypes: ['audio/it', 'audio/x-it'], description: 'Impulse Tracker Module' },

  // Other formats
  MID: { extension: '.mid', mimeTypes: ['audio/midi', 'audio/x-midi'], description: 'Musical Instrument Digital Interface' },
  MIDI: { extension: '.midi', mimeTypes: ['audio/midi', 'audio/x-midi'], description: 'Musical Instrument Digital Interface' },
  AU: { extension: '.au', mimeTypes: ['audio/basic', 'audio/x-au'], description: 'Sun Audio Format' },
  RA: { extension: '.ra', mimeTypes: ['audio/x-realaudio', 'audio/x-pn-realaudio'], description: 'RealAudio' },
  RAM: { extension: '.ram', mimeTypes: ['audio/x-pn-realaudio'], description: 'RealAudio Metadata' },
  AMR: { extension: '.amr', mimeTypes: ['audio/amr', 'audio/3gpp'], description: 'Adaptive Multi-Rate' },
  THREE_GP: { extension: '.3gp', mimeTypes: ['audio/3gpp', 'audio/3gpp2'], description: '3GPP Audio' },
} as const;

/**
 * All supported MIME types for audio file validation
 * Used in file validation and file input accept attribute
 */
export const SUPPORTED_MIME_TYPES = Object.values(AUDIO_FORMATS).flatMap(format => format.mimeTypes);

/**
 * All supported file extensions
 * Used in file validation and file input accept attribute
 */
export const SUPPORTED_EXTENSIONS = Object.values(AUDIO_FORMATS).map(format => format.extension);

/**
 * Lyrics file formats
 */
export const LYRICS_FORMATS = {
  LRC: { extension: '.lrc', mimeType: 'text/plain', description: 'LRC Synchronized Lyrics' },
  TXT: { extension: '.txt', mimeType: 'text/plain', description: 'Plain Text Lyrics' },
} as const;

/**
 * Comprehensive metadata tag support
 * Maps common tag names to their standardized internal representation
 */
export const METADATA_TAGS = {
  // Basic tags
  TITLE: ['title', 'TIT2', 'TITLE'],
  ARTIST: ['artist', 'TPE1', 'ARTIST', 'Author'],
  ALBUM: ['album', 'TALB', 'ALBUM'],
  ALBUM_ARTIST: ['albumArtist', 'TPE2', 'ALBUMARTIST', 'album artist'],
  YEAR: ['year', 'date', 'TDRC', 'TYER', 'YEAR', 'DATE'],
  GENRE: ['genre', 'TCON', 'GENRE'],

  // Extended tags
  COMPOSER: ['composer', 'TCOM', 'COMPOSER'],
  CONDUCTOR: ['conductor', 'TPE3', 'CONDUCTOR'],
  LYRICIST: ['lyricist', 'TEXT', 'LYRICIST'],
  PERFORMER: ['performer', 'TPE3', 'PERFORMER'],

  // Track information
  TRACK_NUMBER: ['track', 'TRCK', 'TRACKNUMBER', 'trackNumber'],
  TRACK_TOTAL: ['trackTotal', 'TRCK', 'TOTALTRACKS', 'totalTracks'],
  DISC_NUMBER: ['disc', 'TPOS', 'DISCNUMBER', 'discNumber'],
  DISC_TOTAL: ['discTotal', 'TPOS', 'TOTALDISCS', 'totalDiscs'],

  // Audio quality information
  BIT_RATE: ['bitrate', 'BITRATE'],
  SAMPLE_RATE: ['sampleRate', 'SAMPLERATE'],
  CHANNELS: ['channels', 'CHANNELS'],
  CODEC: ['codec', 'ENCODER', 'encoder'],

  // Additional metadata
  COPYRIGHT: ['copyright', 'TCOP', 'COPYRIGHT'],
  PUBLISHER: ['publisher', 'TPUB', 'PUBLISHER'],
  COMMENT: ['comment', 'COMM', 'COMMENT'],
  DESCRIPTION: ['description', 'DESCRIPTION'],
  ISRC: ['isrc', 'TSRC', 'ISRC'], // International Standard Recording Code
  BARCODE: ['barcode', 'BARCODE', 'UPC', 'EAN'],
  CATALOG_NUMBER: ['catalogNumber', 'CATALOGNUMBER'],

  // ReplayGain for volume normalization
  REPLAYGAIN_TRACK_GAIN: ['replaygain_track_gain', 'REPLAYGAIN_TRACK_GAIN'],
  REPLAYGAIN_TRACK_PEAK: ['replaygain_track_peak', 'REPLAYGAIN_TRACK_PEAK'],
  REPLAYGAIN_ALBUM_GAIN: ['replaygain_album_gain', 'REPLAYGAIN_ALBUM_GAIN'],
  REPLAYGAIN_ALBUM_PEAK: ['replaygain_album_peak', 'REPLAYGAIN_ALBUM_PEAK'],

  // Ratings and mood
  RATING: ['rating', 'POPM', 'RATING'],
  MOOD: ['mood', 'MOOD'],
  BPM: ['bpm', 'TBPM', 'BPM'],
  KEY: ['key', 'TKEY', 'KEY'],

  // Lyrics
  LYRICS: ['lyrics', 'USLT', 'LYRICS'],
  SYNCED_LYRICS: ['syncedLyrics', 'SYLT'],
} as const;

/**
 * Audio quality presets
 */
export const AUDIO_QUALITY = {
  LOW: { bitrate: 64, sampleRate: 22050, description: 'Low Quality (64 kbps)' },
  MEDIUM: { bitrate: 128, sampleRate: 44100, description: 'Medium Quality (128 kbps)' },
  HIGH: { bitrate: 192, sampleRate: 44100, description: 'High Quality (192 kbps)' },
  VERY_HIGH: { bitrate: 320, sampleRate: 44100, description: 'Very High Quality (320 kbps)' },
  LOSSLESS: { bitrate: null, sampleRate: 44100, description: 'Lossless (FLAC, ALAC, etc.)' },
  HI_RES: { bitrate: null, sampleRate: 96000, description: 'Hi-Res Audio (≥96 kHz)' },
} as const;

/**
 * Equalizer frequency bands (10-band professional EQ)
 * ISO standard frequencies optimized for music production
 * Q values: 1.41 for precise peaking, 0.7 for smooth shelving
 */
export const EQUALIZER_BANDS = [
  { frequency: 32, label: '32 Hz', description: 'Sub Bass', q: 0.7, key: 'band32' as const },
  { frequency: 64, label: '64 Hz', description: 'Bass', q: 1.41, key: 'band64' as const },
  { frequency: 125, label: '125 Hz', description: 'Bass/Low Mid', q: 1.41, key: 'band125' as const },
  { frequency: 250, label: '250 Hz', description: 'Low Mid', q: 1.41, key: 'band250' as const },
  { frequency: 500, label: '500 Hz', description: 'Mid', q: 1.41, key: 'band500' as const },
  { frequency: 1000, label: '1 kHz', description: 'Mid', q: 1.41, key: 'band1k' as const },
  { frequency: 2000, label: '2 kHz', description: 'Upper Mid', q: 1.41, key: 'band2k' as const },
  { frequency: 4000, label: '4 kHz', description: 'Presence', q: 1.41, key: 'band4k' as const },
  { frequency: 8000, label: '8 kHz', description: 'Brilliance', q: 1.41, key: 'band8k' as const },
  { frequency: 16000, label: '16 kHz', description: 'Air', q: 0.7, key: 'band16k' as const },
] as const;

/**
 * Equalizer presets with gain values for each band
 * Optimized for studio-level audio chain with compressor, exciter, and limiter
 * Gain values in dB (-12 to +12 for studio-grade control)
 * Order: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz
 * Plus bassTone and trebleTone (bassTone drives low-end, trebleTone drives exciter)
 */
export const EQUALIZER_PRESETS = {
  flat: {
    name: 'Flat',
    description: 'No equalization - pure audio',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassTone: 0,
    trebleTone: 0,
  },
  rock: {
    name: 'Rock',
    description: 'Punchy bass, scooped mids, aggressive highs',
    gains: [4, 5, 3, 1, -1, 0, 2, 4, 5, 4],
    bassTone: 6,  // Strong bass foundation
    trebleTone: 7, // Aggressive treble with exciter
  },
  pop: {
    name: 'Pop',
    description: 'Balanced with enhanced presence and sparkle',
    gains: [2, 3, 2, 1, 0, 1, 3, 4, 3, 2],
    bassTone: 4,  // Moderate bass
    trebleTone: 5, // Bright with good exciter presence
  },
  jazz: {
    name: 'Jazz',
    description: 'Warm, natural with silky highs',
    gains: [2, 3, 4, 3, 2, 1, 2, 3, 4, 5],
    bassTone: 3,  // Natural warmth
    trebleTone: 4, // Smooth high-end extension
  },
  classical: {
    name: 'Classical',
    description: 'Natural dynamics with extended air',
    gains: [1, 2, 2, 1, 0, 1, 2, 4, 5, 6],
    bassTone: 2,  // Subtle foundation
    trebleTone: 6, // Extended air frequencies
  },
  electronic: {
    name: 'Electronic',
    description: 'Deep sub-bass with crystalline highs',
    gains: [6, 6, 4, 2, 0, 1, 3, 4, 5, 4],
    bassTone: 8,  // Maximum sub-bass impact
    trebleTone: 6, // Crystal clarity
  },
  vocal: {
    name: 'Vocal',
    description: 'Optimized clarity and presence for voices',
    gains: [-2, -1, 1, 3, 5, 4, 3, 3, 2, 1],
    bassTone: -2, // Reduce bass rumble
    trebleTone: 4, // Clear, articulate highs
  },
  bass_boost: {
    name: 'Bass Boost',
    description: 'Maximum low-end impact and power',
    gains: [8, 7, 5, 3, 1, 0, 0, 1, 1, 0],
    bassTone: 10, // Extreme bass with headroom
    trebleTone: 2, // Balanced highs
  },
  treble_boost: {
    name: 'Treble Boost',
    description: 'Crystal clear, enhanced high frequencies',
    gains: [0, 0, 0, 1, 2, 3, 4, 6, 7, 6],
    bassTone: 0,  // Neutral bass
    trebleTone: 9, // Maximum exciter engagement
  },
  acoustic: {
    name: 'Acoustic',
    description: 'Natural warmth with organic presence',
    gains: [3, 4, 4, 3, 2, 2, 3, 4, 4, 3],
    bassTone: 5,  // Warm body
    trebleTone: 5, // Natural air
  },
  lounge: {
    name: 'Lounge',
    description: 'Smooth, relaxed, easy listening',
    gains: [3, 4, 3, 2, 1, 0, 1, 2, 3, 2],
    bassTone: 5,  // Comfortable warmth
    trebleTone: 3, // Gentle highs
  },
  podcast: {
    name: 'Podcast',
    description: 'Optimized for spoken word clarity',
    gains: [-3, -2, 0, 4, 6, 6, 4, 3, 1, 0],
    bassTone: -3, // Remove low-end rumble
    trebleTone: 4, // Clear articulation
  },
  dance: {
    name: 'Dance',
    description: 'Club-ready bass with energetic highs',
    gains: [7, 7, 5, 2, 0, 1, 3, 4, 5, 3],
    bassTone: 9,  // Powerful club bass
    trebleTone: 6, // Energetic presence
  },
  hip_hop: {
    name: 'Hip Hop',
    description: 'Deep bass with punchy midrange',
    gains: [7, 8, 6, 3, 1, 2, 2, 3, 2, 1],
    bassTone: 8,  // Deep, powerful bass
    trebleTone: 3, // Punchy but not harsh
  },
  metal: {
    name: 'Metal',
    description: 'Aggressive with powerful dynamics',
    gains: [5, 4, 3, -1, -2, 1, 3, 5, 6, 4],
    bassTone: 6,  // Tight, powerful low-end
    trebleTone: 7, // Aggressive, cutting highs
  },
} as const;

/**
 * Application feature flags
 */
export const FEATURES = {
  ENABLE_EQUALIZER: true,
  ENABLE_LYRICS: true,
  ENABLE_VISUALIZATION: false, // Not implemented yet
  ENABLE_CROSSFADE: false, // Not implemented yet
  ENABLE_GAPLESS_PLAYBACK: false, // Not implemented yet
  ENABLE_REPLAYGAIN: false, // Not implemented yet
  ENABLE_MEDIA_SESSION: true,
  ENABLE_KEYBOARD_SHORTCUTS: true,
  ENABLE_DRAG_DROP: true,
} as const;

/**
 * Performance settings
 */
export const PERFORMANCE = {
  // Maximum number of tracks to render without virtualization
  MAX_PLAYLIST_SIZE_WITHOUT_VIRTUALIZATION: 100,

  // Metadata extraction timeout (ms)
  METADATA_EXTRACTION_TIMEOUT: 10000,

  // Album art maximum size (bytes) - 5MB
  MAX_ALBUM_ART_SIZE: 5 * 1024 * 1024,

  // Album art maximum dimensions (pixels)
  MAX_ALBUM_ART_DIMENSIONS: { width: 2000, height: 2000 },

  // Number of tracks to process in parallel
  PARALLEL_METADATA_EXTRACTION: 3,

  // Audio buffer size for Web Audio API (larger = better performance, higher latency)
  AUDIO_BUFFER_SIZE: 2048,

  // Enable Web Worker for metadata extraction
  USE_WEB_WORKER_FOR_METADATA: false, // To be implemented
} as const;

/**
 * UI Configuration
 */
export const UI_CONFIG = {
  // Animation durations (ms)
  ANIMATION_DURATION: {
    SHORT: 150,
    MEDIUM: 300,
    LONG: 500,
  },

  // Debounce delays (ms)
  DEBOUNCE_DELAY: {
    SEARCH: 300,
    PROGRESS_UPDATE: 100,
    VOLUME_CHANGE: 50,
  },

  // Playlist settings
  PLAYLIST: {
    MAX_TITLE_LENGTH: 50,
    MAX_ARTIST_LENGTH: 40,
    SHOW_TRACK_NUMBERS: true,
    SHOW_DURATION: true,
  },

  // Sleep timer presets (minutes)
  SLEEP_TIMER_PRESETS: [5, 10, 15, 30, 45, 60, 90, 120],

  // Volume control
  VOLUME: {
    DEFAULT: 66,
    MIN: 0,
    MAX: 100,
    STEP: 5,
  },
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  // File handling errors
  UNSUPPORTED_FILE_TYPE: 'Unsupported audio file format. Please use MP3, FLAC, WAV, OGG, or other supported formats.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  FILE_READ_ERROR: 'Unable to read the audio file. The file may be corrupted.',

  // Metadata errors
  METADATA_EXTRACTION_FAILED: 'Unable to extract metadata from the audio file.',
  CORRUPTED_METADATA: 'The audio file contains corrupted metadata.',

  // Playback errors
  AUDIO_LOAD_ERROR: 'Failed to load audio file. The file may be corrupted or in an unsupported format.',
  AUDIO_DECODE_ERROR: 'Unable to decode audio file. The codec may not be supported by your browser.',
  AUDIO_NETWORK_ERROR: 'Network error while loading audio file.',
  AUDIO_ABORT_ERROR: 'Audio loading was aborted.',
  AUDIO_NOT_SUPPORTED: 'Your browser does not support this audio format.',

  // Web Audio API errors
  WEB_AUDIO_NOT_SUPPORTED: 'Web Audio API is not supported in your browser. Advanced features like the equalizer may not work.',
  AUDIO_CONTEXT_ERROR: 'Failed to initialize audio context.',

  // General errors
  UNKNOWN_ERROR: 'An unknown error occurred.',
  BROWSER_NOT_SUPPORTED: 'Your browser does not support all required features.',
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  TRACKS_ADDED: (count: number) => `Successfully added ${count} track${count > 1 ? 's' : ''} to playlist.`,
  TRACK_REMOVED: 'Track removed from playlist.',
  PLAYLIST_CLEARED: 'Playlist cleared.',
  METADATA_LOADED: 'Metadata loaded successfully.',
} as const;

/**
 * Keyboard shortcuts configuration
 */
export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: ' ', // Spacebar
  NEXT_TRACK: 'ArrowRight',
  PREVIOUS_TRACK: 'ArrowLeft',
  VOLUME_UP: 'ArrowUp',
  VOLUME_DOWN: 'ArrowDown',
  MUTE: 'm',
  SHUFFLE: 's',
  REPEAT: 'r',
  FULLSCREEN: 'f',
  ESCAPE: 'Escape',
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  VOLUME: 'aw_volume',
  REPEAT_MODE: 'aw_repeat_mode',
  SHUFFLE_MODE: 'aw_shuffle_mode',
  EQUALIZER_SETTINGS: 'aw_equalizer',
  THEME: 'aw_theme',
  PLAYLIST: 'aw_playlist', // Note: May not persist File objects
  VISUALIZER_SETTINGS: 'aw_visualizer',
  LAST_TRACK_KEY: 'aw_last_track',
  LAST_POSITION: 'aw_last_pos',
} as const;

/**
 * Logging levels
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

/**
 * Adaptive EQ frequency cache settings
 */
export const FREQUENCY_CACHE_MAX_SIZE = 50;

/**
 * Loudness normalizer settings
 * Target and guard values are intentionally conservative for transparent playback.
 */
export const LOUDNESS_TARGET_DBFS = -14.5;         // Upward normalization target (RMS proxy)
export const NORMALIZER_GAIN_MIN_DB = 0;           // Do not cut loud tracks
export const NORMALIZER_GAIN_MAX_DB = 10;          // Cap boost for transparency
export const NORMALIZER_RAMP_TIME_SEC = 0.18;      // Faster but click-free transition
export const NORMALIZER_ANALYSIS_WINDOW_SEC = 0.35; // Short-term loudness window
export const NORMALIZER_ANALYSIS_SAMPLE_POINTS = 80;
export const NORMALIZER_NOISE_FLOOR_DBFS = -52;    // Ignore near-silence sections
export const NORMALIZER_PEAK_HEADROOM_DB = 1;      // Keep ~1dB headroom before limiter

/**
 * Development mode flag
 */
export const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Enable debug logging (only in development)
 */
//export const DEBUG_LOGGING = IS_DEV;
export const DEBUG_LOGGING = false;