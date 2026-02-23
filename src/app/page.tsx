'use client';

import Image from "next/image";
import Navbar from '@/app/components/navbar';
import Player from '@/app/components/player/Player';
import { useState } from 'react';
import { useWakeLock } from '@/hooks/useWakeLock';

interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  duration: number;
}

const Header = ({ onPlayClick }: { onPlayClick: () => void }) => (
  <section
    className="w-full relative flex flex-col items-center justify-center"
    style={{
      background: 'rgb(20, 20, 28)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='white' fill-opacity='0'/%3E%3Ccircle cx='20' cy='20' r='1' fill='white' fill-opacity='0.04'/%3E%3C/svg%3E")`,
      backgroundBlendMode: 'overlay',
      minHeight: 'calc(100dvh - 4.5rem)', // Full height minus navbar (dvh for mobile)
      paddingTop: '2rem',
      paddingBottom: '2rem',
    }}
  >
    <div className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10 px-4 md:px-8 grow">
      {/* Left */}
      <div className="flex-1 flex flex-col items-start justify-center gap-6 md:gap-8 max-w-xl order-2 md:order-1">
        <div className="flex flex-col items-start gap-4 md:gap-6 w-full">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[120%] text-white font-semibold">
            Music on-the-Web:
            <br />
            Anytime. Anywhere.
          </h1>
          <p className="text-sm sm:text-base md:text-lg leading-[150%] text-white/80">
            AudioWeb is a modern web music player built for simplicity. It delivers a smooth, uninterrupted listening experience through a clean interface that gets out of the way — letting you focus on what matters most: the music.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 w-full">
          <div className="flex flex-row items-center gap-3 md:gap-4 text-sm md:text-base font-medium w-full relative">
            <button
              onClick={onPlayClick}
              className="flex flex-row items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl bg-white border border-white/30 shadow transition-all duration-200 hover:bg-white hover:text-black hover:scale-105 active:bg-white active:text-black active:scale-95 focus:outline-none focus:ring-2 focus:ring-white text-black shrink-0"
              style={{ backdropFilter: 'blur(4px)' }}
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none">
                <path d="M10.5338 15.6882L15.4583 12.541C15.6654 12.4065 15.769 12.2257 15.769 11.9987C15.769 11.7719 15.6654 11.5921 15.4583 11.4595L10.5338 8.31223C10.3264 8.16689 10.1089 8.15606 9.88103 8.27973C9.65319 8.40356 9.53928 8.59464 9.53928 8.85298V15.1415C9.53928 15.4056 9.65319 15.5991 9.88103 15.722C10.1089 15.8448 10.3264 15.8336 10.5338 15.6882ZM12.0008 22.1497C10.6098 22.1497 9.29694 21.8841 8.06227 21.3527C6.82778 20.8214 5.74953 20.0947 4.82753 19.1727C3.90553 18.2507 3.17886 17.1727 2.64753 15.9387C2.11619 14.7047 1.85052 13.3921 1.85052 12.001C1.85052 10.5933 2.11619 9.27214 2.64753 8.03748C3.17886 6.80298 3.90519 5.72881 4.82652 4.81498C5.74786 3.90098 6.82569 3.17748 8.06003 2.64448C9.29436 2.11131 10.6073 1.84473 11.9988 1.84473C13.4068 1.84473 14.7284 2.11114 15.9635 2.64398C17.1985 3.17681 18.2728 3.89989 19.1863 4.81323C20.0999 5.72656 20.8232 6.80056 21.356 8.03523C21.889 9.26989 22.1555 10.5916 22.1555 12.0002C22.1555 13.3919 21.8889 14.705 21.3558 15.9395C20.8228 17.174 20.0993 18.252 19.1853 19.1735C18.2714 20.095 17.1975 20.8214 15.9635 21.3527C14.7295 21.8841 13.4086 22.1497 12.0008 22.1497ZM12 20.4465C14.3507 20.4465 16.3461 19.6236 17.9863 17.9777C19.6263 16.3317 20.4463 14.3392 20.4463 12.0002C20.4463 9.64956 19.6263 7.65414 17.9863 6.01398C16.3461 4.37398 14.3497 3.55398 11.997 3.55398C9.66103 3.55398 7.66978 4.37398 6.02327 6.01398C4.37694 7.65414 3.55377 9.65056 3.55377 12.0032C3.55377 14.3392 4.37669 16.3305 6.02253 17.977C7.66853 19.6233 9.66103 20.4465 12 20.4465Z" fill="black" />
              </svg>
              <span>Play</span>
            </button>
            <button
              onClick={() => {
                const alertEl = document.getElementById('wip-alert');
                if (alertEl) {
                  alertEl.style.opacity = '1';
                  alertEl.style.transform = 'translateY(0)';
                  setTimeout(() => {
                    alertEl.style.opacity = '0';
                    alertEl.style.transform = 'translateY(-10px)';
                  }, 3000);
                }
              }}
              className="flex flex-row items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl border border-white/30 bg-white/10 text-white shadow transition-all duration-200 hover:bg-white/20 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 shrink-0"
              style={{ backdropFilter: 'blur(4px)' }}
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none">
                <path d="M13.268 20.1424C12.19 20.1424 11.2911 19.7824 10.5712 19.0624C9.85124 18.3426 9.49124 17.4437 9.49124 16.3657C9.49124 15.2877 9.85124 14.3887 10.5712 13.6689C11.2911 12.9491 12.19 12.5892 13.268 12.5892C13.6807 12.5892 14.049 12.6467 14.373 12.7617C14.6972 12.8767 15.0199 13.0428 15.3412 13.2602V4.68416C15.3412 4.44016 15.4221 4.23624 15.5837 4.07241C15.7452 3.90858 15.9483 3.82666 16.193 3.82666H21.3695C21.6137 3.82666 21.8177 3.90858 21.9815 4.07241C22.1453 4.23624 22.2272 4.44016 22.2272 4.68416V5.93416C22.2272 6.17866 22.1453 6.38174 21.9815 6.54341C21.8177 6.70491 21.6137 6.78566 21.3695 6.78566H17.0445V16.3657C17.0445 17.4437 16.6846 18.3426 15.9647 19.0624C15.2447 19.7824 14.3458 20.1424 13.268 20.1424ZM6.12449 9.22816C5.33716 10.0155 4.70399 10.9298 4.22499 11.9712C3.74599 13.0125 3.46324 14.1613 3.37674 15.4177C3.35924 15.6605 3.27533 15.8682 3.12499 16.0409C2.97449 16.2136 2.78733 16.2999 2.56349 16.2999C2.32299 16.2999 2.13108 16.2086 1.98774 16.0259C1.84441 15.8432 1.78308 15.631 1.80374 15.3892C1.90658 13.91 2.23308 12.5584 2.78324 11.3344C3.33358 10.1102 4.07499 9.03391 5.00749 8.10541C5.93616 7.17274 7.01566 6.43216 8.24599 5.88366C9.47649 5.33533 10.8249 5.00799 12.2912 4.90166C12.5341 4.88499 12.7466 4.95124 12.9287 5.10041C13.1111 5.24974 13.2022 5.43591 13.2022 5.65891C13.2022 5.88191 13.1201 6.06924 12.9557 6.22091C12.7914 6.37241 12.5877 6.45691 12.3447 6.47441C11.0884 6.56091 9.93449 6.84466 8.88299 7.32566C7.83133 7.80666 6.91182 8.44083 6.12449 9.22816ZM8.27349 11.3509C7.75599 11.8676 7.34308 12.4749 7.03474 13.1729C6.72641 13.8709 6.53058 14.6449 6.44724 15.4949C6.41174 15.7204 6.32316 15.9109 6.18149 16.0664C6.03999 16.2221 5.85658 16.2999 5.63124 16.2999C5.40608 16.2999 5.21866 16.2182 5.06899 16.0549C4.91932 15.8917 4.85483 15.6985 4.87549 15.4752C4.96149 14.4165 5.20266 13.4502 5.59899 12.5762C5.99533 11.7022 6.52249 10.9362 7.18049 10.2782C7.83849 9.62016 8.60891 9.09266 9.49174 8.69566C10.3747 8.29866 11.3458 8.05774 12.405 7.97291C12.6285 7.95258 12.8172 8.01799 12.9712 8.16916C13.1252 8.32049 13.2022 8.50891 13.2022 8.73441C13.2022 8.95974 13.1244 9.14658 12.9687 9.29491C12.8131 9.44324 12.6226 9.52658 12.3972 9.54491C11.5472 9.62824 10.7768 9.82091 10.086 10.1229C9.39533 10.4249 8.79116 10.8342 8.27349 11.3509Z" fill="currentColor" />
              </svg>
              <span>Stream</span>
            </button>
          </div>
          {/* Fading Alert Message */}
          <div
            id="wip-alert"
            className="text-white/80 text-[13px] md:text-sm px-4 py-2 mt-2 rounded-xl border border-white/20 bg-white/5 shadow-sm transition-all duration-300 ease-in-out"
            style={{
              opacity: 0,
              transform: 'translateY(-10px)',
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)'
            }}
          >
            🚧 You just discovered a feature that's work in progress!
          </div>
        </div>
      </div>
      {/* Right */}
      <div className="shrink-0 relative transition-transform duration-300 hover:scale-105 cursor-pointer flex flex-col items-center md:items-end order-1 md:order-2">
        <Image
          className="w-70 h-70 sm:w-80 sm:h-80 md:w-95 md:h-95 lg:w-105 lg:h-105 xl:w-125 xl:h-125 rounded-4xl md:rounded-[45px] object-cover shadow-xl"
          width={500}
          height={500}
          sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, (max-width: 1024px) 380px, (max-width: 1280px) 420px, 500px"
          alt="hero_img"
          src="/images/hero-img.svg"
          loading="lazy"
          onContextMenu={e => e.preventDefault()}
        />
        <span className="mt-2 text-xs sm:text-sm text-white/70 font-sans text-center">
          Image credit: Freepik
        </span>
      </div>
    </div>
    {/* Bottom credits - now in normal flow */}
    <div className="mt-8 text-sm md:text-base text-white/70 font-sans text-center select-none">
      Made with{" "}
      <span className="inline-block text-red-400 transition-transform duration-200 hover:scale-125">
        ❤️
      </span>{" "}
      from Sri Lanka
    </div>
  </section>
);

export default function Home() {
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [nextTrack, setNextTrack] = useState<AudioTrack | null>(null);
  const [sleepTimer, setSleepTimer] = useState(0);
  const [showVisualization, setShowVisualization] = useState(false);

  // Keep the screen awake while the visualizer is active
  useWakeLock(showVisualization);

  const handlePlayClick = () => {
    setIsPlayerVisible(true);
  };

  const handleClosePlayer = () => {
    setIsPlayerVisible(false);
  };

  const handleOpenPlayer = () => {
    setIsPlayerVisible(true);
  };

  const handlePlayingChange = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const handleTrackChange = (current: AudioTrack | null, next: AudioTrack | null) => {
    setCurrentTrack(current);
    setNextTrack(next);
  };

  const handleSleepTimerChange = (timer: number) => {
    // Only turn off visualization when timer actually expires (was active, now 0)
    if (timer === 0 && sleepTimer > 0 && showVisualization) {
      setShowVisualization(false);
    }
    setSleepTimer(timer);
  };

  const handleVisualizationChange = (visualization: boolean) => {
    setShowVisualization(visualization);
  };

  const handlePlayPause = () => {
    // This will be passed down from Player
    const event = new CustomEvent('playerPlayPause');
    window.dispatchEvent(event);
  };

  const handleNext = () => {
    const event = new CustomEvent('playerNext');
    window.dispatchEvent(event);
  };

  const handlePrevious = () => {
    const event = new CustomEvent('playerPrevious');
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen bg-black relative page-scroll">
      <Navbar
        isPlaying={isPlaying}
        currentTrack={currentTrack}
        nextTrack={nextTrack}
        isPlayerVisible={isPlayerVisible}
        sleepTimer={sleepTimer}
        showNowPlaying={!isPlayerVisible && currentTrack !== null}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onOpenPlayer={handleOpenPlayer}
        showVisualization={showVisualization}
      />
      {/* Hide home content when Player is visible to prevent showing through navbar */}
      {!isPlayerVisible && (
        <main className="pt-18 custom-scrollbar-auto relative z-10"> {/* Account for fixed navbar, z-10 to sit above MilkDrop canvas */}
          <Header onPlayClick={handlePlayClick} />
        </main>
      )}
      <Player
        isVisible={isPlayerVisible}
        onClose={handleClosePlayer}
        onPlayingChange={handlePlayingChange}
        onTrackChange={handleTrackChange}
        onSleepTimerChange={handleSleepTimerChange}
        onVisualizationChange={handleVisualizationChange}
        showVisualization={showVisualization}
      />
    </div>
  );
}
