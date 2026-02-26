import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as maintenanceService from '../services/maintenance.service.js';

export const maintenanceRoutes = Router();

const createJobSchema = z.object({
  buildingId: z.string().uuid(),
  issueId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
});

const updateJobSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

// GET /maintenance - List jobs (admin/moderator)
maintenanceRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buildingId, status } = req.query;
    const result = await maintenanceService.listJobs({
      buildingId: buildingId as string | undefined,
      status: status as string | undefined,
      allowedBuildingIds: req.allowedBuildingIds,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /maintenance/:id - Single job
maintenanceRoutes.get('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await maintenanceService.getJob(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /maintenance - Create job
maintenanceRoutes.post('/', requireAuth, requireRole('admin', 'moderator'), validate(createJobSchema), auditLog('create', 'maintenance_jobs'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await maintenanceService.createJob(req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PUT /maintenance/:id - Update job
maintenanceRoutes.put('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams, body: updateJobSchema }), auditLog('update', 'maintenance_jobs'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await maintenanceService.updateJob(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /maintenance/:id - Admin only
maintenanceRoutes.delete('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'maintenance_jobs'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await maintenanceService.deleteJob(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});
