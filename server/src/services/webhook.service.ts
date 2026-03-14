import crypto from 'crypto';
import { db } from '../config/database.js';
import { webhookEndpoints } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../config/logger.js';
import { AppError } from '../middleware/error-handler.js';

function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname;
    // Block private IPs, localhost, metadata endpoints
    const blocked = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^0\./,
      /^::1$/,
      /^fc00:/i,
      /^fd00:/i,
      /^fe80:/i,
    ];
    return blocked.some(re => re.test(hostname));
  } catch {
    return true; // Invalid URL = block
  }
}

export async function listWebhooks(organizationId: string) {
  const webhooks = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.organizationId, organizationId));
  // Mask secrets in list responses
  return webhooks.map(({ secret: _secret, ...rest }) => ({ ...rest, secret: '••••••••' }));
}

export async function createWebhook(data: { organizationId: string; url: string; events: string[]; secret?: string }) {
  if (isPrivateUrl(data.url)) throw new AppError(400, 'Webhook URL cannot point to private/internal addresses');
  const secret = data.secret || crypto.randomBytes(32).toString('hex');
  const [webhook] = await db.insert(webhookEndpoints).values({
    organizationId: data.organizationId,
    url: data.url,
    events: JSON.stringify(data.events),
    secret,
  }).returning();
  return webhook;
}

export async function deleteWebhook(id: string, organizationId: string) {
  const [webhook] = await db.delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.organizationId, organizationId)))
    .returning();
  return webhook;
}

export async function fireWebhook(organizationId: string, event: string, payload: any) {
  const webhooks = await db.select().from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.organizationId, organizationId), eq(webhookEndpoints.isActive, true)));

  for (const webhook of webhooks) {
    const events = JSON.parse(webhook.events || '[]');
    if (!events.includes(event) && !events.includes('*')) continue;
    if (isPrivateUrl(webhook.url)) continue;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', webhook.secret || '').update(body).digest('hex');

    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body,
      });
    } catch (err) {
      logger.error({ err, webhookId: webhook.id, event }, 'Webhook delivery failed');
    }
  }
}
