import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

export const sseRoutes = Router();

// Store active connections per user
const connections = new Map<string, Set<Response>>();

export function sendSSEEvent(userId: string, event: string, data: any) {
  const userConnections = connections.get(userId);
  if (!userConnections) return;

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of userConnections) {
    try {
      res.write(message);
    } catch {
      userConnections.delete(res);
    }
  }
}

export function broadcastToOrg(organizationId: string, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [_userId, userConnections] of connections) {
    for (const res of userConnections) {
      try {
        // Check if this connection belongs to the org
        if ((res as any).__orgId === organizationId) {
          res.write(message);
        }
      } catch {
        userConnections.delete(res);
      }
    }
  }
}

// SSE connection endpoint
sseRoutes.get('/stream', requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const orgId = req.user!.organizationId;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Store org ID on response for broadcasting
  (res as any).__orgId = orgId;

  // Add to connections
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(res);

  // Enforce per-user connection limit
  const MAX_CONNECTIONS_PER_USER = 5;
  const userConns = connections.get(userId)!;
  if (userConns.size > MAX_CONNECTIONS_PER_USER) {
    const iter = userConns.values();
    while (userConns.size > MAX_CONNECTIONS_PER_USER) {
      const oldest = iter.next().value;
      if (oldest && oldest !== res) {
        try { oldest.end(); } catch {}
        userConns.delete(oldest);
      }
    }
  }

  // Send initial heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  // Heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    connections.get(userId)?.delete(res);
    if (connections.get(userId)?.size === 0) {
      connections.delete(userId);
    }
  });
});
