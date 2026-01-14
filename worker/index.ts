/**
 * Mindalike Unified Worker
 * Handles WebSocket matching + API routes + serves static assets
 *
 * Domain: world.mind-alike.com
 *
 * Routes:
 * - /ws?username=xxx → WebSocket for matching queue
 * - /api/nonce → Generate SIWE nonce
 * - /api/verify-siwe → Verify SIWE signature
 * - /api/verify-worldid → Verify World ID proof
 * - /api/matches/today → Get today's match count
 * - /api/matches/increment → Increment today's match count
 * - /api/payments/create → Record pending payment reference
 * - /api/payments/verify → Verify payment with World Developer Portal API
 * - /api/queue-status → Queue statistics
 * - /health → Health check
 * - /* → Static assets (Next.js)
 */

export interface Env {
  MATCHING_QUEUE: DurableObjectNamespace;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  // D1 database for Mindalike World mini app
  DB: D1Database;
  // KV cache for daily match counts
  DAILY_MATCHES_CACHE: KVNamespace;
  // Secrets for payment verification
  WORLD_APP_ID: string;
  WORLD_API_KEY: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
};

// Simple in-memory nonce store (per-instance)
const nonceStore = new Map<string, { nonce: string; expires: number }>();

// Generate random nonce
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Clean expired nonces
function cleanExpiredNonces() {
  const now = Date.now();
  for (const [key, value] of nonceStore.entries()) {
    if (value.expires < now) {
      nonceStore.delete(key);
    }
  }
}

// --- Helper functions for daily matches & payments -------------------------

function getTodayKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getDailyMatchCount(env: Env, wallet: string): Promise<number> {
  const today = getTodayKey();
  const cacheKey = `daily_matches:${wallet}:${today}`;

  const cached = await env.DAILY_MATCHES_CACHE.get(cacheKey, 'json') as { count?: number } | null;
  if (cached && typeof cached.count === 'number') {
    return cached.count;
  }

  const { results } = await env.DB.prepare(
    'SELECT match_count FROM daily_matches WHERE wallet_address = ? AND date = ?'
  ).bind(wallet, today).all<{ match_count: number }>();

  const count = results?.[0]?.match_count ?? 0;
  await env.DAILY_MATCHES_CACHE.put(cacheKey, JSON.stringify({ count }), { expirationTtl: 3600 });
  return count;
}

async function incrementDailyMatchCount(env: Env, wallet: string): Promise<number> {
  const today = getTodayKey();

  await env.DB.prepare(
    `INSERT INTO daily_matches (wallet_address, date, match_count)
     VALUES (?, ?, 1)
     ON CONFLICT(wallet_address, date) DO UPDATE SET match_count = match_count + 1`
  ).bind(wallet, today).run();

  const { results } = await env.DB.prepare(
    'SELECT match_count FROM daily_matches WHERE wallet_address = ? AND date = ?'
  ).bind(wallet, today).all<{ match_count: number }>();

  const count = results?.[0]?.match_count ?? 0;
  const cacheKey = `daily_matches:${wallet}:${today}`;
  await env.DAILY_MATCHES_CACHE.put(cacheKey, JSON.stringify({ count }), { expirationTtl: 3600 });
  return count;
}

async function createPaymentReference(env: Env, reference: string, wallet: string) {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO payments (reference_id, wallet_address, status) VALUES (?, ?, ?)'
  ).bind(reference, wallet, 'pending').run();
}

async function markPaymentStatus(env: Env, reference: string, status: string) {
  await env.DB.prepare(
    'UPDATE payments SET status = ? WHERE reference_id = ?'
  ).bind(status, reference).run();
}

// Main worker handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ==========================================
    // API Routes
    // ==========================================

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: Date.now(),
        service: 'mindalike'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate SIWE nonce
    if (url.pathname === '/api/nonce' && request.method === 'GET') {
      cleanExpiredNonces();
      const nonce = generateNonce();
      const clientId = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // Store nonce with 5 minute expiry
      nonceStore.set(clientId, { 
        nonce, 
        expires: Date.now() + 5 * 60 * 1000 
      });

      return new Response(JSON.stringify({ nonce }), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Set-Cookie': `siwe_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300`
        },
      });
    }

    // Verify SIWE signature
    if (url.pathname === '/api/verify-siwe' && request.method === 'POST') {
      try {
        const { payload, nonce } = await request.json() as { payload: any; nonce: string };
        const clientId = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        // Verify nonce
        const stored = nonceStore.get(clientId);
        if (!stored || stored.nonce !== nonce || stored.expires < Date.now()) {
          return new Response(JSON.stringify({ 
            status: 'error', 
            isValid: false, 
            message: 'Invalid or expired nonce' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Clear used nonce
        nonceStore.delete(clientId);

        // In production, verify the SIWE message signature properly
        // For now, we trust the payload from MiniKit
        const address = payload.address || '';
        const username = payload.username || '';

        return new Response(JSON.stringify({
          status: 'success',
          isValid: true,
          address,
          username,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ 
          status: 'error', 
          isValid: false, 
          message: 'Verification failed' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Verify World ID proof
    if (url.pathname === '/api/verify-worldid' && request.method === 'POST') {
      try {
        const { payload, action, signal } = await request.json() as { 
          payload: any; 
          action: string; 
          signal?: string;
          wallet_address?: string;
        };

        // In production, verify with World ID cloud API
        // https://developer.worldcoin.org/api/v1/verify/app_{app_id}
        
        // For development, we'll accept the verification
        // The actual verification happens client-side in MiniKit
        
        const nullifierHash = payload.nullifier_hash || null;
        
        if (!nullifierHash) {
          return new Response(JSON.stringify({ 
            verified: false, 
            error: 'Missing nullifier_hash' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Store nullifier_hash in database to track unique humans
        if (signal) {
          try {
            // Check if nullifier_hash already exists (prevent duplicate verifications)
            const existing = await env.DB.prepare(
              'SELECT wallet_address FROM users WHERE nullifier_hash = ?'
            ).bind(nullifierHash).first<{ wallet_address?: string }>();

            if (existing) {
              // Update existing user's verification status
              await env.DB.prepare(
                'UPDATE users SET world_id_verified = 1, wallet_address = ? WHERE nullifier_hash = ?'
              ).bind(signal.toLowerCase(), nullifierHash).run();
            } else {
              // Insert or update user with nullifier_hash
              await env.DB.prepare(
                `INSERT INTO users (wallet_address, world_id_verified, nullifier_hash)
                 VALUES (?, 1, ?)
                 ON CONFLICT(wallet_address) DO UPDATE SET 
                   world_id_verified = 1,
                   nullifier_hash = ?`
              ).bind(signal.toLowerCase(), nullifierHash, nullifierHash).run();
            }
          } catch (dbError) {
            console.error('Database error storing nullifier_hash:', dbError);
            // Continue even if DB update fails (non-critical)
          }
        }
        
        return new Response(JSON.stringify({
          verified: true,
          nullifier_hash: nullifierHash,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ 
          verified: false, 
          error: 'Verification failed' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Queue status
    if (url.pathname === '/api/queue-status') {
      const id = env.MATCHING_QUEUE.idFromName('global-queue');
      const queue = env.MATCHING_QUEUE.get(id);
      
      const statusRequest = new Request(new URL('/status', request.url), {
        method: 'GET',
      });
      
      return queue.fetch(statusRequest);
    }

    // ==========================================
    // Freemium API: daily matches
    // ==========================================

    if (url.pathname === '/api/matches/today' && request.method === 'GET') {
      const wallet = url.searchParams.get('wallet');
      if (!wallet) {
        return new Response(JSON.stringify({ error: 'wallet required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const count = await getDailyMatchCount(env, wallet.toLowerCase());
      const freeLimit = 5;

      return new Response(JSON.stringify({ count, free_limit: freeLimit }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/matches/increment' && request.method === 'POST') {
      try {
        const { wallet_address } = await request.json() as { wallet_address?: string };
        if (!wallet_address) {
          return new Response(JSON.stringify({ error: 'wallet_address required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const count = await incrementDailyMatchCount(env, wallet_address.toLowerCase());
        return new Response(JSON.stringify({ count }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to increment match count' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ==========================================
    // Freemium API: payments
    // ==========================================

    if (url.pathname === '/api/payments/create' && request.method === 'POST') {
      try {
        const { reference_id, wallet_address } = await request.json() as { reference_id?: string; wallet_address?: string };
        if (!reference_id || !wallet_address) {
          return new Response(JSON.stringify({ error: 'reference_id and wallet_address required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await createPaymentReference(env, reference_id, wallet_address.toLowerCase());
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to create payment reference' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/payments/verify' && request.method === 'POST') {
      try {
        const { reference_id, transaction_id, wallet_address } = await request.json() as {
          reference_id?: string;
          transaction_id?: string;
          wallet_address?: string;
        };

        if (!reference_id || !transaction_id || !wallet_address) {
          return new Response(JSON.stringify({ error: 'reference_id, transaction_id and wallet_address required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!env.WORLD_APP_ID || !env.WORLD_API_KEY) {
          return new Response(JSON.stringify({ error: 'Server not configured for payment verification' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const urlVerify = `https://developer.worldcoin.org/api/v2/minikit/transaction/${transaction_id}?app_id=${env.WORLD_APP_ID}&type=payment`;
        const res = await fetch(urlVerify, {
          method: 'GET',
          headers: { Authorization: `Bearer ${env.WORLD_API_KEY}` },
        });

        if (!res.ok) {
          await markPaymentStatus(env, reference_id, 'failed');
          return new Response(JSON.stringify({ success: false, error: 'Failed to verify transaction' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tx = await res.json() as { reference?: string; transaction_status?: string };

        if (tx.reference !== reference_id || tx.transaction_status === 'failed') {
          await markPaymentStatus(env, reference_id, 'failed');
          return new Response(JSON.stringify({ success: false, error: 'Transaction not valid' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await markPaymentStatus(env, reference_id, 'success');

        // Grant additional matches (+5) by effectively reducing today's count by 5,
        // so the user gets 5 more \"free\" attempts.
        const today = getTodayKey();
        await env.DB.prepare(
          `INSERT INTO daily_matches (wallet_address, date, match_count)
           VALUES (?, ?, 0)
           ON CONFLICT(wallet_address, date) DO UPDATE SET match_count = MAX(match_count - 5, 0)`
        ).bind(wallet_address.toLowerCase(), today).run();

        const newCount = await getDailyMatchCount(env, wallet_address.toLowerCase());

        return new Response(JSON.stringify({ success: true, new_count: newCount, granted: 5 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ success: false, error: 'Payment verification failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ==========================================
    // WebSocket Endpoint
    // ==========================================
    
    if (url.pathname === '/ws') {
      const username = url.searchParams.get('username');
      const wallet = url.searchParams.get('wallet');
      
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only verified users can enter the matching queue
      // Check if user has a verified nullifier_hash
      if (wallet) {
        try {
          const user = await env.DB.prepare(
            'SELECT nullifier_hash, world_id_verified FROM users WHERE wallet_address = ?'
          ).bind(wallet.toLowerCase()).first<{ nullifier_hash?: string | null; world_id_verified?: number }>();

          if (!user || !user.world_id_verified || !user.nullifier_hash) {
            return new Response(JSON.stringify({ 
              error: 'User must be verified with World ID to enter matching queue' 
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (dbError) {
          console.error('Database error checking verification:', dbError);
          return new Response(JSON.stringify({ 
            error: 'Failed to verify user status' 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const id = env.MATCHING_QUEUE.idFromName('global-queue');
      const queue = env.MATCHING_QUEUE.get(id);
      return queue.fetch(request);
    }

    // ==========================================
    // Static Assets (Next.js)
    // ==========================================
    
    try {
      // Try to serve from assets
      const response = await env.ASSETS.fetch(request);
      
      // If it's a 404 and not an API/asset request, serve index.html (SPA fallback)
      if (response.status === 404 && !url.pathname.startsWith('/api') && !url.pathname.includes('.')) {
        const indexRequest = new Request(new URL('/', request.url), request);
        return env.ASSETS.fetch(indexRequest);
      }
      
      return response;
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  },
};

// ============================================
// Matching Queue Durable Object
// ============================================

interface QueuedUser {
  username: string;
  joinedAt: number;
  websocket: WebSocket;
}

interface WSMessage {
  type: 'join_queue' | 'leave_queue' | 'heartbeat';
  payload?: {
    username?: string;
  };
}

export class MatchingQueue implements DurableObject {
  private state: DurableObjectState;
  private queue: Map<string, QueuedUser> = new Map();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.queue = new Map();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        queueSize: this.queue.size,
        timestamp: Date.now(),
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const username = url.searchParams.get('username');
    if (!username) {
      return new Response('Username required', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server, [username]);
    server.serializeAttachment({ username, joinedAt: Date.now() });
    this.startMatchingProcess();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data: WSMessage = JSON.parse(message as string);
      const attachment = ws.deserializeAttachment() as { username: string; joinedAt: number } | null;

      if (!attachment) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Session expired' } }));
        return;
      }

      switch (data.type) {
        case 'join_queue':
          this.addToQueue(attachment.username, ws);
          this.sendQueueStatus(ws);
          this.tryMatch();
          break;
        case 'leave_queue':
          this.removeFromQueue(attachment.username);
          break;
        case 'heartbeat':
          ws.send(JSON.stringify({ type: 'heartbeat' }));
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Unknown message type' } }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as { username: string } | null;
    if (attachment?.username) {
      this.removeFromQueue(attachment.username);
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as { username: string } | null;
    if (attachment?.username) {
      this.removeFromQueue(attachment.username);
    }
  }

  async alarm(): Promise<void> {
    this.tryMatch();
    this.broadcastQueueStatus();
    if (this.queue.size > 0) {
      this.state.storage.setAlarm(Date.now() + 2000);
    }
  }

  private addToQueue(username: string, ws: WebSocket): void {
    this.removeFromQueue(username);
    this.queue.set(username, { username, joinedAt: Date.now(), websocket: ws });
  }

  private removeFromQueue(username: string): void {
    this.queue.delete(username);
  }

  private sendQueueStatus(ws: WebSocket): void {
    const position = Array.from(this.queue.values())
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .findIndex(u => u.websocket === ws) + 1;
    ws.send(JSON.stringify({ type: 'queue_status', payload: { position, total: this.queue.size } }));
  }

  private startMatchingProcess(): void {
    this.state.storage.setAlarm(Date.now() + 1000);
  }

  private tryMatch(): void {
    if (this.queue.size < 2) return;

    const users = Array.from(this.queue.values()).sort((a, b) => a.joinedAt - b.joinedAt);
    const user1 = users[0];
    const user2 = users[1];

    this.removeFromQueue(user1.username);
    this.removeFromQueue(user2.username);

    try {
      user1.websocket.send(JSON.stringify({
        type: 'matched',
        payload: { matchedUsername: user2.username, matchedAt: Date.now() },
      }));
    } catch (e) {}

    try {
      user2.websocket.send(JSON.stringify({
        type: 'matched',
        payload: { matchedUsername: user1.username, matchedAt: Date.now() },
      }));
    } catch (e) {}

    if (this.queue.size >= 2) this.tryMatch();
  }

  private broadcastQueueStatus(): void {
    const users = Array.from(this.queue.values()).sort((a, b) => a.joinedAt - b.joinedAt);
    users.forEach((user, index) => {
      try {
        user.websocket.send(JSON.stringify({
          type: 'queue_status',
          payload: { position: index + 1, total: this.queue.size },
        }));
      } catch (e) {
        this.removeFromQueue(user.username);
      }
    });
  }
}
