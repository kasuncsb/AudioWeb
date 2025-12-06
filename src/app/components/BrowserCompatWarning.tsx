'use client';

import React, { useEffect, useState } from 'react';
import { checkBrowserCompatibility, getBrowserInfo, type BrowserCompatibilityResult } from '@/utils/browserCompat';

/**
 * Browser Compatibility Warning Component
 * Displays warnings/errors when browser doesn't support required features
 */
export default function BrowserCompatWarning() {
  const [compatResult, setCompatResult] = useState<BrowserCompatibilityResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const result = checkBrowserCompatibility();
      setCompatResult(result);
      
      // Check if user previously dismissed warnings (for this session)
      try {
        const sessionDismissed = sessionStorage.getItem('compat-warning-dismissed');
        if (sessionDismissed === 'true') {
          setDismissed(true);
        }
      } catch (error) {
        // SessionStorage may not be available in private/incognito mode or when
        // storage is disabled. This is expected behavior, so we continue without
        // persistence and show the warning.
        if (error instanceof DOMException) {
          // Expected errors: SecurityError, QuotaExceededError
          console.debug('SessionStorage unavailable:', error.name);
        }
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('compat-warning-dismissed', 'true');
    } catch (error) {
      // SessionStorage may not be available - warning will reappear on refresh
      // in private mode, but that's acceptable behavior
      if (error instanceof DOMException) {
        console.debug('Cannot persist dismissal:', error.name);
      }
    }
  };

  // Don't show anything if compatible or dismissed
  if (!compatResult || (compatResult.compatible && compatResult.warnings.length === 0) || dismissed) {
    return null;
  }

  const browserInfo = getBrowserInfo();
  const hasErrors = compatResult.errors.length > 0;
  const hasWarnings = compatResult.warnings.length > 0;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full mx-4">
      <div 
        className={`rounded-xl p-4 shadow-2xl border ${
          hasErrors 
            ? 'bg-red-900/90 border-red-500/50' 
            : 'bg-yellow-900/90 border-yellow-500/50'
        }`}
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {hasErrors ? (
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-2">
              {hasErrors ? 'Compatibility Issues Detected' : 'Browser Limitations'}
            </h3>
            
            <div className="text-sm text-white/90 space-y-1 mb-3">
              <p className="mb-2">
                {browserInfo.name} {browserInfo.version} {browserInfo.mobile ? '(Mobile)' : '(Desktop)'}
              </p>
              
              {hasErrors && (
                <div className="space-y-1">
                  <p className="font-medium text-red-200">Critical Issues:</p>
                  <ul className="list-disc list-inside space-y-1 text-red-100">
                    {compatResult.errors.map((error, index) => (
                      <li key={index} className="text-xs">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {hasWarnings && (
                <div className="space-y-1 mt-2">
                  <p className="font-medium text-yellow-200">Warnings:</p>
                  <ul className="list-disc list-inside space-y-1 text-yellow-100">
                    {compatResult.warnings.map((warning, index) => (
                      <li key={index} className="text-xs">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {hasErrors ? (
              <div className="space-y-2">
                <p className="text-xs text-red-200">
                  Please use a modern browser like Chrome, Firefox, Safari, or Edge for the best experience.
                </p>
                <button
                  onClick={handleDismiss}
                  className="text-xs text-red-300 hover:text-red-100 underline"
                >
                  Dismiss and continue anyway
                </button>
              </div>
            ) : (
              <button
                onClick={handleDismiss}
                className="text-xs text-yellow-300 hover:text-yellow-100 underline"
              >
                Dismiss
              </button>
            )}
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
