import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import * as leaseService from '../services/lease.service.js';

export const leaseRoutes = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createLeaseSchema = z.object({
  apartmentId: z.string().uuid(),
  tenantName: z.string().min(1).max(255),
  tenantEmail: z.string().email().optional(),
  tenantPhone: z.string().max(50).optional(),
  startDate: z.string().regex(dateRegex),
  endDate: z.string().regex(dateRegex).optional(),
  monthlyRent: z.string().regex(/^\d+(\.\d{1,2})?$/),
  securityDeposit: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  terms: z.string().max(5000).optional(),
});

const updateLeaseSchema = createLeaseSchema.partial().extend({
  status: z.enum(['active', 'expired', 'terminated']).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

leaseRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leaseService.listLeases(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

leaseRoutes.get('/expiring', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const result = await leaseService.getExpiringLeases(req.organizationId, days);
    res.json(result);
  } catch (err) { next(err); }
});

leaseRoutes.get('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leaseService.getLease(req.params.id as string, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

leaseRoutes.post('/', requireAuth, requireRole('admin'), validate(createLeaseSchema), auditLog('create', 'leases'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leaseService.createLease({ ...req.body, organizationId: req.organizationId });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

leaseRoutes.put('/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateLeaseSchema }), auditLog('update', 'leases'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leaseService.updateLease(req.params.id as string, req.body, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

leaseRoutes.delete('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'leases'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await leaseService.deleteLease(req.params.id as string, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});
