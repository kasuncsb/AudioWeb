'use client';

/**
 * ScrollStyles Component
 * 
 * Provides global CSS styles to hide scrollbars across all browsers while maintaining
 * scrolling functionality. This ensures a clean, modern UI without visible scrollbars.
 * 
 * Applied globally at the layout level to ensure consistent behavior across:
 * - Home page content
 * - About popup
 * - Contact/Support popup
 * - Player components
 * - Any other scrollable content
 */
export const ScrollStyles = () => (
  <style jsx global>{`
    /*
     * Universal scrollbar hiding — DESKTOP ONLY (pointer: fine).
     * On touch / mobile devices we keep native scrollbars visible so users
     * can drag them.  Themed-scrollbar classes below provide consistent
     * styling for the visible bars.
     */
    @media (pointer: fine) {
      * {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      *::-webkit-scrollbar {
        display: none;
      }

      html, body {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      html::-webkit-scrollbar, body::-webkit-scrollbar {
        display: none;
      }

      div, section, main, article, aside, nav, ul, ol, li, pre, code {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      div::-webkit-scrollbar, 
      section::-webkit-scrollbar, 
      main::-webkit-scrollbar, 
      article::-webkit-scrollbar, 
      aside::-webkit-scrollbar, 
      nav::-webkit-scrollbar, 
      ul::-webkit-scrollbar, 
      ol::-webkit-scrollbar, 
      li::-webkit-scrollbar, 
      pre::-webkit-scrollbar, 
      code::-webkit-scrollbar {
        display: none;
      }

      /* Custom scrollbar utility classes — hide on desktop */
      .custom-scrollbar,
      .custom-scrollbar-enhanced,
      .custom-scrollbar-thin,
      .custom-scrollbar-invisible,
      .custom-scrollbar-auto {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .custom-scrollbar::-webkit-scrollbar,
      .custom-scrollbar-enhanced::-webkit-scrollbar,
      .custom-scrollbar-thin::-webkit-scrollbar,
      .custom-scrollbar-invisible::-webkit-scrollbar,
      .custom-scrollbar-auto::-webkit-scrollbar {
        display: none;
      }

      .scroll-container {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .scroll-container::-webkit-scrollbar {
        display: none;
      }
    }

    /*
     * Scrollable utility classes — overflow & touch smoothing apply
     * regardless of pointer type.
     */
    .custom-scrollbar,
    .custom-scrollbar-enhanced,
    .custom-scrollbar-thin,
    .custom-scrollbar-invisible,
    .custom-scrollbar-auto {
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .scroll-container {
      overflow-y: auto;
      min-height: 0;
      flex: 1;
    }

    /*
     * Mobile: show a thin, semi-transparent scrollbar on touch devices
     * so that all scrollable areas are easy to identify and drag.
     */
    @media (pointer: coarse) {
      .custom-scrollbar,
      .custom-scrollbar-enhanced,
      .custom-scrollbar-thin,
      .custom-scrollbar-auto,
      .scroll-container {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
      }

      .custom-scrollbar::-webkit-scrollbar,
      .custom-scrollbar-enhanced::-webkit-scrollbar,
      .custom-scrollbar-thin::-webkit-scrollbar,
      .custom-scrollbar-auto::-webkit-scrollbar,
      .scroll-container::-webkit-scrollbar {
        width: 14px;
        display: block;
      }

      .custom-scrollbar::-webkit-scrollbar-track,
      .custom-scrollbar-enhanced::-webkit-scrollbar-track,
      .custom-scrollbar-thin::-webkit-scrollbar-track,
      .custom-scrollbar-auto::-webkit-scrollbar-track,
      .scroll-container::-webkit-scrollbar-track {
        background: transparent;
      }

      .custom-scrollbar::-webkit-scrollbar-thumb,
      .custom-scrollbar-enhanced::-webkit-scrollbar-thumb,
      .custom-scrollbar-thin::-webkit-scrollbar-thumb,
      .custom-scrollbar-auto::-webkit-scrollbar-thumb,
      .scroll-container::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.25);
        border-radius: 10px;
        border: 3px solid transparent;
        background-clip: padding-box;
      }

      .custom-scrollbar::-webkit-scrollbar-thumb:active,
      .custom-scrollbar-enhanced::-webkit-scrollbar-thumb:active,
      .custom-scrollbar-thin::-webkit-scrollbar-thumb:active,
      .custom-scrollbar-auto::-webkit-scrollbar-thumb:active,
      .scroll-container::-webkit-scrollbar-thumb:active {
        background: rgba(255, 255, 255, 0.5);
        background-clip: padding-box;
      }

      /* Invisible variant stays hidden even on mobile */
      .custom-scrollbar-invisible {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .custom-scrollbar-invisible::-webkit-scrollbar {
        display: none;
      }
    }
  `}</style>
);
