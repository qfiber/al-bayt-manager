import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { apiKeys } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { AppError } from './error-handler.js';

export async function requireApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.headers['x-api-key'] as string | undefined;
    if (!key) {
      next(new AppError(401, 'API key required'));
      return;
    }

    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const [found] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!found) {
      next(new AppError(401, 'Invalid API key'));
      return;
    }

    // Update last used (throttle to once per 5 minutes to avoid write-on-every-read)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!found.lastUsedAt || found.lastUsedAt < fiveMinutesAgo) {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, found.id));
    }

    next();
  } catch (err) {
    next(err);
  }
}
