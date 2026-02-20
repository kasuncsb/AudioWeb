'use client';

import { useState, useEffect } from 'react';

export default function DomainMigrationBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if we're on the old Vercel domain
    const isOldDomain = window.location.hostname === 'audioweb.vercel.app' || 
                        window.location.hostname.includes('vercel.app');
    
    if (isOldDomain) {
      setShowBanner(true);
      // Trigger animation after mount
      setTimeout(() => setIsVisible(true), 100);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => setShowBanner(false), 300);
  };

  if (!showBanner) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all duration-300 ease-out ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex items-center flex-1 min-w-0">
            <span className="flex p-2 rounded-lg bg-blue-700">
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <p className="ml-3 font-medium text-sm sm:text-base">
              <span className="inline">
                <strong>We&apos;ve moved!</strong> This domain is no longer maintained. Please visit our new domain: 
              </span>
              <a 
                href="https://aw.kasunc.uk" 
                className="ml-2 underline font-bold hover:text-blue-100 transition-colors cursor-pointer"
                target="_self"
              >
                aw.kasunc.uk
              </a>
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-3">
            <button
              onClick={handleDismiss}
              className="flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-white border border-white/30 hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              Dismiss
            </button>
            <a
              href="https://aw.kasunc.uk"
              className="flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
            >
              Go to New Site
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
