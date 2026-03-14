import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/org-scope.js';
import * as dashboardService from '../services/super-admin-dashboard.service.js';
import { db } from '../config/database.js';
import { users, profiles, organizationMembers, organizations } from '../db/schema/index.js';
import { eq, desc, sql } from 'drizzle-orm';

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

// Impersonation history
superAdminDashboardRoutes.get('/impersonation-log', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.execute(sql`
      SELECT al.id, al.user_email AS admin_email, al.action_details->>'targetUserId' AS target_user_id,
        al.created_at, al.ip_address,
        (SELECT u.email FROM users u WHERE u.id = (al.action_details->>'targetUserId')::uuid) AS target_email
      FROM audit_logs al
      WHERE al.action_type = 'login' AND al.action_details->>'action' = 'impersonate'
      ORDER BY al.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// Export organizations as CSV
superAdminDashboardRoutes.get('/export/organizations', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.execute(sql`
      SELECT o.name, o.subdomain, o.is_active, o.default_language, o.max_buildings, o.max_apartments,
        o.online_payments_enabled, o.last_activity_at, o.created_at,
        (SELECT count(*)::int FROM organization_members om WHERE om.organization_id = o.id) AS member_count,
        (SELECT count(*)::int FROM buildings b WHERE b.organization_id = o.id) AS building_count,
        (SELECT count(*)::int FROM apartments a JOIN buildings b2 ON a.building_id = b2.id WHERE b2.organization_id = o.id) AS apartment_count,
        (SELECT COALESCE(SUM(p.amount::numeric), 0)::text FROM payments p JOIN apartments a2 ON p.apartment_id = a2.id JOIN buildings b3 ON a2.building_id = b3.id WHERE b3.organization_id = o.id AND p.is_canceled = false) AS total_revenue
      FROM organizations o
      ORDER BY o.created_at DESC
    `);

    // Build CSV
    const headers = ['Name', 'Subdomain', 'Active', 'Language', 'Max Buildings', 'Max Apartments', 'Online Payments', 'Last Activity', 'Created', 'Members', 'Buildings', 'Apartments', 'Revenue'];
    const rows = (result.rows as any[]).map(r => [
      r.name, r.subdomain || '', r.is_active, r.default_language, r.max_buildings, r.max_apartments,
      r.online_payments_enabled, r.last_activity_at || '', r.created_at, r.member_count, r.building_count, r.apartment_count, r.total_revenue,
    ].map(String));

    const csv = [headers.join(','), ...rows.map(r => r.map((v: string) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="organizations-export.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) { next(err); }
});
