import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as buildingService from '../services/building.service.js';

export const buildingRoutes = Router();

const createBuildingSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  numberOfFloors: z.number().int().min(1).max(200).optional(),
  undergroundFloors: z.number().int().min(0).max(20).optional(),
  monthlyFee: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/),
    z.number().min(0),
  ]).transform((v) => String(v)).optional(),
  logoUrl: z.string().max(500).optional(),
  ntfyTopicUrl: z.string().max(500).nullable().optional(),
});

const updateBuildingSchema = createBuildingSchema.partial();

const idParams = z.object({ id: z.string().uuid() });

buildingRoutes.get('/', requireAuth, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await buildingService.listBuildings(req.allowedBuildingIds);
    res.json(result);
  } catch (err) { next(err); }
});

buildingRoutes.get('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await buildingService.getBuilding(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

buildingRoutes.post('/', requireAuth, requireRole('admin'), validate(createBuildingSchema), auditLog('create', 'buildings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await buildingService.createBuilding(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

buildingRoutes.put('/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateBuildingSchema }), auditLog('update', 'buildings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await buildingService.updateBuilding(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

buildingRoutes.delete('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'buildings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await buildingService.deleteBuilding(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});
