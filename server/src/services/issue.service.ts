import { db } from '../config/database.js';
import { issueReports, issueAttachments, buildings, profiles, userApartments, apartments } from '../db/schema/index.js';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as notificationService from './notification.service.js';

export async function listIssues(filters?: {
  buildingId?: string;
  status?: string;
  category?: string;
  allowedBuildingIds?: string[];
}) {
  let query = db
    .select({
      issue: issueReports,
      buildingName: buildings.name,
      reporterName: profiles.name,
    })
    .from(issueReports)
    .innerJoin(buildings, eq(issueReports.buildingId, buildings.id))
    .innerJoin(profiles, eq(issueReports.reporterId, profiles.id));

  const conditions: any[] = [];
  if (filters?.buildingId) conditions.push(eq(issueReports.buildingId, filters.buildingId));
  if (filters?.status) conditions.push(eq(issueReports.status, filters.status as any));
  if (filters?.category) conditions.push(eq(issueReports.category, filters.category as any));
  if (filters?.allowedBuildingIds?.length) {
    conditions.push(inArray(issueReports.buildingId, filters.allowedBuildingIds));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return (query as any).orderBy(desc(issueReports.createdAt));
}

export async function getIssue(id: string) {
  const [issue] = await db
    .select({
      issue: issueReports,
      buildingName: buildings.name,
      reporterName: profiles.name,
    })
    .from(issueReports)
    .innerJoin(buildings, eq(issueReports.buildingId, buildings.id))
    .innerJoin(profiles, eq(issueReports.reporterId, profiles.id))
    .where(eq(issueReports.id, id))
    .limit(1);

  if (!issue) throw new AppError(404, 'Issue not found');

  const attachments = await db
    .select()
    .from(issueAttachments)
    .where(eq(issueAttachments.issueId, id));

  return { ...issue, attachments };
}

export async function createIssue(data: {
  buildingId: string;
  reporterId: string;
  floor?: number | null;
  category: string;
  description: string;
  attachments?: { fileUrl: string; fileType: string; originalName?: string }[];
}) {
  return await db.transaction(async (tx) => {
    // Verify building exists
    const [building] = await tx.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, data.buildingId)).limit(1);
    if (!building) throw new AppError(404, 'Building not found');

    // Insert issue
    const [issue] = await tx
      .insert(issueReports)
      .values({
        buildingId: data.buildingId,
        reporterId: data.reporterId,
        floor: data.floor ?? null,
        category: data.category as any,
        description: data.description,
      })
      .returning();

    // Insert attachments
    if (data.attachments?.length) {
      await tx.insert(issueAttachments).values(
        data.attachments.map((a) => ({
          issueId: issue.id,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          originalName: a.originalName,
        })),
      );
    }

    // Fire-and-forget notification
    const [reporterProfile] = await tx.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, data.reporterId)).limit(1);
    notificationService.notifyNewIssue(data.buildingId, {
      category: data.category,
      description: data.description,
      reporterName: reporterProfile?.name || 'Unknown',
      floor: data.floor,
    }).catch(() => {});

    return issue;
  });
}

export async function resolveIssue(id: string) {
  const [issue] = await db
    .update(issueReports)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(issueReports.id, id))
    .returning();

  if (!issue) throw new AppError(404, 'Issue not found');

  // Fire-and-forget notification to reporter
  notificationService.notifyIssueResolved(issue.reporterId, {
    category: issue.category,
    description: issue.description,
  }).catch(() => {});

  return issue;
}

export async function updateIssueStatus(id: string, status: string) {
  const [issue] = await db
    .update(issueReports)
    .set({
      status: status as any,
      updatedAt: new Date(),
      ...(status === 'resolved' ? { resolvedAt: new Date() } : {}),
    })
    .where(eq(issueReports.id, id))
    .returning();

  if (!issue) throw new AppError(404, 'Issue not found');
  return issue;
}

/**
 * Get building IDs accessible to a user (via their apartments).
 */
export async function getUserBuildingIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ buildingId: apartments.buildingId })
    .from(userApartments)
    .innerJoin(apartments, eq(userApartments.apartmentId, apartments.id))
    .where(eq(userApartments.userId, userId));

  return [...new Set(rows.map(r => r.buildingId))];
}

/**
 * Count open issues, optionally filtered by building IDs.
 */
export async function countOpenIssues(buildingIds?: string[]): Promise<number> {
  const conditions: any[] = [eq(issueReports.status, 'open')];
  if (buildingIds?.length) {
    conditions.push(inArray(issueReports.buildingId, buildingIds));
  }

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issueReports)
    .where(and(...conditions));

  return result.count;
}
