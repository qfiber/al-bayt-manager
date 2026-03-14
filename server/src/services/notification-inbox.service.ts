import { db } from '../config/database.js';
import { auditLogs } from '../db/schema/index.js';
import { eq, and, desc, gt, sql } from 'drizzle-orm';

export async function getNotifications(organizationId?: string, limit = 20) {
  const conditions: any[] = [];
  if (organizationId) conditions.push(eq(auditLogs.organizationId, organizationId));

  const query = db
    .select({
      id: auditLogs.id,
      actionType: auditLogs.actionType,
      tableName: auditLogs.tableName,
      userEmail: auditLogs.userEmail,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function getUnreadCount(organizationId?: string, since?: Date) {
  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
  const conditions: any[] = [gt(auditLogs.createdAt, sinceDate)];
  if (organizationId) conditions.push(eq(auditLogs.organizationId, organizationId));

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(...conditions));

  return result?.count || 0;
}
