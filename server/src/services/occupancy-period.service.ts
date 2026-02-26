import { db } from '../config/database.js';
import { occupancyPeriods } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as ledgerService from './ledger.service.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type TxOrDb = NodePgDatabase<any> | typeof db;

/**
 * Get the active occupancy period for an apartment (if any).
 */
export async function getActivePeriod(apartmentId: string, txOrDb: TxOrDb = db) {
  const [period] = await txOrDb
    .select()
    .from(occupancyPeriods)
    .where(and(eq(occupancyPeriods.apartmentId, apartmentId), eq(occupancyPeriods.status, 'active')))
    .limit(1);
  return period || null;
}

/**
 * Create a new active occupancy period. Throws if one already exists.
 */
export async function createPeriod(
  apartmentId: string,
  tenantId: string | null,
  tenantName: string | null,
  startDate: Date,
  txOrDb: TxOrDb = db,
) {
  const existing = await getActivePeriod(apartmentId, txOrDb);
  if (existing) {
    throw new AppError(400, 'An active occupancy period already exists for this apartment');
  }

  const [period] = await txOrDb
    .insert(occupancyPeriods)
    .values({
      apartmentId,
      tenantId,
      tenantName,
      startDate,
    })
    .returning();

  return period;
}

/**
 * Close the active occupancy period for an apartment.
 * Snapshots the closing balance from period-scoped ledger entries.
 */
export async function closePeriod(apartmentId: string, txOrDb: TxOrDb = db) {
  const period = await getActivePeriod(apartmentId, txOrDb);
  if (!period) return null;

  const balance = await ledgerService.getBalance(apartmentId, txOrDb, period.id);

  const [closed] = await txOrDb
    .update(occupancyPeriods)
    .set({
      status: 'closed',
      endDate: new Date(),
      closingBalance: balance.toFixed(2),
    })
    .where(eq(occupancyPeriods.id, period.id))
    .returning();

  return closed;
}

/**
 * Get all occupancy periods for an apartment, ordered by start date descending.
 */
export async function getPeriodsForApartment(apartmentId: string) {
  return db
    .select()
    .from(occupancyPeriods)
    .where(eq(occupancyPeriods.apartmentId, apartmentId))
    .orderBy(desc(occupancyPeriods.startDate));
}

/**
 * Helper: get the active period ID for an apartment (or null).
 * Used by callers that just need the ID to tag ledger entries.
 */
export async function getActivePeriodId(apartmentId: string, txOrDb: TxOrDb = db): Promise<string | null> {
  const period = await getActivePeriod(apartmentId, txOrDb);
  return period?.id ?? null;
}
