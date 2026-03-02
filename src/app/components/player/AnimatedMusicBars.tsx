'use client';

import React from 'react';

interface AnimatedMusicBarsProps {
  className?: string;
  isPlaying?: boolean;
}

export const AnimatedMusicBars: React.FC<AnimatedMusicBarsProps> = React.memo(({ 
  className = "w-4 h-4", 
  isPlaying = true 
}) => {
  return (
    <div className={`flex items-end justify-center gap-0.5 ${className}`}>
      <div className={isPlaying ? "music-bar-1" : "music-bar-paused"}></div>
      <div className={isPlaying ? "music-bar-2" : "music-bar-paused"}></div>
      <div className={isPlaying ? "music-bar-3" : "music-bar-paused"}></div>
      <div className={isPlaying ? "music-bar-4" : "music-bar-paused"}></div>
    </div>
  );
});

AnimatedMusicBars.displayName = 'AnimatedMusicBars';
