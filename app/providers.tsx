'use client';

import { ReactNode, useEffect, useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isWorldApp, setIsWorldApp] = useState<boolean | null>(null);

  useEffect(() => {
    // Initialize MiniKit on client side only
    const initMiniKit = async () => {
      try {
        // Check if we're in the World App environment
        if (typeof window !== 'undefined') {
          // MiniKit auto-installs when imported, but we can check if it's ready
          const appId = process.env.NEXT_PUBLIC_APP_ID;
          if (appId) {
            MiniKit.install(appId);
          }
          
          // Gate: Check if MiniKit is installed (only true inside World App)
          const installed = MiniKit.isInstalled();
          setIsWorldApp(installed);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize MiniKit:', error);
        setIsWorldApp(false);
        setIsInitialized(true);
      }
    };

    initMiniKit();
  }, []);

  // Show loading while initializing
  if (!isInitialized || isWorldApp === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-1">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" />
          <p className="text-text-secondary text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  // Gate: Show full-screen message if not in World App
  if (!isWorldApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-1 px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 bg-gradient-to-br from-brand-primary to-brand-heavy rounded-full flex items-center justify-center mx-auto shadow-brand-primary">
            <svg className="w-12 h-12 text-text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-heading-xl font-display font-bold text-text-primary">
              Please open Mindalike inside World App
            </h1>
            
            <p className="text-body-lg text-text-secondary">
              Mindalike is designed to work exclusively within World App. 
              Please download World App and open this link from there.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <a
              href="https://worldcoin.org/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-text-inverted font-semibold rounded-lg hover:bg-brand-heavy transition-colors shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download World App
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
