'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ScrollingText } from './player/ScrollingText';
import { AudioTrack } from './player/types';

interface NowPlayingBarProps {
  currentTrack: AudioTrack;
  nextTrack?: AudioTrack | null;
  isPlaying: boolean;
  isPlayerVisible?: boolean; // New prop to control visibility of controls
  sleepTimer?: number; // Sleep timer in seconds
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onOpenPlayer?: () => void;
}

// Custom Sleep Icon Component
const SleepIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
      fill="url(#sleepGradient)" opacity="0.2"/>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" 
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 6V12L16 14" 
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 3L10 1M15 3L14 1M9 21L10 23M15 21L14 23" 
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    <defs>
      <linearGradient id="sleepGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F97316" />
        <stop offset="1" stopColor="#EA580C" />
      </linearGradient>
    </defs>
  </svg>
);

// Custom Good Night Icon Component (Moon with stars)
const GoodNightIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Moon crescent */}
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" 
      fill="url(#moonGradient)" opacity="0.3"/>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" 
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Stars */}
    <path d="M17 3L17.5 4.5L19 5L17.5 5.5L17 7L16.5 5.5L15 5L16.5 4.5L17 3Z" 
      fill="currentColor" opacity="0.8"/>
    <path d="M20 8L20.3 8.8L21 9L20.3 9.2L20 10L19.7 9.2L19 9L19.7 8.8L20 8Z" 
      fill="currentColor" opacity="0.6"/>
    <path d="M22 14L22.2 14.5L22.7 14.7L22.2 14.9L22 15.4L21.8 14.9L21.3 14.7L21.8 14.5L22 14Z" 
      fill="currentColor" opacity="0.6"/>
    <defs>
      <linearGradient id="moonGradient" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A855F7" />
        <stop offset="1" stopColor="#7C3AED" />
      </linearGradient>
    </defs>
  </svg>
);

export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({
  currentTrack,
  nextTrack,
  isPlaying,
  isPlayerVisible = false,
  sleepTimer = 0,
  onPlayPause,
  onNext,
  onPrevious,
  onOpenPlayer,
}) => {
  const [showUpNext, setShowUpNext] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [hasShownInitialAlert, setHasShownInitialAlert] = useState(false);
  const [lastSleepTimer, setLastSleepTimer] = useState(0);
  const [showGoodNight, setShowGoodNight] = useState(false);
  const initialAlertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const goodNightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Format sleep timer to display with live countdown
  const formatSleepTimer = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      if (mins > 0 && secs > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}, ${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
      } else if (mins > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} and ${mins} minute${mins !== 1 ? 's' : ''}`;
      } else if (secs > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    if (mins > 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
    }
    
    return `${secs} second${secs !== 1 ? 's' : ''}`;
  };

  // Determine if we should force show sleep timer (last minute only)
  const shouldForceSleepTimer = sleepTimer > 0 && sleepTimer <= 60;

  // Track lastSleepTimer continuously for comparison
  useEffect(() => {
    if (sleepTimer > 0) {
      setLastSleepTimer(sleepTimer);
    }
  }, [sleepTimer]);

  // Detect when sleep timer is initially set (goes from 0 to positive)
  useEffect(() => {
    // Track when playback was paused by sleep timer
    if (lastSleepTimer > 0 && sleepTimer === 0 && !isPlaying) {
      // Sleep timer just finished and paused playback - show "Good Night!" message
      setShowSleepTimer(true);
      setShowGoodNight(true);
      setShowUpNext(false);
      setLastSleepTimer(0);
      
      // Clear any existing timeout
      if (goodNightTimeoutRef.current) {
        clearTimeout(goodNightTimeoutRef.current);
      }
      
      // Show "Good Night!" for 5 seconds, then return to "Paused" state
      goodNightTimeoutRef.current = setTimeout(() => {
        setShowSleepTimer(false);
        setShowGoodNight(false);
        goodNightTimeoutRef.current = null;
      }, 5000);
      
      return;
    }
    
    // Detect timer cancellation during initial alert (user cancelled during 5-sec alert)
    if (lastSleepTimer > 0 && sleepTimer === 0 && isPlaying) {
      // Timer was cancelled, immediately restore previous view
      if (initialAlertTimeoutRef.current) {
        clearTimeout(initialAlertTimeoutRef.current);
        initialAlertTimeoutRef.current = null;
      }
      setShowSleepTimer(false);
      setHasShownInitialAlert(false);
      setLastSleepTimer(0);
      return;
    }
    
    // Detect timer value change (user selected a new timer value)
    // A jump of more than 5 seconds indicates a new timer was set, not just countdown
    const timerDifference = Math.abs(sleepTimer - lastSleepTimer);
    if (lastSleepTimer > 0 && sleepTimer > 0 && timerDifference > 5) {
      // User changed timer value, show alert again
      setHasShownInitialAlert(false); // Reset flag to allow showing alert
      setShowSleepTimer(true);
      
      // Clear any existing timeout
      if (initialAlertTimeoutRef.current) {
        clearTimeout(initialAlertTimeoutRef.current);
      }
      
      // Show for 5 seconds, then hide and return to normal rotation
      initialAlertTimeoutRef.current = setTimeout(() => {
        setShowSleepTimer(false);
        setHasShownInitialAlert(true);
        initialAlertTimeoutRef.current = null;
      }, 5000);
      
      return;
    }
    
    // Detect initial timer set (going from 0 to a positive value)
    if (lastSleepTimer === 0 && sleepTimer > 0 && !hasShownInitialAlert) {
      setHasShownInitialAlert(true);
      setShowSleepTimer(true);
      
      // Clear any existing timeout
      if (initialAlertTimeoutRef.current) {
        clearTimeout(initialAlertTimeoutRef.current);
      }
      
      // Show for 5 seconds, then hide and return to normal rotation
      initialAlertTimeoutRef.current = setTimeout(() => {
        setShowSleepTimer(false);
        initialAlertTimeoutRef.current = null;
      }, 5000);
      
      return;
    }
    
    // Reset lastSleepTimer when timer reaches 0
    if (sleepTimer === 0 && lastSleepTimer > 0) {
      setLastSleepTimer(0);
    }
  }, [sleepTimer, lastSleepTimer, hasShownInitialAlert, isPlaying]);

  // Reset alert flags when sleep timer is reset or disabled
  useEffect(() => {
    if (sleepTimer === 0) {
      setHasShownInitialAlert(false);
    }
  }, [sleepTimer]);

  // Force show sleep timer during last minute with second-by-second updates
  useEffect(() => {
    if (shouldForceSleepTimer) {
      setShowSleepTimer(true);
    }
  }, [shouldForceSleepTimer, sleepTimer]);

  // Reset to "Now Playing" when track changes (unless in Player UI where we show "Up Next" first)
  useEffect(() => {
    // Don't reset if sleep timer is in critical state (last minute)
    if (!shouldForceSleepTimer) {
      setShowUpNext(isPlayerVisible ? true : false);
      setShowSleepTimer(false);
    }
  }, [currentTrack.id, isPlayerVisible, shouldForceSleepTimer]);

  // Toggle between views with different timing based on context
  // Priority: Sleep Timer (last minute) > Sleep Timer (5min alert) > Normal rotation
  useEffect(() => {
    // If in last minute of sleep timer, don't rotate - keep showing sleep timer
    if (shouldForceSleepTimer) {
      return;
    }

    // If actively showing sleep timer alert (not forced), let the alert timeout handle it
    if (showSleepTimer && !shouldForceSleepTimer) {
      return;
    }

    let timeout: NodeJS.Timeout;
    
    const scheduleNext = () => {
      // Normal rotation without sleep timer interference
      if (!nextTrack || !isPlaying) {
        setShowUpNext(false);
        setShowSleepTimer(false);
        return;
      }

      const delay = showUpNext 
        ? (isPlayerVisible ? 20000 : 10000)
        : (isPlayerVisible ? 10000 : 20000);
      
      timeout = setTimeout(() => {
        setShowUpNext(prev => !prev);
      }, delay);
    };

    scheduleNext();

    return () => clearTimeout(timeout);
  }, [nextTrack, showUpNext, showSleepTimer, isPlaying, isPlayerVisible, shouldForceSleepTimer]);

  return (
    <>
      {/* Album Art - Clickable to open player, changes with text (fade transition) */}
      <button
        onClick={onOpenPlayer}
        className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden shrink-0 shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer relative"
        title="Open Player"
      >
        {/* Current Track Album Art */}
        <div 
          className={`absolute inset-0 transition-opacity duration-500 ${
            (showUpNext && nextTrack && isPlaying) || showSleepTimer || showGoodNight ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {currentTrack.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={currentTrack.albumArt} 
              alt="Album art" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 md:w-4 md:h-4 text-white/60" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
            </div>
          )}
        </div>

        {/* Next Track Album Art (fades in when showing "Up Next") */}
        {nextTrack && (
          <div 
            className={`absolute inset-0 transition-opacity duration-500 ${
              showUpNext && isPlaying && !showSleepTimer && !showGoodNight ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {nextTrack.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={nextTrack.albumArt} 
                alt="Next track album art" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 md:w-4 md:h-4 text-white/60" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Sleep Timer Icon (fades in when showing sleep timer alert) */}
        {sleepTimer > 0 && !showGoodNight && (
          <div 
            className={`absolute inset-0 transition-opacity duration-500 flex items-center justify-center ${
              showSleepTimer ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="w-full h-full bg-linear-to-br from-orange-500/30 to-red-500/30 backdrop-blur-sm flex items-center justify-center">
              <SleepIcon className="w-5 h-5 md:w-6 md:h-6 text-orange-400" />
            </div>
          </div>
        )}

        {/* Good Night Icon (fades in when showing good night message) */}
        {showGoodNight && (
          <div 
            className={`absolute inset-0 transition-opacity duration-500 flex items-center justify-center ${
              showGoodNight ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="w-full h-full bg-linear-to-br from-purple-500/30 to-indigo-500/30 backdrop-blur-sm flex items-center justify-center">
              <GoodNightIcon className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
            </div>
          </div>
        )}
      </button>

      {/* Track Info with Rolling Animation - Vertical on mobile, horizontal on desktop */}
      <div className="flex-1 min-w-0 overflow-hidden relative h-16 md:h-9">
        {/* Mobile: Vertical layout with rolling text */}
        <div className="md:hidden">
          {/* Now Playing / Paused */}
          <div 
            className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-in-out ${
              (showUpNext && nextTrack && isPlaying) || showSleepTimer || showGoodNight ? 'roll-text-exit' : 'roll-text-enter'
            }`}
            style={{
              transform: (showUpNext && nextTrack && isPlaying) || showSleepTimer || showGoodNight ? 'translateY(-100%)' : 'translateY(0)',
              opacity: (showUpNext && nextTrack && isPlaying) || showSleepTimer || showGoodNight ? 0 : 1,
            }}
          >
            <div className="flex items-center gap-1">
              <span className={`w-1 h-1 rounded-full shrink-0 ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
              <span className="text-[10px] text-white/60 font-medium">{isPlaying ? 'Now Playing' : 'Paused'}</span>
            </div>
            <ScrollingText
              text={currentTrack.title}
              className="text-xs font-semibold text-white"
              speed={50}
              pauseDuration={1000}
            />
            <ScrollingText
              text={currentTrack.artist}
              className="text-[10px] text-white/60"
              speed={50}
              pauseDuration={1000}
            />
          </div>

          {/* Up Next (only shows when there's actually a next track) */}
          {nextTrack && (
            <div 
              className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-in-out ${
                showUpNext && isPlaying && !showSleepTimer && !showGoodNight ? 'roll-text-enter' : 'roll-text-exit'
              }`}
              style={{
                transform: showUpNext && isPlaying && !showSleepTimer && !showGoodNight ? 'translateY(0)' : 'translateY(100%)',
                opacity: showUpNext && isPlaying && !showSleepTimer && !showGoodNight ? 1 : 0,
              }}
            >
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full shrink-0 bg-blue-500"></span>
                <span className="text-[10px] text-white/60 font-medium">Up Next</span>
              </div>
              <ScrollingText
                text={nextTrack.title}
                className="text-xs font-semibold text-white"
                speed={50}
                pauseDuration={1000}
              />
              <ScrollingText
                text={nextTrack.artist}
                className="text-[10px] text-white/60"
                speed={50}
                pauseDuration={1000}
              />
            </div>
          )}

          {/* Sleep Timer (only shows when active) */}
          {sleepTimer > 0 && (
            <div 
              className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-in-out ${
                showSleepTimer ? 'roll-text-enter' : 'roll-text-exit'
              }`}
              style={{
                transform: showSleepTimer ? 'translateY(0)' : 'translateY(100%)',
                opacity: showSleepTimer ? 1 : 0,
              }}
            >
              <div className="flex items-center gap-1">
                <span className={`w-1 h-1 rounded-full shrink-0 ${
                  sleepTimer <= 60 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
                }`}></span>
                <span className={`text-[10px] font-medium ${
                  sleepTimer <= 60 ? 'text-red-400' : 'text-white/60'
                }`}>
                  Sleep Timer
                </span>
              </div>
              <p className={`text-xs font-semibold ${
                sleepTimer <= 60 ? 'text-red-400' : 'text-white'
              }`}>
                {sleepTimer <= 60 ? `Pauses in ${formatSleepTimer(sleepTimer)}` : `Pauses in ${formatSleepTimer(sleepTimer)}`}
              </p>
            </div>
          )}

          {/* Good Night Message (shows when sleep timer ends) */}
          {showGoodNight && (
            <div 
              className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-in-out ${
                showGoodNight ? 'roll-text-enter' : 'roll-text-exit'
              }`}
              style={{
                transform: showGoodNight ? 'translateY(0)' : 'translateY(100%)',
                opacity: showGoodNight ? 1 : 0,
              }}
            >
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full shrink-0 bg-purple-500 animate-pulse"></span>
                <span className="text-[10px] font-medium text-purple-400">
                  Sleep Timer
                </span>
              </div>
              <p className="text-xs font-semibold text-purple-400">
                Good Night! 🌙
              </p>
            </div>
          )}
        </div>

        {/* Desktop: Horizontal single-line layout with rolling text */}
        <div className="hidden md:block">
          {/* Now Playing / Paused */}
          <div 
            className={`absolute inset-0 flex items-center transition-all duration-700 ease-in-out ${
              (showUpNext && nextTrack && isPlaying) || showSleepTimer || showGoodNight ? 'roll-text-exit' : 'roll-text-enter'
            }`}
            style={{
              transform: (showUpNext && nextTrack && isPlaying) || showSleepTimer || showGoodNight ? 'translateY(-100%)' : 'translateY(0)',
              opacity: (showUpNext && nextTrack && isPlaying) || showSleepTimer || showGoodNight ? 0 : 1,
            }}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-2 ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
            <span className="text-xs text-white/60 font-medium mr-2 shrink-0">{isPlaying ? 'Now Playing:' : 'Paused:'}</span>
            <ScrollingText
              text={`${currentTrack.title} by ${currentTrack.artist}`}
              className="text-sm font-semibold text-white flex-1"
              speed={50}
              pauseDuration={1000}
            />
          </div>

          {/* Up Next (only shows when there's actually a next track) */}
          {nextTrack && (
            <div 
              className={`absolute inset-0 flex items-center transition-all duration-700 ease-in-out ${
                showUpNext && isPlaying && !showSleepTimer && !showGoodNight ? 'roll-text-enter' : 'roll-text-exit'
              }`}
              style={{
                transform: showUpNext && isPlaying && !showSleepTimer && !showGoodNight ? 'translateY(0)' : 'translateY(100%)',
                opacity: showUpNext && isPlaying && !showSleepTimer && !showGoodNight ? 1 : 0,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mr-2 bg-blue-500"></span>
              <span className="text-xs text-white/60 font-medium mr-2 shrink-0">Up Next:</span>
              <ScrollingText
                text={`${nextTrack.title} by ${nextTrack.artist}`}
                className="text-sm font-semibold text-white flex-1"
                speed={50}
                pauseDuration={1000}
              />
            </div>
          )}

          {/* Sleep Timer (only shows when active) */}
          {sleepTimer > 0 && (
            <div 
              className={`absolute inset-0 flex items-center transition-all duration-700 ease-in-out ${
                showSleepTimer ? 'roll-text-enter' : 'roll-text-exit'
              }`}
              style={{
                transform: showSleepTimer ? 'translateY(0)' : 'translateY(100%)',
                opacity: showSleepTimer ? 1 : 0,
              }}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mr-2 ${
                sleepTimer <= 60 ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
              }`}></span>
              <span className={`text-xs font-medium mr-2 shrink-0 ${
                sleepTimer <= 60 ? 'text-red-400' : 'text-white/60'
              }`}>
                Sleep Timer:
              </span>
              <span className={`text-sm font-semibold ${
                sleepTimer <= 60 ? 'text-red-400' : 'text-white'
              }`}>
                Pauses in {formatSleepTimer(sleepTimer)}
              </span>
            </div>
          )}

          {/* Good Night Message (shows when sleep timer ends) */}
          {showGoodNight && (
            <div 
              className={`absolute inset-0 flex items-center transition-all duration-700 ease-in-out ${
                showGoodNight ? 'roll-text-enter' : 'roll-text-exit'
              }`}
              style={{
                transform: showGoodNight ? 'translateY(0)' : 'translateY(100%)',
                opacity: showGoodNight ? 1 : 0,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mr-2 bg-purple-500 animate-pulse"></span>
              <span className="text-xs font-medium mr-2 shrink-0 text-purple-400">
                Sleep Timer:
              </span>
              <span className="text-sm font-semibold text-purple-400">
                Good Night! 🌙
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Playback Controls - Always visible */}
      <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
        <button
          onClick={onPrevious}
          className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md md:rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all duration-200 group"
          title="Previous"
        >
          <svg className="w-3 h-3 md:w-4 md:h-4 text-white/80 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
          </svg>
        </button>

        <button
          onClick={onPlayPause}
          className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-md md:rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 transition-all duration-200 group"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={onNext}
          className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-md md:rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all duration-200 group"
          title="Next"
        >
          <svg className="w-3 h-3 md:w-4 md:h-4 text-white/80 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
          </svg>
        </button>
      </div>
    </>
  );
};
