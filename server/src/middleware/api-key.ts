import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../config/database.js';
import { apiKeys, userRoles, moderatorBuildings } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { AppError } from './error-handler.js';
import { logSecurityEvent } from '../services/security-alert.service.js';

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
      logSecurityEvent({
        eventType: 'unauthorized_access',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']?.slice(0, 500),
        details: { reason: 'invalid_api_key', path: req.path },
      });
      next(new AppError(401, 'Invalid API key'));
      return;
    }

    // Attach the API key owner's identity and role for building scoping
    const [role] = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, found.userId))
      .limit(1);

    req.user = {
      userId: found.userId,
      email: '',
      role: role?.role || 'user',
    };

    // If moderator, scope to their assigned buildings
    if (req.user.role === 'moderator') {
      const rows = await db
        .select({ buildingId: moderatorBuildings.buildingId })
        .from(moderatorBuildings)
        .where(eq(moderatorBuildings.userId, found.userId));
      req.allowedBuildingIds = rows.map((r) => r.buildingId);
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
