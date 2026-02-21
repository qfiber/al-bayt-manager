import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as expenseService from '../services/expense.service.js';
import * as apartmentService from '../services/apartment.service.js';

export const apartmentExpenseRoutes = Router();

const apartmentIdParams = z.object({ apartmentId: z.string().uuid() });
const idParams = z.object({ id: z.string().uuid() });

apartmentExpenseRoutes.get('/:apartmentId', requireAuth, requireRole('admin', 'moderator'), validate({ params: apartmentIdParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await expenseService.getApartmentExpenses(req.params.apartmentId as string);
    res.json(result);
  } catch (err) { next(err); }
});

apartmentExpenseRoutes.post('/:id/cancel', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, validate({ params: idParams }), auditLog('update', 'apartment_expenses'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Moderators: verify the apartment_expense belongs to their assigned buildings
    if (req.allowedBuildingIds) {
      const ae = await expenseService.getApartmentExpenseById(req.params.id as string);
      const apt = await apartmentService.getApartment(ae.apartmentId);
      if (!req.allowedBuildingIds.includes(apt.buildingId)) {
        res.status(403).json({ error: 'Not authorized for this apartment\'s building' });
        return;
      }
    }
    const result = await expenseService.cancelApartmentExpense(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

apartmentExpenseRoutes.post('/:id/waive', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, validate({ params: idParams }), auditLog('update', 'apartment_expenses'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Moderators: verify the apartment_expense belongs to their assigned buildings
    if (req.allowedBuildingIds) {
      const ae = await expenseService.getApartmentExpenseById(req.params.id as string);
      const apt = await apartmentService.getApartment(ae.apartmentId);
      if (!req.allowedBuildingIds.includes(apt.buildingId)) {
        res.status(403).json({ error: 'Not authorized for this apartment\'s building' });
        return;
      }
    }
    const result = await expenseService.waiveApartmentExpense(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});
