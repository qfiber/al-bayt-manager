import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as reportService from '../services/report.service.js';
import { db } from '../config/database.js';

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

// Enhanced dashboard metrics
reportRoutes.get('/dashboard-metrics', requireAuth, requireRole('admin', 'moderator'), requireOrgScope, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const effectiveBuildingIds = await reportService.resolveOrgBuildingIds(req.organizationId, req.allowedBuildingIds);

    // Build WHERE clause for buildings
    const buildingFilter = effectiveBuildingIds && effectiveBuildingIds.length > 0
      ? sql`b.id IN (${sql.join(effectiveBuildingIds.map(id => sql`${id}`), sql`, `)})`
      : sql`1=1`;

    const [metrics] = await Promise.all([
      db.execute(sql`
        SELECT
          -- Net income (payments - expenses)
          COALESCE((
            SELECT SUM(p.amount::numeric) FROM payments p
            JOIN apartments a ON p.apartment_id = a.id
            JOIN buildings b ON a.building_id = b.id
            WHERE p.is_canceled = false AND ${buildingFilter}
          ), 0)::text AS total_revenue,
          COALESCE((
            SELECT SUM(ae.amount::numeric) FROM apartment_expenses ae
            JOIN apartments a ON ae.apartment_id = a.id
            JOIN buildings b ON a.building_id = b.id
            WHERE ae.is_canceled = false AND ${buildingFilter}
          ), 0)::text AS total_expenses,
          -- Collection rate: paid / (paid + outstanding)
          COALESCE((
            SELECT SUM(CASE WHEN a.cached_balance::numeric >= 0 THEN 1 ELSE 0 END)::numeric /
                   NULLIF(COUNT(*)::numeric, 0) * 100
            FROM apartments a
            JOIN buildings b ON a.building_id = b.id
            WHERE a.status = 'occupied' AND ${buildingFilter}
          ), 0)::int AS collection_rate,
          -- Top debtors (apartments with most debt)
          (SELECT json_agg(d) FROM (
            SELECT a.id, a.apartment_number, a.cached_balance::text AS balance, b.name AS building_name,
              a.debt_since
            FROM apartments a
            JOIN buildings b ON a.building_id = b.id
            WHERE a.cached_balance::numeric < 0 AND ${buildingFilter}
            ORDER BY a.cached_balance::numeric ASC
            LIMIT 10
          ) d) AS top_debtors,
          -- Debt aging
          (SELECT json_build_object(
            'under30', COALESCE((SELECT COUNT(*)::int FROM apartments a2 JOIN buildings b2 ON a2.building_id = b2.id WHERE a2.cached_balance::numeric < 0 AND a2.debt_since IS NOT NULL AND a2.debt_since > NOW() - INTERVAL '30 days' AND ${buildingFilter}), 0),
            'days30to60', COALESCE((SELECT COUNT(*)::int FROM apartments a3 JOIN buildings b3 ON a3.building_id = b3.id WHERE a3.cached_balance::numeric < 0 AND a3.debt_since IS NOT NULL AND a3.debt_since <= NOW() - INTERVAL '30 days' AND a3.debt_since > NOW() - INTERVAL '60 days' AND ${buildingFilter}), 0),
            'days60to90', COALESCE((SELECT COUNT(*)::int FROM apartments a4 JOIN buildings b4 ON a4.building_id = b4.id WHERE a4.cached_balance::numeric < 0 AND a4.debt_since IS NOT NULL AND a4.debt_since <= NOW() - INTERVAL '60 days' AND a4.debt_since > NOW() - INTERVAL '90 days' AND ${buildingFilter}), 0),
            'over90', COALESCE((SELECT COUNT(*)::int FROM apartments a5 JOIN buildings b5 ON a5.building_id = b5.id WHERE a5.cached_balance::numeric < 0 AND a5.debt_since IS NOT NULL AND a5.debt_since <= NOW() - INTERVAL '90 days' AND ${buildingFilter}), 0),
            'noDate', COALESCE((SELECT COUNT(*)::int FROM apartments a6 JOIN buildings b6 ON a6.building_id = b6.id WHERE a6.cached_balance::numeric < 0 AND a6.debt_since IS NULL AND ${buildingFilter}), 0)
          )) AS debt_aging
      `),
    ]);

    const row = metrics.rows[0] as any;
    res.json({
      totalRevenue: row.total_revenue,
      totalExpenses: row.total_expenses,
      netIncome: (parseFloat(row.total_revenue) - parseFloat(row.total_expenses)).toFixed(2),
      collectionRate: row.collection_rate,
      topDebtors: row.top_debtors || [],
      debtAging: row.debt_aging,
    });
  } catch (err) { next(err); }
});
