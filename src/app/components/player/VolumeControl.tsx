import { useState, useEffect } from 'react';

interface VolumeControlProps {
  volume: number;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  onVolumeChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);

  // Display local volume when dragging, otherwise use prop
  const displayVolume = isDragging ? localVolume : volume;

  // Update local volume when not interacting
  useEffect(() => {
    if (!isDragging) {
      setLocalVolume(volume);
    }
  }, [volume, isDragging]);

  // Determine which speaker icon to show based on volume level
  const getSpeakerIcon = () => {
    const roundedVolume = Math.round(displayVolume);
    
    if (roundedVolume === 0) {
      // Muted - speaker with X
      return (
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        </svg>
      );
    } else if (roundedVolume <= 33) {
      // Low volume (1-33%) - speaker with no waves
      return (
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3z"/>
        </svg>
      );
    } else if (roundedVolume <= 66) {
      // Medium volume (34-66%) - speaker with one wave
      return (
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
      );
    } else {
      // High volume (67-100%) - speaker with two waves
      return (
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setLocalVolume(newVolume);
    onVolumeChange(e);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {getSpeakerIcon()}
      <input
        type="range"
        min="0"
        max="100"
        value={displayVolume}
        onChange={handleChange}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 h-2 sm:h-3 bg-white/20 rounded-lg appearance-none cursor-pointer slider mobile-no-select touch-target"
        style={{
          background: `linear-gradient(to right, #ffffff ${displayVolume}%, rgba(255,255,255,0.2) ${displayVolume}%)`,
          minHeight: '44px'
        }}
      />
      <span className="text-xs sm:text-sm text-white/60 min-w-[2ch] shrink-0">{Math.round(displayVolume)}</span>
    </div>
  );
};
