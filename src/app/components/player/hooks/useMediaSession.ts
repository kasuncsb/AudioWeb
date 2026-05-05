import { useEffect, useCallback, useRef } from 'react';
import { AudioTrack } from '../types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('MediaSession');
const POSITION_UPDATE_INTERVAL_MS = 1000;
const FALLBACK_ARTWORK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn6S1UAAAAASUVORK5CYII=';

interface MediaSessionHookProps {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  handlePlay: () => void;
  handlePause: () => void;
  handleNext: () => void;
  handlePrevious: () => void;
  handleSeekTo: (time: number) => void;
  duration: number;
  currentTime: number;
}

export const useMediaSession = ({
  currentTrack,
  isPlaying,
  handlePlay,
  handlePause,
  handleNext,
  handlePrevious,
  handleSeekTo,
  duration,
  currentTime
}: MediaSessionHookProps) => {
  const callbacksRef = useRef({
    handlePlay,
    handlePause,
    handleNext,
    handlePrevious,
    handleSeekTo
  });
  const playbackRef = useRef({
    duration,
    currentTime,
    isPlaying
  });

  useEffect(() => {
    callbacksRef.current = {
      handlePlay,
      handlePause,
      handleNext,
      handlePrevious,
      handleSeekTo
    };
  }, [handlePlay, handlePause, handleNext, handlePrevious, handleSeekTo]);

  useEffect(() => {
    playbackRef.current = {
      duration,
      currentTime,
      isPlaying
    };
  }, [duration, currentTime, isPlaying]);

  const resolveArtworkMime = useCallback((src: string): string | undefined => {
    if (src.startsWith('data:')) {
      const match = src.match(/^data:([^;]+);/i);
      return match?.[1];
    }
    if (src.endsWith('.png')) return 'image/png';
    if (src.endsWith('.webp')) return 'image/webp';
    if (src.endsWith('.svg')) return 'image/svg+xml';
    if (src.endsWith('.jpg') || src.endsWith('.jpeg')) return 'image/jpeg';
    return undefined;
  }, []);

  const buildArtwork = useCallback((track: AudioTrack): MediaImage[] => {
    if (track.albumArt) {
      // Multi-entry strategy for better cross-device compatibility:
      // typed + untyped entries, followed by guaranteed fallbacks.
      const detectedType = resolveArtworkMime(track.albumArt);
      return [
        { src: track.albumArt, sizes: '512x512', type: detectedType ?? 'image/jpeg' },
        { src: track.albumArt, sizes: '256x256', type: detectedType ?? 'image/jpeg' },
        { src: track.albumArt, sizes: '128x128', type: detectedType ?? 'image/jpeg' },
        { src: track.albumArt, sizes: '96x96', type: detectedType ?? 'image/jpeg' },
        { src: track.albumArt, sizes: '512x512' },
        { src: track.albumArt, sizes: '256x256' },
        { src: track.albumArt, sizes: '128x128' },
        { src: track.albumArt, sizes: '96x96' },
        { src: '/images/aw-logo.svg', sizes: '512x512', type: 'image/svg+xml' },
        { src: '/images/aw-logo.svg', sizes: '256x256', type: 'image/svg+xml' },
        { src: '/images/aw-logo.svg', sizes: '128x128', type: 'image/svg+xml' },
        { src: '/images/aw-logo.svg', sizes: '96x96', type: 'image/svg+xml' },
        { src: FALLBACK_ARTWORK_PNG, sizes: '512x512', type: 'image/png' },
        { src: FALLBACK_ARTWORK_PNG, sizes: '256x256', type: 'image/png' },
        { src: FALLBACK_ARTWORK_PNG, sizes: '128x128', type: 'image/png' },
        { src: FALLBACK_ARTWORK_PNG, sizes: '96x96', type: 'image/png' }
      ];
    }

    return [
      { src: '/images/aw-logo.svg', sizes: '512x512', type: 'image/svg+xml' },
      { src: '/images/aw-logo.svg', sizes: '256x256', type: 'image/svg+xml' },
      { src: '/images/aw-logo.svg', sizes: '128x128', type: 'image/svg+xml' },
      { src: '/images/aw-logo.svg', sizes: '96x96', type: 'image/svg+xml' },
      { src: FALLBACK_ARTWORK_PNG, sizes: '512x512', type: 'image/png' },
      { src: FALLBACK_ARTWORK_PNG, sizes: '256x256', type: 'image/png' },
      { src: FALLBACK_ARTWORK_PNG, sizes: '128x128', type: 'image/png' },
      { src: FALLBACK_ARTWORK_PNG, sizes: '96x96', type: 'image/png' }
    ];
  }, [resolveArtworkMime]);

  // Update media metadata when track changes
  const updateMediaMetadata = useCallback(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album: currentTrack.album || 'Unknown Album',
        artwork: buildArtwork(currentTrack)
      });
    } catch (error) {
      logger.warn('Failed to update media metadata:', error);
    }
  }, [currentTrack, buildArtwork]);

  // Update playback state
  const updatePlaybackState = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      const state = isPlaying ? 'playing' : 'paused';
      navigator.mediaSession.playbackState = state;
    } catch (error) {
      logger.warn('Failed to update playback state:', error);
    }
  }, [isPlaying]);

  // Position state update (throttled to avoid excessive calls while keeping mini-player responsive)
  const lastPositionUpdateRef = useRef(0);
  const updatePositionState = useCallback((force = false) => {
    if (!('mediaSession' in navigator) || !Number.isFinite(duration) || duration <= 0) return;

    const now = Date.now();
    if (!force && (now - lastPositionUpdateRef.current < POSITION_UPDATE_INTERVAL_MS)) return;
    lastPositionUpdateRef.current = now;

    try {
      const safePosition = Math.max(0, Math.min(currentTime, duration));
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: isPlaying ? 1.0 : 0.0,
        position: safePosition
      });
    } catch (error) {
      logger.warn('Failed to update position state:', error);
    }
  }, [duration, currentTime, isPlaying]);

  const updatePositionStateRef = useRef(updatePositionState);
  useEffect(() => {
    updatePositionStateRef.current = updatePositionState;
  }, [updatePositionState]);

  // Set up action handlers once; use refs so handlers always see fresh values
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      logger.info('Media Session API not supported in this browser');
      return;
    }

    // Set up media session action handlers
    const actionHandlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => {
        callbacksRef.current.handlePlay();
      }],
      ['pause', () => {
        callbacksRef.current.handlePause();
      }],
      ['nexttrack', () => {
        callbacksRef.current.handleNext();
      }],
      ['previoustrack', () => {
        callbacksRef.current.handlePrevious();
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) {
          callbacksRef.current.handleSeekTo(details.seekTime);
          window.setTimeout(() => updatePositionStateRef.current(true), 0);
        }
      }],
      ['seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        const newTime = Math.max(0, playbackRef.current.currentTime - skipTime);
        callbacksRef.current.handleSeekTo(newTime);
        window.setTimeout(() => updatePositionStateRef.current(true), 0);
      }],
      ['seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        const durationValue = playbackRef.current.duration || 0;
        const newTime = durationValue > 0
          ? Math.min(durationValue, playbackRef.current.currentTime + skipTime)
          : Math.max(0, playbackRef.current.currentTime + skipTime);
        callbacksRef.current.handleSeekTo(newTime);
        window.setTimeout(() => updatePositionStateRef.current(true), 0);
      }]
    ];

    // Register action handlers
    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        logger.warn(`Failed to set ${action} action handler:`, error);
      }
    });

    // Cleanup function to remove action handlers
    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (error) {
          logger.warn(`Failed to remove ${action} action handler:`, error);
        }
      });
    };
  }, []);

  // Update metadata when track changes
  useEffect(() => {
    updateMediaMetadata();
  }, [updateMediaMetadata]);

  // Update playback state when playing state changes
  useEffect(() => {
    updatePlaybackState();
    updatePositionState(true);
  }, [updatePlaybackState, updatePositionState]);

  // Immediate updates for duration/current time transitions and track changes
  useEffect(() => {
    updatePositionState(true);
  }, [duration, currentTrack?.id, updatePositionState]);

  // During playback, refresh at ~1s cadence for notification seekbar reliability
  useEffect(() => {
    if (!isPlaying || !duration || duration <= 0) return;
    const intervalId = window.setInterval(() => {
      updatePositionState(false);
    }, POSITION_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, duration, updatePositionState]);

  // Keep state reasonably fresh while paused/idle too
  useEffect(() => {
    if (isPlaying) return;
    updatePositionState(false);
  }, [isPlaying, currentTime, updatePositionState]);

  // Return functions that can be called externally
  return {
    updateMediaMetadata,
    updatePlaybackState,
    updatePositionState
  };
};
