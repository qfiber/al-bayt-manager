import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { rateLimitEntries } from '../db/schema/index.js';
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { logSecurityEvent } from '../services/security-alert.service.js';

interface DbRateLimitOptions {
  /** Unique prefix for this limiter (e.g. 'auth', 'api', 'v1') */
  prefix: string;
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
  /** Error message */
  message?: string;
}

/**
 * Database-backed rate limiter for distributed deployments.
 * Uses PostgreSQL for state, so it survives restarts and works across instances.
 */
export function dbRateLimit(options: DbRateLimitOptions) {
  const { prefix, windowMs, max, message = 'Too many requests, please try again later' } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${prefix}:${ip}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    try {
      // Count requests in the current window
      const [result] = await db
        .select({ total: sql<number>`COALESCE(SUM(${rateLimitEntries.count}), 0)` })
        .from(rateLimitEntries)
        .where(and(
          eq(rateLimitEntries.key, key),
          gte(rateLimitEntries.windowStart, windowStart),
        ));

      const currentCount = Number(result?.total ?? 0);

      if (currentCount >= max) {
        // Log rate limit violation
        logSecurityEvent({
          eventType: 'rate_limited',
          ipAddress: ip,
          details: { prefix, currentCount, max, windowMs },
        });

        res.status(429).json({ error: message });
        return;
      }

      // Upsert: try to increment existing entry for this minute, or create new
      const minuteStart = new Date(Math.floor(now.getTime() / 60000) * 60000);

      const [existing] = await db
        .select({ id: rateLimitEntries.id })
        .from(rateLimitEntries)
        .where(and(
          eq(rateLimitEntries.key, key),
          eq(rateLimitEntries.windowStart, minuteStart),
        ))
        .limit(1);

      if (existing) {
        await db
          .update(rateLimitEntries)
          .set({ count: sql`${rateLimitEntries.count} + 1` })
          .where(eq(rateLimitEntries.id, existing.id));
      } else {
        await db.insert(rateLimitEntries).values({
          key,
          windowStart: minuteStart,
          count: 1,
        });
      }

      // Set standard rate limit headers
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', Math.max(0, max - currentCount - 1));

      next();
    } catch (err) {
      // On DB failure, allow the request through (fail-open) but log
      const { logger } = await import('../config/logger.js');
      logger.error(err, 'DB rate limiter error — allowing request');
      next();
    }
  };
}

/**
 * Cleanup old rate limit entries. Call periodically (e.g. every hour).
 */
export async function cleanupRateLimitEntries(maxAgeMs = 3600000): Promise<void> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  await db.delete(rateLimitEntries).where(lt(rateLimitEntries.createdAt, cutoff));
}
