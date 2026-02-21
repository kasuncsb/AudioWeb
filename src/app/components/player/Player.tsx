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
import { AlbumArt } from './AlbumArt';
import { ProgressBar } from './ProgressBar';
import { MainControls } from './MainControls';
import { SecondaryControls } from './SecondaryControls';
import { VolumeControl } from './VolumeControl';
import { PlaylistPopup } from './PlaylistPopup';
import { SleepTimerPopup } from './SleepTimerPopup';
import { EqualizerPopup } from './EqualizerPopup';
import { BackButton } from './BackButton';
import { LottieAnimation } from './LottieAnimation';
import { LyricsDisplay } from './LyricsDisplay';
import { PlayerStyles } from './PlayerStyles';
import { MilkDropVisualizer } from './MilkDropVisualizer';
import { getFileInputAcceptAttribute, revokeAllObjectURLs, revokeObjectURL } from '@/utils/audioUtils';
import { UI_CONFIG, STORAGE_KEYS } from '@/config/constants';

const Player: React.FC<PlayerProps> = ({ isVisible = true, onClose, asPage = false, onPlayingChange, onTrackChange, onSleepTimerChange, onVisualizationChange }) => {
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
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  // Use equalizer persistence hook
  const {
    settings: equalizerSettings,
    updateSettings: setEqualizerSettings,
    isLoaded: isEqualizerLoaded,
  } = useEqualizerPersistence(isVisible && playlist.length > 0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentTrack = playlist[currentTrackIndex];

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

  // Notify parent component when visualization state changes
  useEffect(() => {
    if (onVisualizationChange) {
      onVisualizationChange(showVisualization);
    }
  }, [showVisualization, onVisualizationChange]);

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
  }, [currentTrackIndex, playlist.length, repeatMode, setIsPlaying]);

  const handlePrevious = useCallback(() => {
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
    setCurrentTrackIndex(index);
    setPlaylist(prev => prev.map((track, trackIndex) => ({
      ...track,
      isActive: trackIndex === index
    })));
    setCurrentTime(0);
    setIsPlaying(true);
  }, []);

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
  }, [currentTrackIndex]);

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

  // Container class - background should be transparent when visualization is active
  const containerClass = asPage
    ? `relative min-h-screen overflow-hidden ${showVisualization ? 'bg-transparent' : 'bg-black'}`
    : `fixed left-0 right-0 bottom-0 overflow-hidden z-40 top-[calc(4.5rem-1px)] ${showVisualization ? 'bg-transparent' : 'bg-black'}`; // Start 1px higher to cover navbar border

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

      {/* MilkDrop Visualization - Full viewport background, not constrained by player container */}
      {isVisible && (
        <MilkDropVisualizer
          isActive={showVisualization && playlist.length > 0}
          audioContext={getAudioContext()}
          analyserNode={getAnalyser()}
          trackTitle={currentTrack?.title}
        />
      )}

      {/* Player UI - only shown when visible */}
      {isVisible && (
        <div
          className={containerClass}
          onDragOver={playlist.length > 0 ? handleDragOver : undefined}
          onDragLeave={playlist.length > 0 ? handleDragLeave : undefined}
          onDrop={playlist.length > 0 ? handleDrop : undefined}
        >

          {/* Drag and Drop Overlay - Only show when tracks are loaded */}
          {playlist.length > 0 && isDragOver && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="text-center space-y-4 p-8">
                <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center animate-pulse">
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

          <main
            className="w-full relative flex flex-col items-center justify-start pt-4 sm:pt-6 pb-4 sm:pb-6 overflow-y-auto custom-scrollbar-auto"
            style={{
              background: showVisualization ? 'transparent' : 'rgba(20, 20, 28, 0.92)',
              backdropFilter: showVisualization ? 'none' : 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: showVisualization ? 'none' : 'blur(16px) saturate(180%)',
              backgroundImage: showVisualization ? 'none' : `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='white' fill-opacity='0'/%3E%3Ccircle cx='20' cy='20' r='1' fill='white' fill-opacity='0.04'/%3E%3C/svg%3E")`,
              backgroundBlendMode: 'overlay',
              height: 'calc(100dvh - 4.5rem)', // Full height minus navbar (dvh for mobile)
              transition: 'background 0.5s ease, backdrop-filter 0.5s ease',
            }}
          >
            {/* Lottie Animation */}
            <LottieAnimation show={!currentTrack} />

            {/* Desktop and Tablet Layout */}
            <div className="hidden md:flex w-full max-w-350 gap-4 lg:gap-8 px-4 lg:px-8 pt-2">

              {/* Left Section - Player Controls */}
              <div className="w-72 lg:w-80 xl:w-96 flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar-auto">
                <div
                  className="rounded-[20px] lg:rounded-3xl p-4 lg:p-6 shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <AlbumArt
                    currentTrack={currentTrack}
                    onUploadClick={() => fileInputRef.current?.click()}
                    isDragOver={!currentTrack && isDragOver}
                    onDragOver={!currentTrack ? handleDragOver : undefined}
                    onDragLeave={!currentTrack ? handleDragLeave : undefined}
                    onDrop={!currentTrack ? handleDrop : undefined}
                  />

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
                        onVisualizationToggle={() => setShowVisualization(!showVisualization)}
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

              {/* Right Section - Lyrics Area (Expanded to full height) */}
              {playlist.length > 0 && (
                <div className="flex-1 flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)]">
                  <div
                    className="rounded-[20px] lg:rounded-3xl p-4 lg:p-6 flex-1 overflow-y-auto custom-scrollbar-enhanced min-h-0"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <LyricsDisplay
                      currentTrack={currentTrack}
                      currentTime={currentTime}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mobile and Small Tablet Layout */}
            <div className="md:hidden w-full h-[calc(100dvh-4.5rem)] overflow-y-auto custom-scrollbar-auto">
              <div className="px-3 sm:px-4 pt-2 pb-6 space-y-3 sm:space-y-4">
                {/* Album Art or Upload Area */}
                <div className="flex justify-center">
                  <div className="w-full max-w-sm">
                    <AlbumArt
                      currentTrack={currentTrack}
                      onUploadClick={() => fileInputRef.current?.click()}
                      isDragOver={!currentTrack && isDragOver}
                      onDragOver={!currentTrack ? handleDragOver : undefined}
                      onDragLeave={!currentTrack ? handleDragLeave : undefined}
                      onDrop={!currentTrack ? handleDrop : undefined}
                    />
                  </div>
                </div>

                {currentTrack ? (
                  <>
                    {/* Progress Bar */}
                    <div
                      className="w-full rounded-2xl p-3 sm:p-4"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
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
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
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
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
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
                          onVisualizationToggle={() => setShowVisualization(!showVisualization)}
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
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                        height: '400px', // Force defined size to limit lyrics waterfall effect
                      }}
                    >
                      <LyricsDisplay
                        currentTrack={currentTrack}
                        currentTime={currentTime}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </main>

          {/* Popups - Fixed positioning for mobile */}
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
          />

          <SleepTimerPopup
            show={showSleepTimer}
            position={popupPositions.sleepTimer}
            sleepTimer={Math.floor(sleepTimer / 60)} // Display in minutes
            isTimerActive={sleepTimer > 0} // Pass true if any timer is active
            onClose={() => setShowSleepTimer(false)}
            onMouseDown={(e) => handleMouseDown('sleepTimer', e)}
            onSetTimer={(minutes) => setSleepTimer(minutes * 60)} // Convert minutes to seconds
            onCancelTimer={() => setSleepTimer(0)}
          />

          <EqualizerPopup
            show={showEqualizer}
            position={popupPositions.equalizer}
            settings={equalizerSettings}
            onClose={() => setShowEqualizer(false)}
            onMouseDown={(e) => handleMouseDown('equalizer', e)}
            onUpdateSettings={setEqualizerSettings}
          />

          <PlayerStyles />
        </div>
      )}
    </>
  );
};

export default Player;
