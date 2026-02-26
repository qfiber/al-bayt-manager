import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import * as bulkService from '../services/bulk.service.js';

export const bulkRoutes = Router();

const batchPaymentsSchema = z.object({
  apartmentIds: z.array(z.string().uuid()).min(1).max(500),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
  amount: z.number().positive().optional(),
  useSubscriptionAmount: z.boolean().optional(),
});

const batchInvoicesSchema = z.object({
  buildingIds: z.array(z.string().uuid()).min(1).max(100),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
});

const batchRemindersSchema = z.object({
  apartmentIds: z.array(z.string().uuid()).min(1).max(500),
});

bulkRoutes.post('/payments', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = batchPaymentsSchema.parse(req.body);
    const result = await bulkService.batchCreatePayments(data, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

bulkRoutes.post('/invoices', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = batchInvoicesSchema.parse(req.body);
    const result = await bulkService.batchGenerateInvoices(data);
    res.json(result);
  } catch (err) { next(err); }
});

bulkRoutes.post('/reminders', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = batchRemindersSchema.parse(req.body);
    const result = await bulkService.batchSendReminders(data, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});
