import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import { db } from '../config/database.js';
import { publicBranding } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export const brandingRoutes = Router();

const updateBrandingSchema = z.object({
  companyName: z.string().optional(),
  logoUrl: z.string().optional(),
  turnstileEnabled: z.boolean().optional(),
  turnstileSiteKey: z.string().optional(),
});

brandingRoutes.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [result] = await db.select().from(publicBranding).limit(1);
    if (!result) {
      const [created] = await db.insert(publicBranding).values({}).returning();
      res.json(created);
      return;
    }
    res.json(result);
  } catch (err) { next(err); }
});

brandingRoutes.put('/', requireAuth, requireRole('admin'), validate(updateBrandingSchema), auditLog('update', 'public_branding'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [existing] = await db.select().from(publicBranding).limit(1);
    if (!existing) {
      const [created] = await db.insert(publicBranding).values(req.body).returning();
      res.json(created);
      return;
    }
    const [result] = await db
      .update(publicBranding)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(publicBranding.id, existing.id))
      .returning();
    res.json(result);
  } catch (err) { next(err); }
});
