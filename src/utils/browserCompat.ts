/**
 * Browser compatibility utilities
 * Checks for required Web APIs and provides fallback messages
 */

import { createLogger } from './logger';

const logger = createLogger('BrowserCompat');

// Type definition for webkit-prefixed AudioContext
interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Check if Web Audio API is supported
 */
export function isWebAudioSupported(): boolean {
  return typeof window !== 'undefined' && 
    (window.AudioContext !== undefined || 
     (window as WindowWithWebkit).webkitAudioContext !== undefined);
}

/**
 * Check if Media Session API is supported
 */
export function isMediaSessionSupported(): boolean {
  return typeof window !== 'undefined' && 
    'mediaSession' in navigator;
}

/**
 * Check if File API is supported
 */
export function isFileAPISupported(): boolean {
  return typeof window !== 'undefined' && 
    typeof File !== 'undefined' && 
    typeof FileList !== 'undefined' && 
    typeof FileReader !== 'undefined';
}

/**
 * Check if Drag and Drop API is supported
 * Checks for comprehensive drag and drop event support
 */
export function isDragDropSupported(): boolean {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  return div !== null && 
    ('draggable' in div || 
     ('ondragstart' in div && 'ondrop' in div && 'ondragover' in div));
}

/**
 * Check if LocalStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if browser supports required audio formats
 */
export function getSupportedAudioFormats(): Record<string, boolean> {
  if (typeof document === 'undefined') return {};
  
  const audio = document.createElement('audio');
  
  return {
    mp3: !!audio.canPlayType('audio/mpeg'),
    aac: !!audio.canPlayType('audio/aac') || !!audio.canPlayType('audio/mp4'),
    ogg: !!audio.canPlayType('audio/ogg'),
    opus: !!audio.canPlayType('audio/opus') || !!audio.canPlayType('audio/ogg; codecs="opus"'),
    wav: !!audio.canPlayType('audio/wav'),
    flac: !!audio.canPlayType('audio/flac'),
    webm: !!audio.canPlayType('audio/webm'),
  };
}

export interface BrowserCompatibilityResult {
  compatible: boolean;
  warnings: string[];
  errors: string[];
  features: {
    webAudio: boolean;
    mediaSession: boolean;
    fileAPI: boolean;
    dragDrop: boolean;
    localStorage: boolean;
  };
  audioFormats: Record<string, boolean>;
}

/**
 * Comprehensive browser compatibility check
 */
export function checkBrowserCompatibility(): BrowserCompatibilityResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check critical features
  const webAudio = isWebAudioSupported();
  const fileAPI = isFileAPISupported();
  const localStorage = isLocalStorageAvailable();
  
  // Check optional features
  const mediaSession = isMediaSessionSupported();
  const dragDrop = isDragDropSupported();
  
  // Check audio format support
  const audioFormats = getSupportedAudioFormats();
  
  // Validate critical features
  if (!webAudio) {
    errors.push('Web Audio API is not supported. Advanced audio features like the equalizer will not work.');
  }
  
  if (!fileAPI) {
    errors.push('File API is not supported. You will not be able to upload audio files.');
  }
  
  // Validate optional features
  if (!localStorage) {
    warnings.push('LocalStorage is not available. Your settings and preferences will not be saved.');
  }
  
  if (!mediaSession) {
    warnings.push('Media Session API is not supported. Browser/OS media controls will not work.');
  }
  
  if (!dragDrop) {
    warnings.push('Drag and Drop is not supported. You will need to use the file picker to upload files.');
  }
  
  // Check if at least one major audio format is supported
  const majorFormats = ['mp3', 'aac', 'ogg', 'wav'] as const;
  const hasMajorFormat = majorFormats.some(format => audioFormats[format]);
  if (!hasMajorFormat) {
    errors.push('No major audio formats are supported by your browser. The player will not work properly.');
  }
  
  // Log results
  const compatible = errors.length === 0;
  
  if (compatible) {
    logger.info('Browser compatibility check passed');
    if (warnings.length > 0) {
      logger.warn('Browser compatibility warnings:', warnings);
    }
  } else {
    logger.error('Browser compatibility check failed:', errors);
  }
  
  return {
    compatible,
    warnings,
    errors,
    features: {
      webAudio,
      mediaSession,
      fileAPI,
      dragDrop,
      localStorage,
    },
    audioFormats,
  };
}

/**
 * Get a user-friendly browser name
 */
export function getBrowserInfo(): { name: string; version: string; mobile: boolean } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { name: 'Unknown', version: 'Unknown', mobile: false };
  }
  
  const userAgent = navigator.userAgent;
  const mobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  
  let name = 'Unknown';
  let version = 'Unknown';
  
  // Detect browser
  if (userAgent.indexOf('Firefox') > -1) {
    name = 'Firefox';
    version = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
  } else if (userAgent.indexOf('Edg') > -1) {
    name = 'Edge';
    version = userAgent.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
  } else if (userAgent.indexOf('Chrome') > -1) {
    name = 'Chrome';
    version = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
  } else if (userAgent.indexOf('Safari') > -1) {
    name = 'Safari';
    version = userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown';
  } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
    name = 'Opera';
    version = userAgent.match(/(?:Opera|OPR)\/(\d+)/)?.[1] || 'Unknown';
  }
  
  return { name, version, mobile };
}
