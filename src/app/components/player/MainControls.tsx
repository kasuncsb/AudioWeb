import React from 'react';

interface MainControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

export const MainControls: React.FC<MainControlsProps> = React.memo(({
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext
}) => {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      {/* Previous */}
      <button 
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="p-2 sm:p-3 rounded-full bg-white/10 text-white transition-all duration-200 hover:bg-white/20 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mobile-no-select touch-target"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z"/>
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="p-3 sm:p-4 rounded-full bg-white text-black shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/50 mobile-no-select touch-target"
      >
        {isPlaying ? (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 4a1 1 0 011 1v10a1 1 0 01-2 0V5a1 1 0 011-1zM14 4a1 1 0 011 1v10a1 1 0 01-2 0V5a1 1 0 011-1z"/>
          </svg>
        ) : (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/>
          </svg>
        )}
      </button>

      {/* Next */}
      <button 
        onClick={onNext}
        disabled={!canGoNext}
        className="p-2 sm:p-3 rounded-full bg-white/10 text-white transition-all duration-200 hover:bg-white/20 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mobile-no-select touch-target"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z"/>
        </svg>
      </button>
    </div>
  );
});

MainControls.displayName = 'MainControls';
