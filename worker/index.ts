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
 * - /api/queue-status → Queue statistics
 * - /health → Health check
 * - /* → Static assets (Next.js)
 */

export interface Env {
  MATCHING_QUEUE: DurableObjectNamespace;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
};

// Simple in-memory nonce store (in production, use KV or D1)
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
          signal?: string 
        };

        // In production, verify with World ID cloud API
        // https://developer.worldcoin.org/api/v1/verify/app_{app_id}
        
        // For development, we'll accept the verification
        // The actual verification happens client-side in MiniKit
        
        return new Response(JSON.stringify({
          verified: true,
          nullifier_hash: payload.nullifier_hash || 'dev_nullifier',
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
    // WebSocket Endpoint
    // ==========================================
    
    if (url.pathname === '/ws') {
      const username = url.searchParams.get('username');
      
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
