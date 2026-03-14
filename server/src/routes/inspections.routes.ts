import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as inspectionService from '../services/inspection.service.js';

export const inspectionRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });

const createInspectionSchema = z.object({
  buildingId: z.string().uuid().optional(),
  apartmentId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.enum(['inspection', 'maintenance', 'visit']).optional(),
  scheduledAt: z.string().min(1),
  duration: z.string().optional(),
  notifyEmail: z.string().optional(),
  notifySms: z.string().optional(),
});

const updateInspectionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  type: z.enum(['inspection', 'maintenance', 'visit']).optional(),
  scheduledAt: z.string().optional(),
  duration: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
});

// List inspections
inspectionRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectionService.listInspections(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

// Create inspection (and optionally notify tenants)
inspectionRoutes.post('/', requireAuth, requireRole('admin'), requireOrgScope, validate(createInspectionSchema), auditLog('create', 'inspections'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await inspectionService.createInspection({
      ...req.body,
      organizationId: req.organizationId,
    });

    // Send notifications to affected tenants
    if (req.body.notifyEmail === 'true' || req.body.notifySms === 'true') {
      const tenants = await inspectionService.getAffectedTenants(req.body.buildingId, req.body.apartmentId);
      // Fire-and-forget notification sending
      for (const tenant of tenants) {
        if (req.body.notifyEmail === 'true' && tenant.email) {
          try {
            const { sendInspectionNotificationEmail } = await import('../services/email.service.js');
            await sendInspectionNotificationEmail(tenant.email, {
              tenantName: tenant.name || '',
              title: req.body.title,
              description: req.body.description || '',
              scheduledAt: req.body.scheduledAt,
              type: req.body.type || 'inspection',
            });
          } catch { /* don't fail on notification error */ }
        }
      }
    }

    res.status(201).json(inspection);
  } catch (err) { next(err); }
});

// Download ICS calendar file
inspectionRoutes.get('/:id/calendar', requireAuth, requireOrgScope, validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { db } = await import('../config/database.js');
    const { inspections } = await import('../db/schema/index.js');
    const { eq } = await import('drizzle-orm');
    const { and: andOp } = await import('drizzle-orm');
    const conditions: any[] = [eq(inspections.id, req.params.id as string)];
    const [inspection] = await db
      .select()
      .from(inspections)
      .where(andOp(...conditions))
      .limit(1);
    if (!inspection) { res.status(404).json({ error: 'Not found' }); return; }

    // Verify org ownership
    if (req.organizationId && inspection.organizationId !== req.organizationId) {
      res.status(403).json({ error: 'Not authorized' }); return;
    }

    const ics = inspectionService.generateICS(inspection);
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="inspection-${inspection.id}.ics"`);
    res.send(ics);
  } catch (err) { next(err); }
});

// Update inspection
inspectionRoutes.put('/:id', requireAuth, requireRole('admin'), requireOrgScope, validate({ params: idParams, body: updateInspectionSchema }), auditLog('update', 'inspections'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectionService.updateInspection(req.params.id as string, req.body, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

// Delete inspection
inspectionRoutes.delete('/:id', requireAuth, requireRole('admin'), requireOrgScope, validate({ params: idParams }), auditLog('delete', 'inspections'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await inspectionService.deleteInspection(req.params.id as string, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});
