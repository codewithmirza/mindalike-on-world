/**
 * Application constants for Mindalike
 */

// App configuration
export const APP_CONFIG = {
  name: 'Mindalike',
  description: 'Meet Verified Humans',
  version: '1.0.0',
} as const;

// Color scheme
export const COLORS = {
  dodgerBlue: '#1e90ff',
  pearlWhite: '#f5f5f5',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
} as const;

// Timing constants
export const TIMING = {
  redirectCountdown: 5, // seconds
  heartbeatInterval: 30000, // 30 seconds
  reconnectDelay: 3000, // 3 seconds
  matchCheckInterval: 2000, // 2 seconds
} as const;

// Error messages
export const ERROR_MESSAGES = {
  WALLET_AUTH_FAILED: 'Wallet authentication failed. Please try again.',
  VERIFICATION_REJECTED: 'Verification was rejected. Please try again.',
  CREDENTIAL_UNAVAILABLE: 'You need to verify at an Orb first to use Mindalike.',
  MAX_VERIFICATIONS: 'Maximum verifications reached for this action.',
  CONNECTION_ERROR: 'Connection error. Please check your internet and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  CHAT_FAILED: 'Failed to open chat. Please try again.',
  GENERIC: 'Something went wrong. Please try again.',
} as const;

// WebSocket message types
export const WS_MESSAGE_TYPES = {
  JOIN_QUEUE: 'join_queue',
  LEAVE_QUEUE: 'leave_queue',
  MATCHED: 'matched',
  ERROR: 'error',
  QUEUE_STATUS: 'queue_status',
  HEARTBEAT: 'heartbeat',
} as const;

// App states
export const APP_STATES = {
  LANDING: 'landing',
  AUTHENTICATING: 'authenticating',
  VERIFYING: 'verifying',
  VERIFIED: 'verified',
  QUEUING: 'queuing',
  MATCHING: 'matching',
  MATCHED: 'matched',
  ERROR: 'error',
} as const;
