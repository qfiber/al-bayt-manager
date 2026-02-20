import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { moderatorBuildings } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

/**
 * For moderators: queries their assigned buildings and attaches the IDs to req.
 * Admins get no restriction (allowedBuildingIds remains undefined = all buildings).
 */
export async function scopeToModeratorBuildings(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      next();
      return;
    }

    if (req.user.role === 'moderator') {
      const rows = await db
        .select({ buildingId: moderatorBuildings.buildingId })
        .from(moderatorBuildings)
        .where(eq(moderatorBuildings.userId, req.user.userId));

      req.allowedBuildingIds = rows.map((r) => r.buildingId);
    }

    next();
  } catch (err) {
    next(err);
  }
}
