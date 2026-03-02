'use client';

import React from 'react';
import Image from 'next/image';
import { useState } from 'react';
import { AboutPopup } from './about';
import { SupportPopup } from './contact';
import { NowPlayingBar } from './NowPlayingBar';
import { AudioTrack } from './player/types';

// Inter font is loaded globally in layout.tsx

interface NavbarProps {
  isPlaying?: boolean;
  currentTrack?: AudioTrack | null;
  nextTrack?: AudioTrack | null;
  isPlayerVisible?: boolean; // New prop to control navbar controls visibility
  sleepTimer?: number;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  showNowPlaying?: boolean;
  onOpenPlayer?: () => void;
  showVisualization?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  isPlaying = false,
  currentTrack = null,
  nextTrack = null,
  isPlayerVisible = false,
  sleepTimer = 0,
  onPlayPause,
  onNext,
  onPrevious,
  showNowPlaying = false,
  onOpenPlayer,
  showVisualization = false
}) => {
  const [open, setOpen] = useState(false);
  const [logoPressed, setLogoPressed] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full flex items-center justify-between px-4 md:px-16 z-50 `}
        style={{
          height: '4.5rem', // Slightly taller for modern look
          // iOS 18-like glassy background with subtle texture - more transparent when visualization active
          background: showVisualization ? 'rgba(15, 15, 20, 0.35)' : 'rgba(30, 30, 40, 0.65)',
          backdropFilter: 'var(--blur-heavy)',
          WebkitBackdropFilter: 'var(--blur-heavy)',
          borderBottom: showVisualization ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 24px 0 rgba(0,0,0,0.10)',
          backgroundImage: showVisualization ? 'none' : `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='white' fill-opacity='0'/%3E%3Ccircle cx='20' cy='20' r='1' fill='white' fill-opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundBlendMode: 'overlay',
          // Remove border radius and margin to make it flush with the top
          borderRadius: 0,
          margin: 0,
          transition: 'background 3s ease, border-bottom 3s ease',
        }}
      >
        {/* Left: Logo + Title - Hidden on mobile when mini player is active */}
        <div className={`flex items-center space-x-3 px-2 transition-all duration-300 ${currentTrack ? 'hidden md:flex' : 'flex'
          }`}>
          <span
            className={`
            transition-transform duration-200 cursor-pointer
            ${logoPressed ? 'scale-90' : ''}
            ${!logoPressed ? 'hover:scale-110' : ''}
          `}
            onMouseDown={() => setLogoPressed(true)}
            onMouseUp={() => setLogoPressed(false)}
            onMouseLeave={() => setLogoPressed(false)}
            onTouchStart={() => setLogoPressed(true)}
            onTouchEnd={() => setLogoPressed(false)}
          >
            <Image
              src="/images/aw-logo.svg"
              alt="AudioWeb logo"
              width={40}
              height={40}
              className="drop-shadow-lg"
              onContextMenu={e => e.preventDefault()}
            />
          </span>
          <span className={showNowPlaying && currentTrack ? 'hidden md:block' : ''}>
            <h1 className="text-base md:text-xl font-medium text-white tracking-tight select-none m-0">
              AudioWeb
            </h1>
          </span>
        </div>

        {/* Center: Now Playing Bar - Full width on mobile when active, max-w-2xl on desktop */}
        <div
          className={`flex items-center gap-2 md:gap-3 mx-2 md:mx-4 transition-all duration-500 ease-in-out ${currentTrack
            ? 'opacity-100 scale-100 flex-1 md:max-w-2xl'
            : 'opacity-0 scale-95 pointer-events-none flex-1 md:max-w-2xl'
            }`}
        >
          {currentTrack && (
            <NowPlayingBar
              currentTrack={currentTrack}
              nextTrack={nextTrack}
              isPlaying={isPlaying}
              isPlayerVisible={isPlayerVisible}
              sleepTimer={sleepTimer}
              onPlayPause={onPlayPause!}
              onNext={onNext!}
              onPrevious={onPrevious!}
              onOpenPlayer={onOpenPlayer}
            />
          )}
        </div>

        {/* Right: Links (hidden on mobile) */}
        <nav className="hidden md:flex items-center space-x-6 text-white">
          <button
            onClick={() => setShowAbout(true)}
            className="flex items-center space-x-1 px-3 py-1 rounded-lg transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M12.0117 2.34473C13.3516 2.34477 14.6027 2.59809 15.7695 3.10254C16.9462 3.61134 17.9659 4.30004 18.833 5.16699C19.7001 6.03378 20.3887 7.05443 20.8975 8.2334C21.4022 9.40259 21.6552 10.6543 21.6553 11.9932C21.6553 13.3319 21.402 14.5814 20.8975 15.7461C20.3884 16.9214 19.6994 17.9438 18.8311 18.8164C17.9636 19.6881 16.9427 20.3794 15.7646 20.8896C14.5963 21.3955 13.3456 21.6494 12.0078 21.6494C10.6694 21.6494 9.42003 21.3966 8.25488 20.8936C7.08054 20.3865 6.05674 19.6954 5.18066 18.8193C4.3047 17.9433 3.61344 16.9191 3.10645 15.7441C2.60352 14.5785 2.35059 13.3281 2.35059 11.9883C2.35061 10.6486 2.60338 9.39792 3.10645 8.23145C3.55002 7.20308 4.13437 6.29415 4.85938 5.50195L5.17871 5.16992C6.05427 4.30133 7.07845 3.61261 8.25488 3.10352C9.42089 2.59878 10.6716 2.34473 12.0117 2.34473ZM11.9971 3.05371C9.52988 3.05371 7.41172 3.9245 5.6709 5.65527C3.92864 7.38755 3.05378 9.51343 3.05371 12.0029C3.05371 14.4709 3.92916 16.5895 5.66895 18.3301C7.40959 20.0711 9.53397 20.9463 12.0127 20.9463C14.4867 20.9463 16.606 20.0718 18.3408 18.3311C20.0753 16.5903 20.9463 14.4654 20.9463 11.9873C20.9462 9.51441 20.0762 7.39604 18.3447 5.66113C16.6122 3.92526 14.4861 3.05371 11.9971 3.05371ZM12.0723 11.5C12.1523 11.5001 12.209 11.5177 12.2568 11.5508L12.3027 11.5889C12.361 11.6469 12.3906 11.7118 12.3906 11.8164V16.25C12.3906 16.3566 12.3606 16.422 12.3037 16.4795C12.2483 16.5354 12.1848 16.5664 12.0781 16.5664C11.9981 16.5664 11.9414 16.5486 11.8936 16.5156L11.8477 16.4775C11.7893 16.4195 11.7598 16.3546 11.7598 16.25V11.8164C11.7598 11.7098 11.7898 11.6444 11.8467 11.5869C11.9021 11.531 11.9656 11.5 12.0723 11.5ZM12.001 7.91016C12.1315 7.91023 12.2187 7.94991 12.2959 8.02832C12.3708 8.10449 12.415 8.19934 12.415 8.35059C12.415 8.44168 12.3946 8.51001 12.3525 8.56934L12.3027 8.62598C12.2268 8.69967 12.1373 8.74023 12 8.74023C11.8623 8.74022 11.7723 8.69978 11.6963 8.62598C11.6224 8.55417 11.585 8.47293 11.585 8.34766C11.585 8.19789 11.6287 8.10291 11.7031 8.02637C11.7761 7.95146 11.8631 7.91016 12.001 7.91016Z" fill="currentColor" stroke="currentColor" />
            </svg>
            <span>About</span>
          </button>
          <button
            onClick={() => setShowContact(true)}
            className="flex items-center space-x-1 px-3 py-1 rounded-lg transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M18.364 5.636L14.828 9.172M18.364 5.636C16.6762 3.94817 14.3869 3 12 3C9.61305 3 7.32383 3.94817 5.636 5.636M18.364 5.636C20.0518 7.32383 21 9.61305 21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5283 18.364 18.364M14.828 9.172C14.0779 8.42185 13.0609 8 12 8C10.9391 8 9.92215 8.42185 9.172 9.172M14.828 9.172C15.5781 9.92215 16 10.9391 16 12C16 13.0609 15.5781 14.0779 14.828 14.828M14.828 14.828L18.364 18.364M14.828 14.828C14.0779 15.5781 13.0609 16 12 16C10.9391 16 9.92215 15.5781 9.172 14.828M18.364 18.364C17.5283 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47173 19.1997 5.636 18.364M9.172 9.172L5.636 5.636M9.172 9.172C8.42185 9.92215 8 10.9391 8 12C8 13.0609 8.42185 14.0779 9.172 14.828M5.636 5.636C3.94817 7.32383 3 9.61305 3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80027 17.5283 5.636 18.364M9.172 14.828L5.636 18.364" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Contact</span>
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-white focus:outline-none rounded-lg transition-all duration-200 hover:bg-white/10 hover:scale-110 active:scale-95"
          onClick={() => setOpen(!open)}
          aria-label="Open menu"
        >
          <div className="space-y-1">
            <span className={`block w-6 h-0.5 bg-white rounded transition-all duration-300 ${open ? 'rotate-45 translate-y-1.5' : ''}`}></span>
            <span className={`block w-6 h-0.5 bg-white rounded transition-all duration-300 ${open ? 'opacity-0' : ''}`}></span>
            <span className={`block w-6 h-0.5 bg-white rounded transition-all duration-300 ${open ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
          </div>
        </button>
      </header>

      {/* Mobile menu (sliding down) */}
      <div
        className={`fixed top-18 left-0 w-full z-60 transition-all duration-300 md:hidden ${open ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none -translate-y-2'
          }`}
        style={{
          background: showVisualization ? 'rgba(15, 15, 20, 0.35)' : 'rgba(30, 30, 40, 0.95)',
          backdropFilter: 'var(--blur-popup)',
          WebkitBackdropFilter: 'var(--blur-popup)',
          borderBottom: showVisualization ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.08)',
          backgroundImage: showVisualization ? 'none' : `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='white' fill-opacity='0'/%3E%3Ccircle cx='20' cy='20' r='1' fill='white' fill-opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundBlendMode: 'overlay',
        }}
      >
        <div className="flex flex-col items-center py-4 space-y-3">
          <button
            onClick={() => {
              setShowAbout(true);
              setOpen(false);
            }}
            className="flex items-center space-x-1 text-white px-4 py-2 rounded-lg transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M12.0117 2.34473C13.3516 2.34477 14.6027 2.59809 15.7695 3.10254C16.9462 3.61134 17.9659 4.30004 18.833 5.16699C19.7001 6.03378 20.3887 7.05443 20.8975 8.2334C21.4022 9.40259 21.6552 10.6543 21.6553 11.9932C21.6553 13.3319 21.402 14.5814 20.8975 15.7461C20.3884 16.9214 19.6994 17.9438 18.8311 18.8164C17.9636 19.6881 16.9427 20.3794 15.7646 20.8896C14.5963 21.3955 13.3456 21.6494 12.0078 21.6494C10.6694 21.6494 9.42003 21.3966 8.25488 20.8936C7.08054 20.3865 6.05674 19.6954 5.18066 18.8193C4.3047 17.9433 3.61344 16.9191 3.10645 15.7441C2.60352 14.5785 2.35059 13.3281 2.35059 11.9883C2.35061 10.6486 2.60338 9.39792 3.10645 8.23145C3.55002 7.20308 4.13437 6.29415 4.85938 5.50195L5.17871 5.16992C6.05427 4.30133 7.07845 3.61261 8.25488 3.10352C9.42089 2.59878 10.6716 2.34473 12.0117 2.34473ZM11.9971 3.05371C9.52988 3.05371 7.41172 3.9245 5.6709 5.65527C3.92864 7.38755 3.05378 9.51343 3.05371 12.0029C3.05371 14.4709 3.92916 16.5895 5.66895 18.3301C7.40959 20.0711 9.53397 20.9463 12.0127 20.9463C14.4867 20.9463 16.606 20.0718 18.3408 18.3311C20.0753 16.5903 20.9463 14.4654 20.9463 11.9873C20.9462 9.51441 20.0762 7.39604 18.3447 5.66113C16.6122 3.92526 14.4861 3.05371 11.9971 3.05371ZM12.0723 11.5C12.1523 11.5001 12.209 11.5177 12.2568 11.5508L12.3027 11.5889C12.361 11.6469 12.3906 11.7118 12.3906 11.8164V16.25C12.3906 16.3566 12.3606 16.422 12.3037 16.4795C12.2483 16.5354 12.1848 16.5664 12.0781 16.5664C11.9981 16.5664 11.9414 16.5486 11.8936 16.5156L11.8477 16.4775C11.7893 16.4195 11.7598 16.3546 11.7598 16.25V11.8164C11.7598 11.7098 11.7898 11.6444 11.8467 11.5869C11.9021 11.531 11.9656 11.5 12.0723 11.5ZM12.001 7.91016C12.1315 7.91023 12.2187 7.94991 12.2959 8.02832C12.3708 8.10449 12.415 8.19934 12.415 8.35059C12.415 8.44168 12.3946 8.51001 12.3525 8.56934L12.3027 8.62598C12.2268 8.69967 12.1373 8.74023 12 8.74023C11.8623 8.74022 11.7723 8.69978 11.6963 8.62598C11.6224 8.55417 11.585 8.47293 11.585 8.34766C11.585 8.19789 11.6287 8.10291 11.7031 8.02637C11.7761 7.95146 11.8631 7.91016 12.001 7.91016Z" fill="currentColor" stroke="currentColor" />
            </svg>
            <span>About</span>
          </button>
          <button
            onClick={() => {
              setShowContact(true);
              setOpen(false);
            }}
            className="flex items-center space-x-1 text-white px-4 py-2 rounded-lg transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M18.364 5.636L14.828 9.172M18.364 5.636C16.6762 3.94817 14.3869 3 12 3C9.61305 3 7.32383 3.94817 5.636 5.636M18.364 5.636C20.0518 7.32383 21 9.61305 21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5283 18.364 18.364M14.828 9.172C14.0779 8.42185 13.0609 8 12 8C10.9391 8 9.92215 8.42185 9.172 9.172M14.828 9.172C15.5781 9.92215 16 10.9391 16 12C16 13.0609 15.5781 14.0779 14.828 14.828M14.828 14.828L18.364 18.364M14.828 14.828C14.0779 15.5781 13.0609 16 12 16C10.9391 16 9.92215 15.5781 9.172 14.828M18.364 18.364C17.5283 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47173 19.1997 5.636 18.364M9.172 9.172L5.636 5.636M9.172 9.172C8.42185 9.92215 8 10.9391 8 12C8 13.0609 8.42185 14.0779 9.172 14.828M5.636 5.636C3.94817 7.32383 3 9.61305 3 12C3 13.1819 3.23279 14.3522 3.68508 15.4442C4.13738 16.5361 4.80027 17.5283 5.636 18.364M9.172 14.828L5.636 18.364" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Contact</span>
          </button>
        </div>
      </div>

      {/* Popups - Moved outside header to avoid z-index conflicts */}
      <>
        <AboutPopup
          show={showAbout}
          onClose={() => setShowAbout(false)}
          isPlaying={isPlaying}
          showVisualization={showVisualization}
        />
        <SupportPopup
          show={showContact}
          onClose={() => setShowContact(false)}
          showVisualization={showVisualization}
        />
      </>
    </>
  );
};

export default Navbar;
