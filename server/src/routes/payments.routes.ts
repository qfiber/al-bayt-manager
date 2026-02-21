import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as paymentService from '../services/payment.service.js';
import * as apartmentService from '../services/apartment.service.js';

export const paymentRoutes = Router();

const createPaymentSchema = z.object({
  apartmentId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format'),
  amount: z.number().positive().max(9999999999),
  allocations: z.array(z.object({
    apartmentExpenseId: z.string().uuid(),
    amountAllocated: z.number().positive().max(9999999999),
  })).optional(),
});

const updatePaymentSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM format').optional(),
  amount: z.number().positive().max(9999999999).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  buildingId: z.string().uuid().optional(),
  apartmentId: z.string().uuid().optional(),
});

paymentRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await paymentService.listPayments({
      buildingId: query.buildingId,
      apartmentId: query.apartmentId,
      allowedBuildingIds: req.allowedBuildingIds,
    });
    res.json(result);
  } catch (err) { next(err); }
});

paymentRoutes.get('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getPayment(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

paymentRoutes.post('/', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, validate(createPaymentSchema), auditLog('create', 'payments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Moderators can only create payments for apartments in their assigned buildings
    if (req.allowedBuildingIds) {
      const apt = await apartmentService.getApartment(req.body.apartmentId);
      if (!req.allowedBuildingIds.includes(apt.buildingId)) {
        res.status(403).json({ error: 'Not authorized for this apartment\'s building' });
        return;
      }
    }
    const result = await paymentService.createPayment(req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

paymentRoutes.put('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams, body: updatePaymentSchema }), auditLog('update', 'payments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.updatePayment(req.params.id as string, req.body, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

paymentRoutes.post('/:id/cancel', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, validate({ params: idParams }), auditLog('update', 'payments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Moderators can only cancel payments for apartments in their assigned buildings
    if (req.allowedBuildingIds) {
      const payment = await paymentService.getPayment(req.params.id as string);
      const apt = await apartmentService.getApartment(payment.apartmentId);
      if (!req.allowedBuildingIds.includes(apt.buildingId)) {
        res.status(403).json({ error: 'Not authorized for this apartment\'s building' });
        return;
      }
    }
    const result = await paymentService.cancelPayment(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});
