import React from 'react';

interface SecondaryControlsProps {
  onShuffleClick: () => void;
  repeatMode: number;
  onRepeatToggle: () => void;
  onPlaylistToggle: () => void;
  onSleepTimerToggle: () => void;
  onEqualizerToggle: () => void;
  onVisualizationToggle: () => void;
  sleepTimer: number;
  showVisualization: boolean;
}

export const SecondaryControls: React.FC<SecondaryControlsProps> = React.memo(({
  onShuffleClick,
  repeatMode,
  onRepeatToggle,
  onPlaylistToggle,
  onSleepTimerToggle,
  onEqualizerToggle,
  onVisualizationToggle,
  sleepTimer,
  showVisualization
}) => {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
      {/* Shuffle */}
      <button
        onClick={onShuffleClick}
        className="p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 mobile-no-select touch-target flex items-center justify-center bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
        style={{ backdropFilter: 'blur(8px)' }}
        title="Shuffle Playlist"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17h4.5a3 3 0 003-3v-4a3 3 0 013-3H21m0 0l-3-3m3 3l-3 3M3 7h4.5a3 3 0 013 3v4a3 3 0 003 3H21m0 0l-3-3m3 3l-3 3" />
        </svg>
      </button>

      {/* Repeat */}
      <button
        onClick={onRepeatToggle}
        className={`p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 relative mobile-no-select touch-target flex items-center justify-center ${
          repeatMode > 0 ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
        }`}
        style={{ backdropFilter: 'blur(8px)' }}
        title={repeatMode === 0 ? "Repeat: OFF" : repeatMode === 1 ? "Repeat: All" : "Repeat: One"}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
        </svg>
        {repeatMode === 2 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-white text-black text-[10px] sm:text-xs flex items-center justify-center rounded-full font-bold">
            1
          </span>
        )}
      </button>

      {/* Playlist */}
      <button
        onClick={onPlaylistToggle}
        className="p-2 sm:p-2.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95 mobile-no-select touch-target flex items-center justify-center"
        style={{ backdropFilter: 'blur(8px)' }}
        title="Playlist"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sleep Timer */}
      <button
        onClick={onSleepTimerToggle}
        className={`p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 mobile-no-select touch-target flex items-center justify-center ${
          sleepTimer > 0 ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
        }`}
        style={{ backdropFilter: 'blur(8px)' }}
        title="Sleep Timer"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
        </svg>
      </button>

      {/* Equalizer */}
      <button
        onClick={onEqualizerToggle}
        className="p-2 sm:p-2.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95 mobile-no-select touch-target flex items-center justify-center"
        style={{ backdropFilter: 'blur(8px)' }}
        title="Equalizer"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {/* Visualization */}
      <button
        onClick={onVisualizationToggle}
        className={`p-2 sm:p-2.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 mobile-no-select touch-target flex items-center justify-center ${
          showVisualization ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
        }`}
        style={{ backdropFilter: 'blur(8px)' }}
        title="Visualization"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 13h2v8H3v-8zm4-4h2v12H7V9zm4-6h2v18h-2V3zm4 8h2v10h-2V11zm4-2h2v12h-2V9z"/>
        </svg>
      </button>
    </div>
  );
});

SecondaryControls.displayName = 'SecondaryControls';
