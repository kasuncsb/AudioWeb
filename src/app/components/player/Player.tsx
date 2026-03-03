'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AudioTrack, PlayerProps } from './types';
import { useAudioManager } from './hooks/useAudioManager';
import { useDragHandler } from './hooks/useDragHandler';
import { useFileHandler } from './hooks/useFileHandler';
import ImportProgressPopup from './ImportProgressPopup';
import { useSleepTimer } from './hooks/useSleepTimer';
import { useMediaSession } from './hooks/useMediaSession';
import { useEqualizerPersistence } from './hooks/useEqualizerPersistence';
import { useCacheRestore } from './hooks/useCacheRestore';
// Components
import { AlbumArt } from './AlbumArt';
import { FileUploadCard } from './FileUploadCard';
import { ProgressBar } from './ProgressBar';
import { MainControls } from './MainControls';
import { SecondaryControls } from './SecondaryControls';
import { VolumeControl } from './VolumeControl';
import { PlaylistPopup } from './PlaylistPopup';
import { SleepTimerPopup } from './SleepTimerPopup';
import { EqualizerPopup } from './EqualizerPopup';
import { VisualizerPopup } from './VisualizerPopup';
import { BackButton } from './BackButton';
import { LottieAnimation } from './LottieAnimation';
import { LyricsDisplay } from './LyricsDisplay';
import { MilkDropVisualizer } from './MilkDropVisualizer';
import { useVisualizerPersistence } from '@/hooks/useVisualizerPersistence';
import { getFileInputAcceptAttribute, revokeAllObjectURLs, revokeObjectURL } from '@/utils/audioUtils';
import { UI_CONFIG, STORAGE_KEYS } from '@/config/constants';

const Player: React.FC<PlayerProps> = ({ isVisible = true, onClose, asPage = false, onPlayingChange, onTrackChange, onSleepTimerChange, onVisualizationChange, showVisualization = false }) => {
  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(UI_CONFIG.VOLUME.DEFAULT);
  const [repeatMode, setRepeatMode] = useState(0);
  const [playlist, setPlaylist] = useState<AudioTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showVisualizerPopup, setShowVisualizerPopup] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [skipDirection, setSkipDirection] = useState<'next' | 'prev'>('next');
  const [isRepeatLoaded, setIsRepeatLoaded] = useState(false);

  // Available loaded presets from MilkDropVisualizer
  const [availablePresets, setAvailablePresets] = useState<string[]>([]);

  // Use equalizer persistence hook
  // Load EQ settings as soon as tracks are available (not gated on isVisible)
  // so that playback from the navbar applies the user's saved EQ immediately.
  const {
    settings: equalizerSettings,
    updateSettings: setEqualizerSettings,
    isLoaded: isEqualizerLoaded,
  } = useEqualizerPersistence(playlist.length > 0);

  // Use visualizer persistence hook - don't manage enabled state here (page.tsx owns that)
  const {
    visualizerSettings,
    updateVisualizerSettings,
    isLoaded: isVisualizerLoaded,
  } = useVisualizerPersistence(isVisible && playlist.length > 0, { manageEnabled: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTrack = playlist[currentTrackIndex];
  const syncPlaylistRef = useRef<((tracks: AudioTrack[]) => void) | null>(null);

  // Notify parent component when playing state changes
  useEffect(() => {
    if (onPlayingChange) {
      onPlayingChange(isPlaying);
    }
  }, [isPlaying, onPlayingChange]);

  // Notify parent component when track changes
  useEffect(() => {
    if (!onTrackChange) return;

    // If the playlist is empty, notify parent to clear current/next track
    if (playlist.length === 0) {
      onTrackChange(null, null);
      return;
    }

    // Normal behavior: notify parent of current and next tracks
    const current = playlist[currentTrackIndex] || null;
    const nextIndex = currentTrackIndex < playlist.length - 1 ? currentTrackIndex + 1 : (repeatMode === 1 ? 0 : -1);
    const next = nextIndex >= 0 ? playlist[nextIndex] : null;
    onTrackChange(current, next);
  }, [currentTrackIndex, playlist, repeatMode, onTrackChange]);

  // Notify parent component when sleep timer changes
  useEffect(() => {
    if (onSleepTimerChange) {
      onSleepTimerChange(sleepTimer);
    }
  }, [sleepTimer, onSleepTimerChange]);

  // Load repeat mode from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REPEAT_MODE);
      if (saved !== null) {
        setRepeatMode(parseInt(saved, 10));
      }
    } catch (error) {
      console.error('Failed to load repeat mode:', error);
    } finally {
      setIsRepeatLoaded(true);
    }
  }, []);

  // Save repeat mode to localStorage when it changes
  useEffect(() => {
    if (isRepeatLoaded) {
      try {
        localStorage.setItem(STORAGE_KEYS.REPEAT_MODE, String(repeatMode));
      } catch (error) {
        console.error('Failed to save repeat mode:', error);
      }
    }
  }, [repeatMode, isRepeatLoaded]);

  // Shuffle utility function - reorders the playlist
  const shufflePlaylist = useCallback(() => {
    if (playlist.length <= 1) return;

    // Trigger shuffle animation
    setIsShuffling(true);
    setTimeout(() => setIsShuffling(false), 500);

    const currentTrack = playlist[currentTrackIndex];

    // Separate current track from others (exclude by index to preserve object reference)
    const otherTracks = playlist.filter((_, index) => index !== currentTrackIndex);

    // Fisher-Yates shuffle on other tracks
    for (let i = otherTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
    }

    // Put current track at the beginning (preserve exact object reference)
    // Update isActive for other tracks only
    const shuffledPlaylist = [
      currentTrack, // Keep exact reference to avoid triggering track change effects
      ...otherTracks.map(track => ({
        ...track,
        isActive: false
      }))
    ];

    // Ensure current track remains active
    shuffledPlaylist[0] = { ...currentTrack, isActive: true };

    setPlaylist(shuffledPlaylist);
    setCurrentTrackIndex(0);
    
    // Sync shuffled playlist order to cache
    setTimeout(() => {
      if (syncPlaylistRef.current) {
        syncPlaylistRef.current(shuffledPlaylist);
      }
    }, 100);
  }, [playlist, currentTrackIndex]);

  // Navigation state helpers
  const canGoPrevious = useMemo(() => {
    return currentTrackIndex > 0;
  }, [currentTrackIndex]);

  const canGoNext = useMemo(() => {
    return currentTrackIndex < playlist.length - 1 || repeatMode === 1;
  }, [currentTrackIndex, playlist.length, repeatMode]);

  // Navigation handlers - simple sequential playback
  const handleNext = useCallback(() => {
    setSkipDirection('next');
    if (currentTrackIndex < playlist.length - 1) {
      // Move to next track
      const nextIndex = currentTrackIndex + 1;
      setCurrentTrackIndex(nextIndex);
      setPlaylist(prev => prev.map((track, index) => ({
        ...track,
        isActive: index === nextIndex
      })));
      setCurrentTime(0);
    } else if (repeatMode === 1) {
      // At end of playlist with repeat all - go to first track
      setCurrentTrackIndex(0);
      setPlaylist(prev => prev.map((track, index) => ({
        ...track,
        isActive: index === 0
      })));
      setCurrentTime(0);
    } else {
      // End of playlist, no repeat - stop playback
      setIsPlaying(false);
    }
  }, [currentTrackIndex, playlist.length, repeatMode, setPlaylist, setIsPlaying]);

  const handlePrevious = useCallback(() => {
    setSkipDirection('prev');
    if (currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      setCurrentTrackIndex(prevIndex);
      setPlaylist(prev => prev.map((track, index) => ({
        ...track,
        isActive: index === prevIndex
      })));
      setCurrentTime(0);
    }
  }, [currentTrackIndex]);

  const selectTrack = useCallback((index: number) => {
    setSkipDirection(index > currentTrackIndex ? 'next' : 'prev');
    setCurrentTrackIndex(index);
    setPlaylist(prev => prev.map((track, trackIndex) => ({
      ...track,
      isActive: trackIndex === index
    })));
    setCurrentTime(0);
    setIsPlaying(true);
  }, [currentTrackIndex]);

  // Restore cached tracks on page load & manage cache blob URLs
  const { removeFromCache, syncPlaylistOrder } = useCacheRestore(
    playlist,
    setPlaylist,
    setCurrentTrackIndex,
    currentTrackIndex,
    currentTime,
  );

  // Store sync function in ref so shuffle can access it
  useEffect(() => {
    syncPlaylistRef.current = syncPlaylistOrder;
  }, [syncPlaylistOrder]);

  const removeTrack = useCallback((indexToRemove: number) => {
    setPlaylist(prev => {
      const removed = prev[indexToRemove];
      const updated = prev.filter((_, index) => index !== indexToRemove);

      // Revoke object URL for removed track if tracked
      try {
        if (removed && typeof removed.url === 'string' && removed.url.startsWith('blob:')) {
          revokeObjectURL(removed.url);
        }
      } catch { }

      // Remove from persistent cache
      if (removed) {
        removeFromCache(removed);
      }

      // Determine new current index after removal
      let newIndex = currentTrackIndex;
      if (indexToRemove < currentTrackIndex) {
        newIndex = currentTrackIndex - 1;
      } else if (indexToRemove === currentTrackIndex) {
        // If we removed the currently playing track, move to the next available index
        newIndex = Math.min(indexToRemove, Math.max(0, updated.length - 1));
      }

      // Ensure index bounds
      newIndex = Math.max(0, Math.min(newIndex, Math.max(0, updated.length - 1)));

      // Update current track index and isActive flags
      setCurrentTrackIndex(newIndex);
      setCurrentTime(0);

      // If there are remaining tracks, mark the new current as active
      if (updated.length > 0) {
        const normalized = updated.map((track, idx) => ({ ...track, isActive: idx === newIndex }));
        return normalized;
      }

      // No tracks left
      return [];
    });
    // Preserve playback state: if playlist had a playing track and user removed it, keep isPlaying true so
    // the audio manager effect will load/play the new index. If playlist becomes empty, other effects will
    // handle stopping and clearing audio.
  }, [currentTrackIndex, removeFromCache]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
  }, []);

  // Load volume from localStorage on mount
  // Deferred volume persistence: only load/save after the player UI is
  // visible and at least one track is present. This avoids early
  // localStorage access and preserves user changes made before init.
  const [isVolumeLoaded, setIsVolumeLoaded] = useState(false);

  useEffect(() => {
    const shouldInit = isVisible && playlist.length > 0;
    if (!shouldInit || isVolumeLoaded) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.VOLUME);
      if (stored !== null) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          setVolume(parsed);
        }
      } else {
        // Fresh user: if user already changed the in-memory volume before
        // init, persist that value instead of overwriting with the default.
        const hasUserChanged = volume !== UI_CONFIG.VOLUME.DEFAULT;
        const toSave = hasUserChanged ? volume : UI_CONFIG.VOLUME.DEFAULT;
        try {
          localStorage.setItem(STORAGE_KEYS.VOLUME, String(toSave));
        } catch { }
      }
    } catch { }

    setIsVolumeLoaded(true);
  }, [isVisible, playlist.length, volume, isVolumeLoaded]);

  // Persist volume changes only after initial load/save has occurred
  useEffect(() => {
    if (!isVolumeLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEYS.VOLUME, String(volume));
    } catch { }
  }, [volume, isVolumeLoaded]);

  // Handle visualizer auto-change on track play (end/start)
  useEffect(() => {
    // We only want to trigger the automatic visualizer switch if a song actually changed 
    // and we're in automatic mode with available presets.
    if (
      isVisualizerLoaded &&
      visualizerSettings.mode === 'Automatic' &&
      availablePresets.length > 0
    ) {
      const nextIndex = Math.floor(Math.random() * availablePresets.length);
      updateVisualizerSettings({ activePreset: availablePresets[nextIndex] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex, isVisualizerLoaded, visualizerSettings.mode, availablePresets.length]);

  // Custom hooks
  const { audioRef, handlePlayPause, handleSeek, getAnalyser, getAudioContext } = useAudioManager(
    playlist,
    currentTrackIndex,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    volume,
    repeatMode,
    handleNext,
    equalizerSettings,
    isEqualizerLoaded
  );

  // If the playlist becomes empty while playback is active, ensure audio actually stops
  useEffect(() => {
    if (playlist.length === 0) {
      const audio = audioRef.current;
      // Pause and clear source to make sure playback fully stops
      if (audio) {
        try {
          if (!audio.paused) audio.pause();
          // Remove src attribute + load to avoid firing spurious MEDIA_ERR_SRC_NOT_SUPPORTED
          // and revoke any tracked object URLs to release blobs
          audio.removeAttribute('src');
          audio.load();
          try { revokeAllObjectURLs(); } catch { }
        } catch {
          // ignore
        }
      }
      if (isPlaying) setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [playlist.length, audioRef, isPlaying, setIsPlaying, setCurrentTime]);

  const { popupPositions, handleMouseDown } = useDragHandler();

  const { isDragOver, handleFileUpload, handleDragOver, handleDragLeave, handleDrop, uploadState } = useFileHandler(
    playlist,
    setPlaylist,
    setCurrentTrackIndex
  );

  useSleepTimer(sleepTimer, setIsPlaying, setSleepTimer, audioRef);

  // Media Session API integration for browser controls
  const handleSeekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [audioRef, setCurrentTime]);

  const handlePlay = useCallback(() => {
    if (!isPlaying) {
      handlePlayPause();
    }
  }, [isPlaying, handlePlayPause]);

  const handlePause = useCallback(() => {
    if (isPlaying) {
      handlePlayPause();
    }
  }, [isPlaying, handlePlayPause]);

  useMediaSession({
    currentTrack,
    isPlaying,
    handlePlay,
    handlePause,
    handleNext,
    handlePrevious,
    handleSeekTo,
    duration,
    currentTime
  });

  // Listen for custom events from navbar controls
  useEffect(() => {
    const handlePlayPauseEvent = () => {
      handlePlayPause();
    };

    const handleNextEvent = () => {
      handleNext();
    };

    const handlePreviousEvent = () => {
      handlePrevious();
    };

    window.addEventListener('playerPlayPause', handlePlayPauseEvent);
    window.addEventListener('playerNext', handleNextEvent);
    window.addEventListener('playerPrevious', handlePreviousEvent);

    return () => {
      window.removeEventListener('playerPlayPause', handlePlayPauseEvent);
      window.removeEventListener('playerNext', handleNextEvent);
      window.removeEventListener('playerPrevious', handlePreviousEvent);
    };
  }, [handlePlayPause, handleNext, handlePrevious]);

  // Event handlers
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files);
    }
  };

  const handleAddTracks = () => {
    fileInputRef.current?.click();
  };

  // Container class - background transitions smoothly when visualization toggles
  const containerClass = asPage
    ? `relative min-h-screen overflow-hidden`
    : `fixed left-0 right-0 bottom-0 overflow-hidden z-40 top-[calc(4.5rem-1px)]`; // Start 1px higher to cover navbar border

  const containerStyle: React.CSSProperties = {
    backgroundColor: showVisualization ? 'transparent' : '#000',
    transition: 'background-color 3s ease',
  };

  // Always render audio element to keep playback alive, but hide UI when not visible
  return (
    <>
      {/* Audio element always rendered to maintain playback */}
      <audio ref={audioRef} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getFileInputAcceptAttribute()}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* MilkDrop Visualization - Always rendered so it shows through navbar glass even on home screen */}
      <MilkDropVisualizer
        isActive={showVisualization && playlist.length > 0}
        audioContext={getAudioContext()}
        analyserNode={getAnalyser()}
        trackTitle={currentTrack?.title}
        activePreset={visualizerSettings.activePreset}
        onPresetsLoaded={setAvailablePresets}
      />

      {/* Player UI - only shown when visible */}
      {isVisible && (
        <div
          className={containerClass}
          style={containerStyle}
          onDragOver={playlist.length > 0 ? handleDragOver : undefined}
          onDragLeave={playlist.length > 0 ? handleDragLeave : undefined}
          onDrop={playlist.length > 0 ? handleDrop : undefined}
        >

          {/* Drag and Drop Overlay - Only show when tracks are loaded */}
          {playlist.length > 0 && isDragOver && (
            <div
              className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none transition-all duration-300"
              style={{
                background: showVisualization ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.8)',
                backdropFilter: showVisualization ? 'none' : 'blur(20px) saturate(120%)',
                WebkitBackdropFilter: showVisualization ? 'none' : 'blur(20px) saturate(120%)',
              }}
            >
              <div
                className="relative w-full max-w-md rounded-3xl p-6 sm:p-8 text-center space-y-6 transition-all duration-500"
                style={{
                  background: showVisualization ? 'rgba(15, 15, 20, 0.35)' : 'rgba(20, 20, 28, 0.95)',
                  backdropFilter: 'blur(24px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                  border: showVisualization ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: showVisualization ? '0 8px 32px rgba(0, 0, 0, 0.2)' : '0 20px 60px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-white/10 flex items-center justify-center animate-pulse border border-white/20">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-white mb-2">Add More Tracks</h3>
                  <p className="text-white/70 text-lg">Drop files to add them to your playlist</p>
                </div>
              </div>
            </div>
          )}

          {/* Back Button - Moved outside main to prevent backdrop-filter containing block jumping */}
          <div className="absolute top-4 sm:top-6 left-2 sm:left-4 md:left-8 z-50">
            <BackButton asPage={asPage} onClose={onClose} />
          </div>

          {/* Visualizer Preset Navigation Control (Desktop floating) */}
          {showVisualization && availablePresets.length > 0 && (
            <div className="hidden md:block absolute bottom-8 right-8 z-50 pointer-events-auto">
              <button
                onClick={() => setShowVisualizerPopup(true)}
                className="group flex flex-col items-end text-right gap-1 px-4 py-2 hover:bg-white/5 rounded-xl transition-all duration-300"
                title="Visualizer Settings"
              >
                <div className="flex items-center gap-2 text-white/50 group-hover:text-white/80 transition-colors text-xs font-medium uppercase tracking-widest">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Visualizer Preset</span>
                </div>
                <span className="text-white/80 group-hover:text-white text-sm max-w-50 truncate transition-colors drop-shadow-md">
                  {visualizerSettings.activePreset || availablePresets[0] || 'Loading...'}
                </span>
              </button>
            </div>
          )}

          <main
            className="w-full relative flex flex-col items-center justify-start pt-4 sm:pt-6 pb-4 sm:pb-6 overflow-y-auto custom-scrollbar-auto"
            style={{
              background: showVisualization ? 'transparent' : 'rgba(20, 20, 28, 0.92)',
              backgroundImage: showVisualization ? 'none' : `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='white' fill-opacity='0'/%3E%3Ccircle cx='20' cy='20' r='1' fill='white' fill-opacity='0.04'/%3E%3C/svg%3E")`,
              backgroundBlendMode: 'overlay',
              height: 'calc(100dvh - 4.5rem)', // Full height minus navbar (dvh for mobile)
              transition: 'background 3s ease',
            }}
          >
            {/* Lottie Animation */}
            <LottieAnimation show={!currentTrack} />

            {/* Global Centered Upload Zone (Show only when no track is playing) */}
            {!currentTrack && (
              <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 mt-24 md:mt-32">
                <FileUploadCard
                  onUploadClick={() => fileInputRef.current?.click()}
                  isDragOver={isDragOver}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              </div>
            )}

            {/* Desktop and Tablet Layout (Only show when there is a track) */}
            {currentTrack && (
              <div className="hidden md:flex w-full max-w-350 gap-4 lg:gap-8 px-4 lg:px-8 pt-2">

                {/* Left Section - Player Controls */}
                <div className="w-72 lg:w-80 xl:w-96 flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)]">
                  <div
                    className="rounded-[20px] lg:rounded-3xl flex-1 overflow-hidden min-h-0"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'var(--blur-panel)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <div className="p-4 lg:p-6 h-full overflow-y-auto custom-scrollbar-auto">
                      {currentTrack && (
                        <AlbumArt currentTrack={currentTrack} direction={skipDirection} isPlaying={isPlaying} />
                      )}

                      {currentTrack && (
                        <div className="space-y-4 lg:space-y-6 mt-4 lg:mt-6">
                          <ProgressBar
                            currentTime={currentTime}
                            duration={duration}
                            onSeek={handleSeek}
                          />

                          <MainControls
                            isPlaying={isPlaying}
                            onPlayPause={handlePlayPause}
                            onPrevious={handlePrevious}
                            onNext={handleNext}
                            canGoPrevious={canGoPrevious}
                            canGoNext={canGoNext}
                          />

                          <SecondaryControls
                            onShuffleClick={shufflePlaylist}
                            repeatMode={repeatMode}
                            onRepeatToggle={() => setRepeatMode((repeatMode + 1) % 3)}
                            onPlaylistToggle={() => setShowPlaylist(!showPlaylist)}
                            onSleepTimerToggle={() => setShowSleepTimer(!showSleepTimer)}
                            onEqualizerToggle={() => setShowEqualizer(!showEqualizer)}
                            onVisualizationToggle={() => onVisualizationChange && onVisualizationChange(!showVisualization)}
                            sleepTimer={sleepTimer}
                            showVisualization={showVisualization}
                          />

                          <VolumeControl
                            volume={volume}
                            onVolumeChange={handleVolumeChange}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Section - Lyrics Area (Expanded to full height) */}
                {playlist.length > 0 && (
                  <div className="flex-1 flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)]">
                    <div
                      className="rounded-[20px] lg:rounded-3xl flex-1 overflow-hidden min-h-0"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'var(--blur-panel)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      <div className="p-4 lg:p-6 h-full overflow-y-auto custom-scrollbar-enhanced">
                        <LyricsDisplay
                          currentTrack={currentTrack}
                          currentTime={currentTime}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile and Small Tablet Layout (Only show when there is a track) */}
            {currentTrack && (
              <div className="md:hidden w-full h-[calc(100dvh-4.5rem)] overflow-y-auto custom-scrollbar-auto">
                <div className="px-3 sm:px-4 pt-2 pb-6 space-y-3 sm:space-y-4">
                  {/* Album Art Area */}
                  <div className="flex justify-center">
                    <div className="w-full max-w-sm">
                      <AlbumArt currentTrack={currentTrack} direction={skipDirection} isPlaying={isPlaying} />
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div
                    className="w-full rounded-2xl p-3 sm:p-4"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'var(--blur-panel)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                      WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                    }}
                  >
                    <ProgressBar
                      currentTime={currentTime}
                      duration={duration}
                      onSeek={handleSeek}
                    />
                  </div>

                  {/* Main Controls */}
                  <div
                    className="w-full rounded-2xl p-4 sm:p-5"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'var(--blur-panel)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                      WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                    }}
                  >
                    <MainControls
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPause}
                      onPrevious={handlePrevious}
                      onNext={handleNext}
                      canGoPrevious={canGoPrevious}
                      canGoNext={canGoNext}
                    />
                  </div>

                  {/* Secondary Controls and Volume */}
                  <div
                    className="w-full rounded-2xl p-3 sm:p-4"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'var(--blur-panel)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                      WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                    }}
                  >
                    <div className="space-y-3 sm:space-y-4">
                      <SecondaryControls
                        onShuffleClick={shufflePlaylist}
                        repeatMode={repeatMode}
                        onRepeatToggle={() => setRepeatMode((repeatMode + 1) % 3)}
                        onPlaylistToggle={() => setShowPlaylist(!showPlaylist)}
                        onSleepTimerToggle={() => setShowSleepTimer(!showSleepTimer)}
                        onEqualizerToggle={() => setShowEqualizer(!showEqualizer)}
                        onVisualizationToggle={() => onVisualizationChange && onVisualizationChange(!showVisualization)}
                        sleepTimer={sleepTimer}
                        showVisualization={showVisualization}
                      />

                      <VolumeControl
                        volume={volume}
                        onVolumeChange={handleVolumeChange}
                      />
                    </div>
                  </div>

                  {/* Lyrics Display */}
                  <div
                    className="w-full rounded-2xl p-4 sm:p-5 overflow-hidden flex flex-col relative"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'var(--blur-panel)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                      WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                      height: '400px', // Force defined size to limit lyrics waterfall effect
                    }}
                  >
                    <LyricsDisplay
                      currentTrack={currentTrack}
                      currentTime={currentTime}
                    />
                  </div>

                  {/* Mobile Visualizer Settings Button (Below Lyrics) */}
                  {showVisualization && availablePresets.length > 0 && (
                    <div className="w-full flex justify-center pt-2 pb-8">
                      <button
                        onClick={() => setShowVisualizerPopup(true)}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-95"
                      >
                        <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="text-white/80 text-sm font-medium truncate max-w-50">
                          {visualizerSettings.activePreset ? `Preset: ${visualizerSettings.activePreset}` : 'Visualizer Settings'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main >
        </div >
      )}

      {/* Popups - Mounted independently with highest z-index priority (above back button/navbar elements) */}
      <div style={{ zIndex: 60, position: 'relative' }}>
        <ImportProgressPopup
          active={uploadState?.active ?? false}
          total={uploadState?.total ?? 0}
          processed={uploadState?.processed ?? 0}
          currentFile={uploadState?.currentFile}
          items={uploadState?.items ?? []}
        />

        <PlaylistPopup
          show={showPlaylist}
          playlist={playlist}
          position={popupPositions.playlist}
          onClose={() => setShowPlaylist(false)}
          onMouseDown={(e) => handleMouseDown('playlist', e)}
          onSelectTrack={selectTrack}
          onRemoveTrack={removeTrack}
          onAddTracks={handleAddTracks}
          isPlaying={isPlaying}
          isShuffling={isShuffling}
          showVisualization={showVisualization}
        />

        <SleepTimerPopup
          show={showSleepTimer}
          position={popupPositions.sleepTimer}
          sleepTimer={Math.floor(sleepTimer / 60)} // Display in minutes
          isTimerActive={sleepTimer > 0} // Pass true if any timer is active
          onClose={() => setShowSleepTimer(false)}
          onMouseDown={(e) => handleMouseDown('sleepTimer', e)}
          onSetTimer={(minutes) => setSleepTimer(minutes * 60)} // Convert minutes to seconds
          onCancelTimer={() => {
            setSleepTimer(0);
            // Notify parent this was a manual cancellation (should not turn off visualization)
            if (onSleepTimerChange) onSleepTimerChange(0, true);
          }}
          showVisualization={showVisualization}
        />

        <EqualizerPopup
          show={showEqualizer}
          position={popupPositions.equalizer}
          settings={equalizerSettings}
          onClose={() => setShowEqualizer(false)}
          onMouseDown={(e) => handleMouseDown('equalizer', e)}
          onUpdateSettings={setEqualizerSettings}
          showVisualization={showVisualization}
        />

        <VisualizerPopup
          show={showVisualizerPopup}
          position={popupPositions.visualizer || { x: 50, y: 50 }}
          settings={visualizerSettings}
          availablePresets={availablePresets}
          showVisualization={showVisualization}
          onClose={() => setShowVisualizerPopup(false)}
          onMouseDown={(e) => handleMouseDown('visualizer', e)}
          onUpdateSettings={updateVisualizerSettings}
        />
      </div>
    </>
  );
};

export default Player;
