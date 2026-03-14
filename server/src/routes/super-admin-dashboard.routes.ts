import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/org-scope.js';
import * as dashboardService from '../services/super-admin-dashboard.service.js';

export const superAdminDashboardRoutes = Router();

superAdminDashboardRoutes.get('/dashboard', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dashboardService.getDashboardData();
    res.json(result);
  } catch (err) { next(err); }
});
