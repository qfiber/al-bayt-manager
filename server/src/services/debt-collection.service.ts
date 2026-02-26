import cron from 'node-cron';
import { db } from '../config/database.js';
import { debtCollectionStages, debtCollectionLog, apartments, buildings } from '../db/schema/index.js';
import { eq, and, lt, isNotNull, desc, sql, asc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../config/logger.js';
import * as notificationService from './notification.service.js';

// --- CRUD for stages ---

export async function listStages() {
  return db.select().from(debtCollectionStages).orderBy(asc(debtCollectionStages.stageNumber));
}

export async function createStage(data: {
  stageNumber: number;
  name: string;
  daysOverdue: number;
  actionType: string;
  templateId?: string;
  settings?: any;
  isActive?: boolean;
}) {
  const [stage] = await db
    .insert(debtCollectionStages)
    .values({
      stageNumber: data.stageNumber,
      name: data.name,
      daysOverdue: data.daysOverdue,
      actionType: data.actionType as any,
      templateId: data.templateId || null,
      settings: data.settings || {},
      isActive: data.isActive ?? true,
    })
    .returning();
  return stage;
}

export async function updateStage(id: string, data: {
  stageNumber?: number;
  name?: string;
  daysOverdue?: number;
  actionType?: string;
  templateId?: string | null;
  settings?: any;
  isActive?: boolean;
}) {
  const updateData: any = { updatedAt: new Date() };
  if (data.stageNumber !== undefined) updateData.stageNumber = data.stageNumber;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.daysOverdue !== undefined) updateData.daysOverdue = data.daysOverdue;
  if (data.actionType !== undefined) updateData.actionType = data.actionType;
  if (data.templateId !== undefined) updateData.templateId = data.templateId;
  if (data.settings !== undefined) updateData.settings = data.settings;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [stage] = await db
    .update(debtCollectionStages)
    .set(updateData)
    .where(eq(debtCollectionStages.id, id))
    .returning();

  if (!stage) throw new AppError(404, 'Stage not found');
  return stage;
}

export async function deleteStage(id: string) {
  const [stage] = await db.delete(debtCollectionStages).where(eq(debtCollectionStages.id, id)).returning();
  if (!stage) throw new AppError(404, 'Stage not found');
  return { success: true };
}

// --- Collection Log ---

export async function getCollectionLog(filters?: { apartmentId?: string; limit?: number; offset?: number }) {
  const conditions: any[] = [];
  if (filters?.apartmentId) conditions.push(eq(debtCollectionLog.apartmentId, filters.apartmentId));

  let query = db
    .select({
      log: debtCollectionLog,
      stageName: debtCollectionStages.name,
      apartmentNumber: apartments.apartmentNumber,
      buildingName: buildings.name,
    })
    .from(debtCollectionLog)
    .innerJoin(debtCollectionStages, eq(debtCollectionLog.stageId, debtCollectionStages.id))
    .innerJoin(apartments, eq(debtCollectionLog.apartmentId, apartments.id))
    .innerJoin(buildings, eq(apartments.buildingId, buildings.id));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return (query as any)
    .orderBy(desc(debtCollectionLog.createdAt))
    .limit(filters?.limit || 100)
    .offset(filters?.offset || 0);
}

// --- Core Collection Processing ---

export async function processCollections() {
  logger.info('Starting debt collection processing');

  // 1. Fetch active stages ordered by days_overdue DESC (most severe first)
  const stages = await db
    .select()
    .from(debtCollectionStages)
    .where(eq(debtCollectionStages.isActive, true))
    .orderBy(desc(debtCollectionStages.daysOverdue));

  if (stages.length === 0) {
    logger.info('No active collection stages configured');
    return { processed: 0 };
  }

  // 2. Fetch occupied apartments with negative balance and debt_since set
  const debtApartments = await db
    .select()
    .from(apartments)
    .where(
      and(
        eq(apartments.status, 'occupied'),
        lt(sql`${apartments.cachedBalance}::numeric`, sql`0`),
        isNotNull(apartments.debtSince),
      ),
    );

  let processed = 0;

  for (const apt of debtApartments) {
    if (!apt.debtSince) continue;

    const daysSinceDebt = Math.floor(
      (Date.now() - new Date(apt.debtSince).getTime()) / (1000 * 60 * 60 * 24),
    );

    // Find the correct stage (highest days_overdue that's <= daysSinceDebt)
    let targetStage = null;
    for (const stage of stages) {
      if (daysSinceDebt >= stage.daysOverdue) {
        targetStage = stage;
        break; // stages are ordered DESC, so first match is the highest applicable
      }
    }

    if (!targetStage) continue;

    // Check if we need to escalate (different stage than current)
    if (apt.collectionStageId === targetStage.id) continue;

    // Escalate: update stage, log action, trigger notification
    await db
      .update(apartments)
      .set({ collectionStageId: targetStage.id, updatedAt: new Date() })
      .where(eq(apartments.id, apt.id));

    await db.insert(debtCollectionLog).values({
      apartmentId: apt.id,
      stageId: targetStage.id,
      actionTaken: `Escalated to stage: ${targetStage.name}`,
      details: {
        balance: apt.cachedBalance,
        daysOverdue: daysSinceDebt,
        actionType: targetStage.actionType,
      },
    });

    // Send notification
    try {
      await notificationService.sendPaymentReminder(apt.id);
    } catch {
      // Non-critical
    }

    processed++;
  }

  // 3. Clear collection for apartments that are no longer in debt
  const clearedApartments = await db
    .select()
    .from(apartments)
    .where(
      and(
        isNotNull(apartments.collectionStageId),
        sql`${apartments.cachedBalance}::numeric >= 0`,
      ),
    );

  for (const apt of clearedApartments) {
    await db
      .update(apartments)
      .set({ collectionStageId: null, debtSince: null, updatedAt: new Date() })
      .where(eq(apartments.id, apt.id));
  }

  logger.info(`Debt collection processed: ${processed} escalated, ${clearedApartments.length} cleared`);
  return { processed, cleared: clearedApartments.length };
}

// --- Cron ---

export function startDebtCollectionCron() {
  // Run daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    try {
      await processCollections();
    } catch (err) {
      logger.error(err, 'Debt collection cron failed');
    }
  });
  logger.info('Debt collection cron started (daily at 8:00 AM)');
}
