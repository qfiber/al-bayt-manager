import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import { db } from '../config/database.js';
import { buildingHandbook, buildings } from '../db/schema/index.js';
import { eq, and, asc } from 'drizzle-orm';

export const handbookRoutes = Router();

const createHandbookSchema = z.object({
  buildingId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50000),
  category: z.enum(['general', 'rules', 'emergency', 'maintenance', 'community']).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

// List handbook entries (admin)
handbookRoutes.get('/', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [];
    if (req.organizationId) conditions.push(eq(buildingHandbook.organizationId, req.organizationId));
    const buildingId = req.query.buildingId as string;
    if (buildingId) conditions.push(eq(buildingHandbook.buildingId, buildingId));

    const result = await db
      .select({
        entry: buildingHandbook,
        buildingName: buildings.name,
      })
      .from(buildingHandbook)
      .leftJoin(buildings, eq(buildingHandbook.buildingId, buildings.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(buildingHandbook.displayOrder));

    res.json(result);
  } catch (err) { next(err); }
});

// Create entry (admin)
handbookRoutes.post('/', requireAuth, requireOrgScope, requireRole('admin'), validate(createHandbookSchema), auditLog('create', 'building_handbook'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [entry] = await db.insert(buildingHandbook).values({
      ...req.body,
      organizationId: req.organizationId,
    }).returning();
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// Update entry
handbookRoutes.put('/:id', requireAuth, requireOrgScope, requireRole('admin'), validate({ params: idParams, body: createHandbookSchema.partial() }), auditLog('update', 'building_handbook'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [eq(buildingHandbook.id, req.params.id as string)];
    if (req.organizationId) conditions.push(eq(buildingHandbook.organizationId, req.organizationId));

    const [entry] = await db.update(buildingHandbook)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    if (!entry) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(entry);
  } catch (err) { next(err); }
});

// Delete entry
handbookRoutes.delete('/:id', requireAuth, requireOrgScope, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'building_handbook'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [eq(buildingHandbook.id, req.params.id as string)];
    if (req.organizationId) conditions.push(eq(buildingHandbook.organizationId, req.organizationId));

    const [entry] = await db.delete(buildingHandbook).where(and(...conditions)).returning();
    if (!entry) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(entry);
  } catch (err) { next(err); }
});

// Tenant: view handbook for their buildings
handbookRoutes.get('/my-handbook', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userApartments, apartments } = await import('../db/schema/index.js');
    const { inArray } = await import('drizzle-orm');

    const assignments = await db.select({ apartmentId: userApartments.apartmentId })
      .from(userApartments)
      .where(eq(userApartments.userId, req.user!.userId));

    if (assignments.length === 0) { res.json([]); return; }

    const apts = await db.select({ buildingId: apartments.buildingId })
      .from(apartments)
      .where(inArray(apartments.id, assignments.map(a => a.apartmentId)));

    const buildingIds = [...new Set(apts.map(a => a.buildingId))];

    const conditions: any[] = [];
    if (buildingIds.length > 0) {
      const { or, isNull } = await import('drizzle-orm');
      // Show entries for tenant's buildings OR global entries (no building)
      conditions.push(or(inArray(buildingHandbook.buildingId, buildingIds), isNull(buildingHandbook.buildingId)));
    }
    if (req.organizationId) conditions.push(eq(buildingHandbook.organizationId, req.organizationId));

    const result = await db
      .select({
        entry: buildingHandbook,
        buildingName: buildings.name,
      })
      .from(buildingHandbook)
      .leftJoin(buildings, eq(buildingHandbook.buildingId, buildings.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(buildingHandbook.displayOrder));

    res.json(result);
  } catch (err) { next(err); }
});
