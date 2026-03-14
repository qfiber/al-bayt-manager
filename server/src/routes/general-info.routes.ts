import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import { db } from '../config/database.js';
import { generalInformation } from '../db/schema/index.js';
import { eq, and, asc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export const generalInfoRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });
const createSchema = z.object({
  title: z.string().optional(),
  text1: z.string().optional(),
  text2: z.string().optional(),
  text3: z.string().optional(),
  displayOrder: z.number().int().optional(),
});
const updateSchema = createSchema.partial();

generalInfoRoutes.get('/', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = db.select().from(generalInformation);
    const result = req.organizationId
      ? await query.where(eq(generalInformation.organizationId, req.organizationId)).orderBy(asc(generalInformation.displayOrder))
      : await query.orderBy(asc(generalInformation.displayOrder));
    res.json(result);
  } catch (err) { next(err); }
});

generalInfoRoutes.post('/', requireAuth, requireRole('admin'), requireOrgScope, validate(createSchema), auditLog('create', 'general_information'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [result] = await db.insert(generalInformation).values({ ...req.body, ...(req.organizationId ? { organizationId: req.organizationId } : {}) }).returning();
    res.status(201).json(result);
  } catch (err) { next(err); }
});

generalInfoRoutes.put('/:id', requireAuth, requireRole('admin'), requireOrgScope, validate({ params: idParams, body: updateSchema }), auditLog('update', 'general_information'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions = [eq(generalInformation.id, req.params.id as string)];
    if (req.organizationId) conditions.push(eq(generalInformation.organizationId, req.organizationId));
    const [result] = await db
      .update(generalInformation)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    if (!result) throw new AppError(404, 'Not found');
    res.json(result);
  } catch (err) { next(err); }
});

generalInfoRoutes.delete('/:id', requireAuth, requireRole('admin'), requireOrgScope, validate({ params: idParams }), auditLog('delete', 'general_information'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleteConditions = [eq(generalInformation.id, req.params.id as string)];
    if (req.organizationId) deleteConditions.push(eq(generalInformation.organizationId, req.organizationId));
    const [result] = await db.delete(generalInformation).where(and(...deleteConditions)).returning();
    if (!result) throw new AppError(404, 'Not found');
    res.json(result);
  } catch (err) { next(err); }
});
