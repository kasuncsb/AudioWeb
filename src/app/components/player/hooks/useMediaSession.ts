import { useEffect, useCallback, useRef } from 'react';
import { AudioTrack } from '../types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('MediaSession');

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
  
  // Update media metadata when track changes
  const updateMediaMetadata = useCallback(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      // Create artwork array with multiple sizes for better compatibility
      const artwork: MediaImage[] = [];
      
      if (currentTrack.albumArt) {
        // Use the extracted album art from the audio file
        artwork.push(
          { src: currentTrack.albumArt, sizes: '512x512', type: 'image/jpeg' },
          { src: currentTrack.albumArt, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.albumArt, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.albumArt, sizes: '96x96', type: 'image/jpeg' }
        );
      } else {
        // Fallback to app logo
        artwork.push(
          { src: '/images/aw-logo.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/images/aw-logo.svg', sizes: '256x256', type: 'image/svg+xml' },
          { src: '/images/aw-logo.svg', sizes: '128x128', type: 'image/svg+xml' },
          { src: '/images/aw-logo.svg', sizes: '96x96', type: 'image/svg+xml' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album: currentTrack.album || 'Unknown Album',
        artwork: artwork
      });
    } catch (error) {
      logger.warn('Failed to update media metadata:', error);
    }
  }, [currentTrack]);

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

  // Throttled position state update - only update every 5 seconds to avoid excessive calls
  const lastPositionUpdateRef = useRef(0);
  const updatePositionState = useCallback(() => {
    if (!('mediaSession' in navigator) || !duration || duration === 0) return;

    const now = Date.now();
    if (now - lastPositionUpdateRef.current < 5000) return;
    lastPositionUpdateRef.current = now;

    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1.0,
        position: currentTime
      });
    } catch (error) {
      logger.warn('Failed to update position state:', error);
    }
  }, [duration, currentTime]);

  // Set up action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      logger.info('Media Session API not supported in this browser');
      return;
    }

    // Set up media session action handlers
    const actionHandlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => {
        handlePlay();
      }],
      ['pause', () => {
        handlePause();
      }],
      ['nexttrack', () => {
        handleNext();
      }],
      ['previoustrack', () => {
        handlePrevious();
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) {
          handleSeekTo(details.seekTime);
        }
      }],
      ['seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        const newTime = Math.max(0, currentTime - skipTime);
        handleSeekTo(newTime);
      }],
      ['seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        const newTime = Math.min(duration, currentTime + skipTime);
        handleSeekTo(newTime);
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
  }, [handlePlay, handlePause, handleNext, handlePrevious, handleSeekTo, currentTime, duration]);

  // Update metadata when track changes
  useEffect(() => {
    updateMediaMetadata();
  }, [updateMediaMetadata]);

  // Update playback state when playing state changes
  useEffect(() => {
    updatePlaybackState();
  }, [updatePlaybackState]);

  // Update position state when time or duration changes
  useEffect(() => {
    updatePositionState();
  }, [updatePositionState]);

  // Return functions that can be called externally
  return {
    updateMediaMetadata,
    updatePlaybackState,
    updatePositionState
  };
};
