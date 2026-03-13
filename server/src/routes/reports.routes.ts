import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as reportService from '../services/report.service.js';

export const reportRoutes = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateRangeSchema = z.object({
  startDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').optional(),
});

const monthlyTrendsSchema = z.object({
  months: z.coerce.number().int().min(1).max(60).default(12),
});

reportRoutes.get('/summary', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId, req.allowedBuildingIds);
    const result = await reportService.getSummary(effectiveBuildingIds, startDate, endDate);
    res.json(result);
  } catch (err) { next(err); }
});

reportRoutes.get('/buildings', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId, req.allowedBuildingIds);
    const result = await reportService.getBuildingReports(effectiveBuildingIds);
    res.json(result);
  } catch (err) { next(err); }
});

reportRoutes.get('/monthly-trends', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { months } = monthlyTrendsSchema.parse(req.query);
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId, req.allowedBuildingIds);
    const result = await reportService.getMonthlyTrends(effectiveBuildingIds, months);
    res.json(result);
  } catch (err) { next(err); }
});

reportRoutes.get('/expenses-by-category', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId, req.allowedBuildingIds);
    const result = await reportService.getExpensesByCategory(effectiveBuildingIds, startDate, endDate);
    res.json(result);
  } catch (err) { next(err); }
});

reportRoutes.get('/reconciliation', requireAuth, requireRole('admin'), requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId);
    const result = await reportService.getReconciliation(effectiveBuildingIds);
    res.json(result);
  } catch (err) { next(err); }
});

reportRoutes.get('/portfolio', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId, req.allowedBuildingIds);
    const result = await reportService.getPortfolioOverview(effectiveBuildingIds);
    res.json(result);
  } catch (err) { next(err); }
});

reportRoutes.get('/portfolio/expenses', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId, req.allowedBuildingIds);
    const result = await reportService.getExpenseBreakdownByBuilding(effectiveBuildingIds);
    res.json(result);
  } catch (err) { next(err); }
});
