import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/org-scope.js';
import * as dashboardService from '../services/super-admin-dashboard.service.js';
import { db } from '../config/database.js';
import { users, profiles, organizationMembers, organizations } from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';

export const superAdminDashboardRoutes = Router();

superAdminDashboardRoutes.get('/dashboard', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dashboardService.getDashboardData();
    res.json(result);
  } catch (err) { next(err); }
});

superAdminDashboardRoutes.get('/extended', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dashboardService.getExtendedMetrics();
    res.json(result);
  } catch (err) { next(err); }
});

superAdminDashboardRoutes.get('/trends', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dashboardService.getMonthlyTrends();
    res.json(result);
  } catch (err) { next(err); }
});

superAdminDashboardRoutes.get('/landlords', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db
      .select({
        userId: organizationMembers.userId,
        email: users.email,
        name: profiles.name,
        phone: profiles.phone,
        role: organizationMembers.role,
        organizationId: organizationMembers.organizationId,
        organizationName: organizations.name,
        organizationSubdomain: organizations.subdomain,
        memberSince: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .leftJoin(profiles, eq(organizationMembers.userId, profiles.id))
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.role, 'org_admin'))
      .orderBy(desc(organizationMembers.createdAt));
    res.json(result);
  } catch (err) { next(err); }
});
