'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

// App states
type AppState = 'landing' | 'authenticating' | 'verifying' | 'verified' | 'queuing' | 'matching' | 'matched' | 'error';

// User data interface
interface UserData {
  walletAddress: string;
  username: string;
  isVerified: boolean;
}

// Match data interface
interface MatchData {
  matchedUsername: string;
  matchedAt: number;
}

// WebSocket message types
interface WSMessage {
  type: 'join_queue' | 'leave_queue' | 'matched' | 'error' | 'queue_status' | 'heartbeat';
  payload?: unknown;
}

export default function MindalikeApp() {
  // State management
  const [appState, setAppState] = useState<AppState>('landing');
  const [user, setUser] = useState<UserData | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [isWorldApp, setIsWorldApp] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if running in World App
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const installed = MiniKit.isInstalled();
      setIsWorldApp(installed);
      
      if (!installed) {
        console.warn('MiniKit not installed - running in development mode');
      }
    }
  }, []);

  // WebSocket connection handler
  const connectWebSocket = useCallback((username: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8787';
    const wsUrl = `${protocol}//${host}`;
    
    try {
      const ws = new WebSocket(`${wsUrl}/ws?username=${encodeURIComponent(username)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'join_queue', payload: { username } }));
        setAppState('matching');
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handleWSMessage(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        setError('Connection error. Please try again.');
        setAppState('error');
      };

      ws.onclose = () => {
        if (appState === 'matching') {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (user?.username) {
              connectWebSocket(user.username);
            }
          }, 3000);
        }
      };
    } catch (e) {
      console.error('Failed to connect WebSocket:', e);
      setError('Failed to connect to matching service.');
      setAppState('error');
    }
  }, [appState, user?.username]);

  // Handle WebSocket messages
  const handleWSMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'queue_status':
        const statusPayload = message.payload as { position: number; total: number };
        setQueuePosition(statusPayload.position);
        break;

      case 'matched':
        const matchPayload = message.payload as { matchedUsername: string };
        setMatch({
          matchedUsername: matchPayload.matchedUsername,
          matchedAt: Date.now(),
        });
        setAppState('matched');
        startRedirectCountdown(matchPayload.matchedUsername);
        break;

      case 'error':
        const errorPayload = message.payload as { message: string };
        setError(errorPayload.message);
        setAppState('error');
        break;

      case 'heartbeat':
        wsRef.current?.send(JSON.stringify({ type: 'heartbeat' }));
        break;
    }
  }, []);

  // Countdown and redirect to World Chat
  const startRedirectCountdown = (matchedUsername: string) => {
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          redirectToChat(matchedUsername);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Redirect to World Chat
  const redirectToChat = async (matchedUsername: string) => {
    try {
      if (MiniKit.isInstalled()) {
        await MiniKit.commandsAsync.chat({
          to: [matchedUsername],
          message: `Hey! We matched on Mindalike 👋`,
        });
      } else {
        console.log('Would redirect to chat with:', matchedUsername);
        alert(`Development mode: Would open chat with ${matchedUsername}`);
      }
    } catch (e) {
      console.error('Failed to open chat:', e);
      setError('Failed to open chat. Please try again.');
    }
  };

  // Wallet Authentication
  const handleWalletAuth = async () => {
    setAppState('authenticating');
    setError(null);

    try {
      if (!MiniKit.isInstalled()) {
        setUser({
          walletAddress: '0x' + Math.random().toString(16).slice(2, 42),
          username: 'dev_user_' + Math.random().toString(36).slice(2, 8),
          isVerified: false,
        });
        setAppState('verifying');
        return;
      }

      const nonceRes = await fetch('/api/nonce');
      if (!nonceRes.ok) {
        throw new Error('Failed to get nonce');
      }
      const nonceData = await nonceRes.json() as { nonce: string };
      const nonce = nonceData.nonce;

      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
        nonce,
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
        statement: 'Sign in to Mindalike to meet verified humans!',
      });

      if (finalPayload.status === 'error') {
        throw new Error('Wallet authentication failed');
      }

      const verifyRes = await fetch('/api/verify-siwe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: finalPayload, nonce }),
      });

      if (!verifyRes.ok) {
        throw new Error('Failed to verify signature');
      }

      const verifyData = await verifyRes.json() as { isValid: boolean; address: string; username: string };
      const { isValid, address, username } = verifyData;

      if (!isValid) {
        throw new Error('Invalid signature');
      }

      setUser({
        walletAddress: address,
        username: username || MiniKit.user?.username || 'unknown',
        isVerified: false,
      });

      setAppState('verifying');
    } catch (e) {
      console.error('Wallet auth error:', e);
      setError(e instanceof Error ? e.message : 'Authentication failed');
      setAppState('error');
    }
  };

  // World ID Verification
  const handleWorldIdVerify = async () => {
    setError(null);

    try {
      if (!MiniKit.isInstalled()) {
        if (user) {
          setUser({ ...user, isVerified: true });
        }
        setAppState('verified');
        return;
      }

      const appId = process.env.NEXT_PUBLIC_APP_ID;
      const actionId = process.env.NEXT_PUBLIC_ACTION_ID || 'verifyuser';

      if (!appId) {
        throw new Error('App ID not configured');
      }

      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: actionId,
        signal: user?.walletAddress || '',
        verification_level: VerificationLevel.Orb,
      });

      if (finalPayload.status === 'error') {
        const errorPayload = finalPayload as { code?: string; message?: string };
        switch (errorPayload.code) {
          case 'verification_rejected':
            throw new Error('Verification was rejected. Please try again.');
          case 'credential_unavailable':
            throw new Error('You need to verify at an Orb first.');
          case 'max_verifications_reached':
            throw new Error('Maximum verifications reached for this action.');
          default:
            throw new Error(errorPayload.message || 'Verification failed');
        }
      }

      const verifyRes = await fetch('/api/verify-worldid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: finalPayload,
          action: actionId,
          signal: user?.walletAddress,
        }),
      });

      if (!verifyRes.ok) {
        throw new Error('Failed to verify proof');
      }

      const verifyWorldIdData = await verifyRes.json() as { verified: boolean };
      
      if (!verifyWorldIdData.verified) {
        throw new Error('Verification failed');
      }

      if (user) {
        setUser({ ...user, isVerified: true });
      }

      setAppState('verified');
    } catch (e) {
      console.error('World ID verification error:', e);
      setError(e instanceof Error ? e.message : 'Verification failed');
    }
  };

  // Start matching
  const handleFindMatch = () => {
    if (!user?.username) {
      setError('Please authenticate first');
      return;
    }

    setAppState('queuing');
    setError(null);
    connectWebSocket(user.username);
  };

  // Cancel matching
  const handleCancelMatch = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'leave_queue' }));
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setAppState('verified');
    setQueuePosition(0);
  };

  // Find another match
  const handleFindAnother = () => {
    setMatch(null);
    setCountdown(5);
    handleFindMatch();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Render based on app state
  return (
    <div className="min-h-screen bg-bg-1 flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-border-primary bg-bg-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center shadow-brand-primary">
            <svg className="w-6 h-6 text-text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
          </div>
          <span className="text-xl font-display font-bold gradient-text">Mindalike</span>
        </div>
        {user && (
          <div className="flex items-center gap-2 text-body-sm text-text-secondary">
            <div className={`w-2 h-2 rounded-full ${user.isVerified ? 'bg-success' : 'bg-yellow-500'}`} />
            <span className="truncate max-w-[100px] font-medium">{user.username}</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-8 pt-8 space-y-6 md:space-y-8">
        {appState === 'landing' && (
          <LandingView
            isWorldApp={isWorldApp}
            onStart={handleWalletAuth}
          />
        )}

        {appState === 'authenticating' && <LoadingView message="Authenticating..." />}

        {appState === 'verifying' && (
          <VerifyView
            onVerify={handleWorldIdVerify}
            error={error}
          />
        )}

        {appState === 'verified' && (
          <VerifiedView
            username={user?.username || ''}
            onFindMatch={handleFindMatch}
          />
        )}

        {(appState === 'queuing' || appState === 'matching') && (
          <MatchingView
            position={queuePosition}
            onCancel={handleCancelMatch}
          />
        )}

        {appState === 'matched' && match && (
          <MatchedView
            matchedUsername={match.matchedUsername}
            countdown={countdown}
            onChatNow={() => redirectToChat(match.matchedUsername)}
            onFindAnother={handleFindAnother}
          />
        )}

        {appState === 'error' && (
          <ErrorView
            message={error || 'An error occurred'}
            onRetry={() => {
              setError(null);
              setAppState(user?.isVerified ? 'verified' : user ? 'verifying' : 'landing');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-4 text-center text-body-sm text-text-tertiary border-t border-border-primary bg-bg-2">
        <p>Powered by World ID • Only verified humans</p>
      </footer>
    </div>
  );
}

// Landing View Component
function LandingView({ isWorldApp, onStart }: { isWorldApp: boolean; onStart: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto w-full space-y-6 md:space-y-8">
      {/* Hero Icon with Glow */}
      <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto">
        <div className="absolute inset-0 bg-brand-primary rounded-full opacity-20 animate-ping" />
        <div className="absolute inset-2 bg-brand-primary rounded-full opacity-30 animate-pulse" />
        <div className="relative w-full h-full bg-gradient-to-br from-brand-primary to-brand-heavy rounded-full flex items-center justify-center glow-hero animate-float">
          <svg className="w-16 h-16 md:w-20 md:h-20 text-text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      <div className="space-y-3 md:space-y-4">
        <h1 className="text-display-xl font-display font-bold text-text-primary">
          Meet <span className="gradient-text">Verified</span> Humans
        </h1>
        
        <p className="text-body-lg text-text-secondary leading-relaxed max-w-sm mx-auto">
          Connect with real people, verified by World ID. 
          No bots, no fakes — just genuine human connections.
        </p>
      </div>

      <div className="space-y-4">
        <Button
          onClick={onStart}
          variant="primary"
          size="lg"
          className="w-full"
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
          Get Started
        </Button>

        {!isWorldApp && (
          <Card variant="bordered" padding="sm" className="bg-amber-50 border-amber-200">
            <p className="text-body-sm text-amber-800">
              ⚠️ For the best experience, open this app in World App
            </p>
          </Card>
        )}
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-4 text-center pt-6 md:pt-8">
        <Card variant="bordered" padding="sm" className="bg-bg-3">
          <div className="w-10 h-10 bg-brand-subtle/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-body-sm text-text-secondary font-medium">Verified</span>
        </Card>
        <Card variant="bordered" padding="sm" className="bg-bg-3">
          <div className="w-10 h-10 bg-brand-subtle/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="text-body-sm text-text-secondary font-medium">Private</span>
        </Card>
        <Card variant="bordered" padding="sm" className="bg-bg-3">
          <div className="w-10 h-10 bg-brand-subtle/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-body-sm text-text-secondary font-medium">Instant</span>
        </Card>
      </div>
    </div>
  );
}

// Loading View Component
function LoadingView({ message }: { message: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="spinner mx-auto" />
      <p className="text-body-md text-text-secondary">{message}</p>
    </div>
  );
}

// Verify View Component
function VerifyView({ onVerify, error }: { onVerify: () => void; error: string | null }) {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto w-full text-center space-y-6">
      <div className="w-24 h-24 bg-gradient-to-br from-brand-primary to-brand-heavy rounded-full flex items-center justify-center mx-auto shadow-brand-primary">
        <svg className="w-12 h-12 text-text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>

      <div className="space-y-3">
        <h2 className="text-heading-lg font-display font-bold text-text-primary">Verify You&apos;re Human</h2>
        
        <p className="text-body-md text-text-secondary">
          To ensure everyone on Mindalike is a real person, 
          please verify with your World ID.
        </p>
      </div>

      {error && (
        <Card variant="bordered" padding="sm" className="bg-red-50 border-red-200">
          <p className="text-body-sm text-destructive">{error}</p>
        </Card>
      )}

      <div className="space-y-3">
        <Button
          onClick={onVerify}
          variant="primary"
          size="lg"
          className="w-full"
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          Verify with World ID
        </Button>

        <p className="text-body-sm text-text-tertiary">
          Requires Orb verification for human uniqueness
        </p>
      </div>
    </Card>
  );
}

// Verified View Component
function VerifiedView({ username, onFindMatch }: { username: string; onFindMatch: () => void }) {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto w-full text-center space-y-6">
      <div className="w-24 h-24 bg-gradient-to-br from-success to-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg animate-float">
        <svg className="w-12 h-12 text-text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-heading-lg font-display font-bold text-text-primary">You&apos;re Verified! ✨</h2>
        
        <p className="text-body-md text-text-secondary">
          Welcome, <span className="font-semibold text-brand-primary">{username}</span>
        </p>
        
        <p className="text-body-sm text-text-tertiary">
          You can now connect with other verified humans around the world.
        </p>
      </div>

      <Button
        onClick={onFindMatch}
        variant="primary"
        size="lg"
        className="w-full animate-glow"
        leftIcon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      >
        Find a Match
      </Button>
    </Card>
  );
}

// Matching View Component
function MatchingView({ position, onCancel }: { position: number; onCancel: () => void }) {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto w-full text-center space-y-6">
      {/* Animated searching indicator */}
      <div className="relative w-32 h-32 mx-auto">
        <div className="pulse-ring" style={{ width: '100%', height: '100%' }} />
        <div className="pulse-ring" style={{ width: '100%', height: '100%', animationDelay: '0.5s' }} />
        <div className="pulse-ring" style={{ width: '100%', height: '100%', animationDelay: '1s' }} />
        <div className="relative w-full h-full bg-gradient-to-br from-brand-primary to-brand-heavy rounded-full flex items-center justify-center shadow-brand-primary">
          <svg className="w-12 h-12 text-text-inverted animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-heading-lg font-display font-bold text-text-primary">Finding Your Match...</h2>
        
        <p className="text-body-md text-text-secondary">
          Looking for another verified human
        </p>

        {position > 0 && (
          <p className="text-body-sm text-brand-primary font-medium">
            Queue position: {position}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-text-tertiary">
        <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      <Button
        onClick={onCancel}
        variant="secondary"
        size="md"
        className="w-full"
      >
        Cancel
      </Button>
    </Card>
  );
}

// Matched View Component
function MatchedView({ 
  matchedUsername, 
  countdown, 
  onChatNow, 
  onFindAnother 
}: { 
  matchedUsername: string; 
  countdown: number; 
  onChatNow: () => void; 
  onFindAnother: () => void;
}) {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto w-full text-center space-y-6">
      {/* Celebration animation */}
      <div className="relative w-32 h-32 mx-auto">
        <div className="absolute inset-0 bg-success rounded-full opacity-20 animate-ping" />
        <div className="relative w-full h-full bg-gradient-to-br from-success to-green-600 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-16 h-16 text-text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-heading-lg font-display font-bold text-text-primary">Match Found! 🎉</h2>
        
        <p className="text-body-md text-text-secondary">You&apos;ve been matched with</p>
        <p className="text-heading-lg font-display font-bold text-brand-primary">{matchedUsername}</p>

        <p className="text-body-sm text-text-tertiary">
          Redirecting to World Chat in {countdown}s...
        </p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={onChatNow}
          variant="primary"
          size="lg"
          className="w-full"
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
        >
          Chat Now
        </Button>
        
        <Button
          onClick={onFindAnother}
          variant="secondary"
          size="md"
          className="w-full"
        >
          Find Another Match
        </Button>
      </div>
    </Card>
  );
}

// Error View Component
function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card variant="elevated" className="max-w-sm mx-auto w-full text-center space-y-6">
      <div className="w-24 h-24 bg-gradient-to-br from-destructive to-red-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
        <svg className="w-12 h-12 text-text-inverted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <div className="space-y-3">
        <h2 className="text-heading-lg font-display font-bold text-text-primary">Oops!</h2>
        
        <p className="text-body-md text-text-secondary">{message}</p>
      </div>

      <Button
        onClick={onRetry}
        variant="primary"
        size="lg"
        className="w-full"
        leftIcon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        }
      >
        Try Again
      </Button>
    </Card>
  );
}
