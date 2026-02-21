import { AudioTrack } from './types';
import { ScrollingText } from './ScrollingText';

interface AlbumArtProps {
  currentTrack: AudioTrack | null;
}

export const AlbumArt: React.FC<AlbumArtProps> = ({
  currentTrack
}) => {
  if (!currentTrack) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="relative group">
        <div
          className="w-full aspect-square rounded-[20px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all duration-300 hover:scale-105 flex items-center justify-center"
          style={{
            background: currentTrack.albumArt ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
            backdropFilter: currentTrack.albumArt ? 'none' : 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          {currentTrack.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentTrack.albumArt}
              alt={`${currentTrack.album} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="text-white/70">No Album Art</p>
            </div>
          )}
        </div>
      </div>

      <div className="text-center">
        <ScrollingText
          text={currentTrack.title}
          className="text-xl font-semibold text-white mb-1"
          speed={50}
          pauseDuration={1200}
        />
        <ScrollingText
          text={currentTrack.artist}
          className="text-white/70 mb-1"
          speed={50}
          pauseDuration={1200}
        />
        <ScrollingText
          text={currentTrack.album || 'Unknown Album'}
          className="text-white/50 text-sm"
          speed={50}
          pauseDuration={1200}
        />
      </div>
    </div>
  );
};
