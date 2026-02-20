import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as expenseService from '../services/expense.service.js';

export const expenseRoutes = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createExpenseSchema = z.object({
  buildingId: z.string().uuid(),
  description: z.string().max(500).optional(),
  amount: z.number().positive().max(9999999999),
  expenseDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD format'),
  category: z.string().max(100).optional(),
  isRecurring: z.boolean().optional(),
  recurringType: z.enum(['monthly', 'yearly']).optional(),
  recurringStartDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD format').optional(),
  recurringEndDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD format').optional(),
  parentExpenseId: z.string().uuid().optional(),
  apartmentId: z.string().uuid().optional(),
});

const updateExpenseSchema = z.object({
  description: z.string().max(500).optional(),
  amount: z.number().positive().max(9999999999).optional(),
  expenseDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD format').optional(),
  category: z.string().max(100).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const listExpenseQuerySchema = z.object({
  buildingId: z.string().uuid().optional(),
});

expenseRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listExpenseQuerySchema.parse(req.query);
    const result = await expenseService.listExpenses({
      buildingId: query.buildingId,
      allowedBuildingIds: req.allowedBuildingIds,
    });
    res.json(result);
  } catch (err) { next(err); }
});

expenseRoutes.get('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await expenseService.getExpense(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

expenseRoutes.post('/', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, validate(createExpenseSchema), auditLog('create', 'expenses'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Moderators can only create expenses for their assigned buildings
    if (req.allowedBuildingIds && !req.allowedBuildingIds.includes(req.body.buildingId)) {
      res.status(403).json({ error: 'Not authorized for this building' });
      return;
    }
    const result = await expenseService.createExpense(req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

expenseRoutes.put('/:id', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams, body: updateExpenseSchema }), auditLog('update', 'expenses'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await expenseService.updateExpense(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

expenseRoutes.delete('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'expenses'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await expenseService.deleteExpense(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});
