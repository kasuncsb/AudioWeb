'use client';

import React from 'react';

interface SupportPopupProps {
  show: boolean;
  onClose: () => void;
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
      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-white font-medium text-sm mb-1">{title}</h3>
        <p className="text-white/70 text-xs leading-relaxed">{description}</p>
      </div>
      <svg className="w-4 h-4 text-white/40 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </Component>
  );
};

export const SupportPopup: React.FC<SupportPopupProps> = ({ show, onClose }) => {
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
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px) saturate(120%)',
        WebkitBackdropFilter: 'blur(20px) saturate(120%)',
      }}
      onClick={handleBackdropClick}
    >
      <div 
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl p-6"
        style={{
          background: 'rgba(20, 20, 28, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
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
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
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

            <SupportOption
              icon={
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 10.956.557-.085-.003-.204-.003-.446v-1.611c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.997.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319-.192.694-.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              }
              title="GitHub Issues"
              description="Report bugs, request features, or contribute to the project on our GitHub repository."
              href="https://github.com/KasunCSB/AudioWeb/issues"
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
