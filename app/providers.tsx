'use client';

import { ReactNode, useEffect, useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [isInitialized, setIsInitialized] = useState(false);

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
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize MiniKit:', error);
        setIsInitialized(true); // Still set to true to show the app
      }
    };

    initMiniKit();
  }, []);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pearl-white-50">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" />
          <p className="text-gray-500 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
