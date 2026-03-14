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

export async function getExtendedMetrics() {
  const [
    recentPayments,
    recentInvoices,
    topDebtors,
    orgBuildingCounts,
  ] = await Promise.all([
    // Recent payments across all orgs (last 20)
    db.execute(sql`
      SELECT p.id, p.amount::text, p.month, p.created_at,
        a.apartment_number, b.name AS building_name, o.name AS org_name
      FROM payments p
      JOIN apartments a ON p.apartment_id = a.id
      JOIN buildings b ON a.building_id = b.id
      LEFT JOIN organizations o ON b.organization_id = o.id
      WHERE p.is_canceled = false
      ORDER BY p.created_at DESC LIMIT 20
    `),
    // Recent invoices across all orgs (last 20)
    db.execute(sql`
      SELECT i.id, i.invoice_number, i.total_amount::text, i.month, i.generated_at,
        a.apartment_number, b.name AS building_name, o.name AS org_name
      FROM invoices i
      JOIN apartments a ON i.apartment_id = a.id
      JOIN buildings b ON a.building_id = b.id
      LEFT JOIN organizations o ON b.organization_id = o.id
      ORDER BY i.generated_at DESC LIMIT 20
    `),
    // Top apartments with debt (negative balance)
    db.execute(sql`
      SELECT a.id, a.apartment_number, a.cached_balance::text,
        b.name AS building_name, o.name AS org_name
      FROM apartments a
      JOIN buildings b ON a.building_id = b.id
      LEFT JOIN organizations o ON b.organization_id = o.id
      WHERE a.cached_balance::numeric < 0
      ORDER BY a.cached_balance::numeric ASC
      LIMIT 20
    `),
    // Building count per org
    db.execute(sql`
      SELECT o.id, o.name, o.subdomain, o.is_active,
        (SELECT count(*)::int FROM buildings b WHERE b.organization_id = o.id) AS building_count,
        (SELECT count(*)::int FROM apartments a JOIN buildings b2 ON a.building_id = b2.id WHERE b2.organization_id = o.id) AS apartment_count,
        (SELECT COALESCE(SUM(p2.amount::numeric), 0)::text FROM payments p2 JOIN apartments a2 ON p2.apartment_id = a2.id JOIN buildings b3 ON a2.building_id = b3.id WHERE b3.organization_id = o.id AND p2.is_canceled = false) AS total_revenue
      FROM organizations o
      ORDER BY total_revenue DESC
    `),
  ]);

  return {
    recentPayments: recentPayments.rows,
    recentInvoices: recentInvoices.rows,
    topDebtors: topDebtors.rows,
    orgDetails: orgBuildingCounts.rows,
  };
}

export async function getMonthlyTrends() {
  const result = await db.execute(sql`
    SELECT
      to_char(p.created_at, 'YYYY-MM') AS month,
      COALESCE(SUM(p.amount::numeric), 0)::text AS revenue,
      (SELECT count(*)::int FROM apartments WHERE status = 'occupied') AS occupied,
      (SELECT count(*)::int FROM apartments) AS total_apartments
    FROM payments p
    WHERE p.is_canceled = false
      AND p.created_at > NOW() - INTERVAL '12 months'
    GROUP BY to_char(p.created_at, 'YYYY-MM')
    ORDER BY month
  `);
  return result.rows;
}
