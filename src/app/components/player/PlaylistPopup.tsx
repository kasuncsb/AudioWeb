import { AudioTrack } from './types';
import { ResizablePopup } from './ResizablePopup';
import { AnimatedMusicBars } from './AnimatedMusicBars';
import { ScrollingText } from './ScrollingText';

interface PlaylistPopupProps {
  show: boolean;
  playlist: AudioTrack[];
  position: { x: number; y: number };
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onSelectTrack: (index: number) => void;
  onRemoveTrack: (index: number) => void;
  onAddTracks: () => void;
  isPlaying?: boolean;
  isShuffling?: boolean;
  showVisualization?: boolean;
  className?: string;
}

export const PlaylistPopup: React.FC<PlaylistPopupProps> = ({
  show,
  playlist,
  position,
  onClose,
  onMouseDown,
  onSelectTrack,
  onRemoveTrack,
  onAddTracks,
  isPlaying = false,
  isShuffling = false,
  showVisualization = false,
  className = ''
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!show || playlist.length === 0) return null;

  return (
    <ResizablePopup
      show={show}
      className={`playlist-popup ${className}`}
      position={position}
      onClose={onClose}
      onMouseDown={onMouseDown}
      onAdd={onAddTracks}
      title={`Playlist (${playlist.length} songs)`}
      minWidth={380}
      minHeight={480}
      maxWidth={650}
      maxHeight={750}
      defaultWidth={480}
      defaultHeight={600}
      showVisualization={showVisualization}
    >
      <div className="playlist-scroll-area custom-scrollbar-themed h-full">
        <div className="space-y-2">
          {playlist.map((track, index) => (
            <div
              key={track.id}
              className={`playlist-item-virtual flex items-center gap-3 p-3 rounded-xl cursor-pointer group relative overflow-hidden ${track.isActive ? 'bg-white/15' : ''
                } ${isShuffling ? 'shuffle-item' : 'transition-all duration-200 hover:bg-white/10'}`}
              onClick={() => onSelectTrack(index)}
            >
              <div className="text-sm text-white/60 w-6 shrink-0">
                {track.isActive ? (
                  <AnimatedMusicBars className="w-4 h-4" isPlaying={isPlaying} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                {track.albumArt ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.albumArt}
                    alt="Album art"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <ScrollingText
                  text={track.title}
                  className={`font-medium text-sm ${track.isActive ? 'text-white' : 'text-white/80'}`}
                  speed={50}
                  pauseDuration={1000}
                />
                <ScrollingText
                  text={track.artist}
                  className="text-xs text-white/60"
                  speed={50}
                  pauseDuration={1000}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">{formatTime(track.duration)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTrack(index);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ResizablePopup>
  );
};
