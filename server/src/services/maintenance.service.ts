import { db } from '../config/database.js';
import { maintenanceJobs, buildings, issueReports } from '../db/schema/index.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as expenseService from './expense.service.js';

export async function listJobs(filters?: {
  buildingId?: string;
  status?: string;
  allowedBuildingIds?: string[];
}) {
  let query = db
    .select({
      job: maintenanceJobs,
      buildingName: buildings.name,
    })
    .from(maintenanceJobs)
    .innerJoin(buildings, eq(maintenanceJobs.buildingId, buildings.id));

  const conditions: any[] = [];
  if (filters?.buildingId) conditions.push(eq(maintenanceJobs.buildingId, filters.buildingId));
  if (filters?.status) conditions.push(eq(maintenanceJobs.status, filters.status as any));
  if (filters?.allowedBuildingIds?.length) {
    conditions.push(inArray(maintenanceJobs.buildingId, filters.allowedBuildingIds));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return (query as any).orderBy(desc(maintenanceJobs.createdAt));
}

export async function getJob(id: string) {
  const [job] = await db
    .select({
      job: maintenanceJobs,
      buildingName: buildings.name,
    })
    .from(maintenanceJobs)
    .innerJoin(buildings, eq(maintenanceJobs.buildingId, buildings.id))
    .where(eq(maintenanceJobs.id, id))
    .limit(1);

  if (!job) throw new AppError(404, 'Maintenance job not found');
  return job;
}

export async function createJob(data: {
  buildingId: string;
  issueId?: string | null;
  title: string;
  description?: string;
  estimatedCost?: number | null;
}, userId: string) {
  // Verify building exists
  const [building] = await db.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, data.buildingId)).limit(1);
  if (!building) throw new AppError(404, 'Building not found');

  let expenseId: string | undefined;

  // If estimated cost is provided, create an expense first (has its own transaction)
  if (data.estimatedCost && data.estimatedCost > 0) {
    const today = new Date().toISOString().split('T')[0];
    const expense = await expenseService.createExpense({
      buildingId: data.buildingId,
      description: data.title,
      amount: data.estimatedCost,
      expenseDate: today,
      category: 'maintenance',
    }, userId);
    expenseId = expense.id;
  }

  // Insert maintenance job
  const [job] = await db
    .insert(maintenanceJobs)
    .values({
      buildingId: data.buildingId,
      issueId: data.issueId || null,
      title: data.title,
      description: data.description,
      estimatedCost: data.estimatedCost ? data.estimatedCost.toFixed(2) : null,
      expenseId: expenseId || null,
      createdBy: userId,
    })
    .returning();

  // If linked to an issue, update its status to in_progress
  if (data.issueId) {
    await db
      .update(issueReports)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(issueReports.id, data.issueId));
  }

  return job;
}

export async function updateJob(id: string, data: Partial<{
  title: string;
  description: string;
  status: string;
}>) {
  const updateData: any = { updatedAt: new Date() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;

  const [job] = await db
    .update(maintenanceJobs)
    .set(updateData)
    .where(eq(maintenanceJobs.id, id))
    .returning();

  if (!job) throw new AppError(404, 'Maintenance job not found');
  return job;
}

export async function deleteJob(id: string) {
  const [job] = await db.delete(maintenanceJobs).where(eq(maintenanceJobs.id, id)).returning();
  if (!job) throw new AppError(404, 'Maintenance job not found');
  return job;
}
