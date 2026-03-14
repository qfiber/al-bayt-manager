import { db } from '../config/database.js';
import { sql } from 'drizzle-orm';

export async function getDashboardData() {
  const [
    orgStats,
    userCount,
    buildingCount,
    apartmentStats,
    revenueTotal,
    orgGrowth,
    revenueByOrg,
    recentOrgs,
    recentAuditLogs,
    healthStats,
  ] = await Promise.all([
    // 1. Org counts
    db.execute(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active = true)::int AS active, count(*) FILTER (WHERE is_active = false)::int AS inactive FROM organizations`),
    // 2. User count
    db.execute(sql`SELECT count(*)::int AS total FROM users`),
    // 3. Building count
    db.execute(sql`SELECT count(*)::int AS total FROM buildings`),
    // 4. Apartment stats
    db.execute(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'occupied')::int AS occupied, count(*) FILTER (WHERE status = 'vacant')::int AS vacant FROM apartments`),
    // 5. Total revenue
    db.execute(sql`SELECT COALESCE(SUM(amount::numeric), 0)::text AS total_revenue FROM payments WHERE is_canceled = false`),
    // 6. Org growth by month
    db.execute(sql`SELECT to_char(created_at, 'YYYY-MM') AS month, count(*)::int AS count FROM organizations GROUP BY to_char(created_at, 'YYYY-MM') ORDER BY month`),
    // 7. Revenue by org (top 10)
    db.execute(sql`SELECT o.id, o.name, COALESCE(SUM(p.amount::numeric), 0)::text AS revenue FROM organizations o LEFT JOIN buildings b ON b.organization_id = o.id LEFT JOIN apartments a ON a.building_id = b.id LEFT JOIN payments p ON p.apartment_id = a.id AND p.is_canceled = false GROUP BY o.id, o.name ORDER BY revenue DESC LIMIT 10`),
    // 8. Recent orgs with counts
    db.execute(sql`SELECT o.id, o.name, o.is_active, o.created_at, (SELECT count(*)::int FROM organization_members om WHERE om.organization_id = o.id) AS member_count, (SELECT count(*)::int FROM buildings b WHERE b.organization_id = o.id) AS building_count FROM organizations o ORDER BY o.created_at DESC LIMIT 10`),
    // 9. Recent audit logs
    db.execute(sql`SELECT id, organization_id, user_email, action_type, table_name, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10`),
    // 10. System health
    db.execute(sql`SELECT (SELECT count(DISTINCT user_id)::int FROM audit_logs WHERE action_type = 'login' AND created_at > NOW() - INTERVAL '24 hours') AS active_users_24h, (SELECT count(*)::int FROM audit_logs WHERE action_type = 'failed_login' AND created_at > NOW() - INTERVAL '24 hours') AS failed_logins_24h, (SELECT count(*)::int FROM audit_logs WHERE action_type = 'rate_limited' AND created_at > NOW() - INTERVAL '24 hours') AS rate_limited_24h`),
  ]);

  // Compute cumulative org growth
  const growthRows = orgGrowth.rows as any[];
  let cumulative = 0;
  const orgGrowthData = growthRows.map((r: any) => {
    cumulative += r.count;
    return { month: r.month, new: r.count, cumulative };
  });

  return {
    kpis: {
      organizations: orgStats.rows[0] as any,
      users: userCount.rows[0] as any,
      buildings: buildingCount.rows[0] as any,
      apartments: apartmentStats.rows[0] as any,
      revenue: { total: (revenueTotal.rows[0] as any).total_revenue },
    },
    orgGrowth: orgGrowthData,
    revenueByOrg: (revenueByOrg.rows as any[]).map((r: any) => ({ id: r.id, name: r.name, revenue: r.revenue })),
    recentOrgs: (recentOrgs.rows as any[]).map((r: any) => ({
      id: r.id,
      name: r.name,
      isActive: r.is_active,
      createdAt: r.created_at,
      memberCount: r.member_count,
      buildingCount: r.building_count,
    })),
    recentAuditLogs: (recentAuditLogs.rows as any[]).map((r: any) => ({
      id: r.id,
      userEmail: r.user_email,
      actionType: r.action_type,
      tableName: r.table_name,
      createdAt: r.created_at,
      organizationId: r.organization_id,
    })),
    systemHealth: healthStats.rows[0] as any,
  };
}
