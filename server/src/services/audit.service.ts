import { db } from '../config/database.js';
import { auditLogs } from '../db/schema/index.js';
import { desc, eq, and, gte, lte, inArray } from 'drizzle-orm';

export async function listAuditLogs(filters?: {
  userId?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const { limit = 100, offset = 0 } = filters || {};

  let query = db.select().from(auditLogs);

  const conditions: any[] = [];
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters?.actionType) conditions.push(eq(auditLogs.actionType, filters.actionType as any));
  if (filters?.startDate) conditions.push(gte(auditLogs.createdAt, new Date(filters.startDate)));
  if (filters?.endDate) conditions.push(lte(auditLogs.createdAt, new Date(filters.endDate)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query.orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
}

export async function logAuditEvent(data: {
  userId?: string;
  userEmail?: string;
  actionType: string;
  tableName?: string;
  recordId?: string;
  actionDetails?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.insert(auditLogs).values({
    userId: data.userId,
    userEmail: data.userEmail,
    actionType: data.actionType as any,
    tableName: data.tableName,
    recordId: data.recordId,
    actionDetails: data.actionDetails,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}
