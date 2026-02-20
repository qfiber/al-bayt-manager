import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as apartmentService from '../services/apartment.service.js';

export const apartmentRoutes = Router();

const createApartmentSchema = z.object({
  apartmentNumber: z.string().min(1).max(50),
  floor: z.number().int().optional(),
  buildingId: z.string().uuid(),
  status: z.enum(['occupied', 'vacant']).optional(),
  subscriptionAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid numeric amount').optional(),
  subscriptionStatus: z.enum(['active', 'inactive']).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  beneficiaryId: z.string().uuid().nullable().optional(),
  occupancyStart: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

const updateApartmentSchema = z.object({
  apartmentNumber: z.string().min(1).max(50).optional(),
  floor: z.number().int().optional(),
  status: z.enum(['occupied', 'vacant']).optional(),
  subscriptionAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid numeric amount').optional(),
  subscriptionStatus: z.enum(['active', 'inactive']).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  beneficiaryId: z.string().uuid().nullable().optional(),
  occupancyStart: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const listApartmentQuerySchema = z.object({
  buildingId: z.string().uuid().optional(),
});

apartmentRoutes.get('/', requireAuth, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listApartmentQuerySchema.parse(req.query);
    const result = await apartmentService.listApartments(query.buildingId, req.allowedBuildingIds);
    res.json(result);
  } catch (err) { next(err); }
});

apartmentRoutes.get('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apartmentService.getApartment(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

apartmentRoutes.post('/', requireAuth, requireRole('admin'), validate(createApartmentSchema), auditLog('create', 'apartments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      occupancyStart: req.body.occupancyStart ? new Date(req.body.occupancyStart) : undefined,
    };
    const result = await apartmentService.createApartment(data);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

apartmentRoutes.put('/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateApartmentSchema }), auditLog('update', 'apartments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: any = { ...req.body };
    // Never allow changing buildingId — would break expense/ledger history
    delete data.buildingId;
    if (data.occupancyStart !== undefined) {
      data.occupancyStart = data.occupancyStart ? new Date(data.occupancyStart) : null;
    }
    const result = await apartmentService.updateApartment(req.params.id, data);
    res.json(result);
  } catch (err) { next(err); }
});

apartmentRoutes.delete('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'apartments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apartmentService.deleteApartment(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

apartmentRoutes.post('/:id/terminate', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('update', 'apartments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apartmentService.terminateOccupancy(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

apartmentRoutes.get('/:id/debt-details', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apartmentService.getDebtDetails(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

apartmentRoutes.get('/:id/ledger', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ledgerQuerySchema.parse(req.query);
    const result = await apartmentService.getApartmentLedger(req.params.id, query.limit, query.offset);
    res.json(result);
  } catch (err) { next(err); }
});
