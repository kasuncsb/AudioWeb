'use client';

import React from 'react';

interface SupportPopupProps {
  show: boolean;
  onClose: () => void;
  showVisualization?: boolean;
}

const SupportOption: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
}> = ({ icon, title, description, href, onClick }) => {
  const Component = href ? 'a' : 'button';
  const props = href
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { onClick };

  return (
    <Component
      {...props}
      className="flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 hover:scale-[1.02] text-left w-full"
    >
      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-white font-medium text-sm mb-1">{title}</h3>
        <p className="text-white/70 text-xs leading-relaxed">{description}</p>
      </div>
      <svg className="w-4 h-4 text-white/40 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </Component>
  );
};

export const SupportPopup: React.FC<SupportPopupProps> = ({ show, onClose, showVisualization = false }) => {
  if (!show) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleEmailClick = () => {
    window.location.href = 'mailto:me@kasunc.uk?subject=AudioWeb Feedback';
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 transition-all duration-500"
      style={{
        background: showVisualization ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.8)',
        backdropFilter: showVisualization ? 'none' : 'blur(20px) saturate(120%)',
        WebkitBackdropFilter: showVisualization ? 'none' : 'blur(20px) saturate(120%)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl p-6 transition-all duration-500"
        style={{
          background: showVisualization ? 'rgba(15, 15, 20, 0.35)' : 'rgba(20, 20, 28, 0.95)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: showVisualization ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: showVisualization ? '0 8px 32px rgba(0, 0, 0, 0.2)' : '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 flex items-center justify-center"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m0 4h.01" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Need help?</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Found a bug, have a feature request, or need assistance with the audio player?
              Choose the best way to get in touch below.
            </p>
          </div>

          {/* Support Options */}
          <div className="space-y-3">
            <SupportOption
              icon={
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              title="Email Support"
              description="Send a direct email for personal assistance with any questions or issues."
              onClick={handleEmailClick}
            />

          </div>

          {/* Additional Info */}
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="text-center">
              <h3 className="text-white font-medium text-sm mb-2">Quick Tips</h3>
              <div className="space-y-2 text-xs text-white/60">
                <p>• Try refreshing the page if audio playback stops working</p>
                <p>• Make sure your browser allows audio autoplay</p>
                <p>• Lyrics are automatically detected from embedded tags or .lrc files</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
