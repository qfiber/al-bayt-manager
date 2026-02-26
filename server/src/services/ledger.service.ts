import { db } from '../config/database.js';
import { apartmentLedger, apartments } from '../db/schema/index.js';
import { eq, sql, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type TxOrDb = NodePgDatabase<any> | typeof db;

/**
 * Get the balance of an apartment from the ledger.
 * Balance = SUM(credits) - SUM(debits). Positive = overpayment, negative = debt.
 * If periodId is provided, only sums entries for that period.
 */
export async function getBalance(apartmentId: string, txOrDb: TxOrDb = db, periodId?: string): Promise<number> {
  const conditions = [eq(apartmentLedger.apartmentId, apartmentId)];
  if (periodId) {
    conditions.push(eq(apartmentLedger.occupancyPeriodId, periodId));
  }

  const [result] = await txOrDb
    .select({
      balance: sql<string>`COALESCE(SUM(
        CASE WHEN ${apartmentLedger.entryType} = 'credit' THEN ${apartmentLedger.amount}::numeric
             ELSE -${apartmentLedger.amount}::numeric
        END
      ), 0)`,
    })
    .from(apartmentLedger)
    .where(and(...conditions));

  return parseFloat(result.balance);
}

/**
 * Refresh the cached_balance column on the apartments table.
 * Always uses all-time balance (no period filter) for the cached value.
 */
export async function refreshCachedBalance(apartmentId: string, txOrDb: TxOrDb = db): Promise<number> {
  const balance = await getBalance(apartmentId, txOrDb);
  await txOrDb
    .update(apartments)
    .set({ cachedBalance: balance.toFixed(2), updatedAt: new Date() })
    .where(eq(apartments.id, apartmentId));

  // Debt tracking for collection workflow
  if (balance < 0) {
    // Set debt_since if not already set
    await txOrDb
      .update(apartments)
      .set({ debtSince: sql`COALESCE(${apartments.debtSince}, NOW())` })
      .where(eq(apartments.id, apartmentId));
  } else {
    // Clear debt tracking
    await txOrDb
      .update(apartments)
      .set({ debtSince: null, collectionStageId: null })
      .where(eq(apartments.id, apartmentId));
  }

  return balance;
}

/**
 * Record a payment (credit entry).
 */
export async function recordPayment(
  apartmentId: string,
  paymentId: string,
  amount: number,
  userId: string,
  txOrDb: TxOrDb = db,
  occupancyPeriodId?: string,
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'credit',
    amount: amount.toFixed(2),
    referenceType: 'payment',
    referenceId: paymentId,
    description: `Payment of ${amount}`,
    occupancyPeriodId: occupancyPeriodId ?? null,
    createdBy: userId,
  });
}

/**
 * Record an expense charge (debit entry) for a specific apartment.
 */
export async function recordExpenseCharge(
  apartmentId: string,
  apartmentExpenseId: string,
  amount: number,
  description: string,
  userId: string,
  txOrDb: TxOrDb = db,
  occupancyPeriodId?: string,
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'debit',
    amount: amount.toFixed(2),
    referenceType: 'expense',
    referenceId: apartmentExpenseId,
    description,
    occupancyPeriodId: occupancyPeriodId ?? null,
    createdBy: userId,
  });
}

/**
 * Record a monthly subscription charge (debit entry).
 */
export async function recordSubscriptionCharge(
  apartmentId: string,
  amount: number,
  month: string,
  userId: string | null,
  txOrDb: TxOrDb = db,
  description?: string,
  occupancyPeriodId?: string,
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'debit',
    amount: amount.toFixed(2),
    referenceType: 'subscription',
    referenceId: null,
    description: description || `Monthly subscription ${month}`,
    occupancyPeriodId: occupancyPeriodId ?? null,
    createdBy: userId,
  });
}

/**
 * Record a waiver (credit entry — forgives part of a debt).
 */
export async function recordWaiver(
  apartmentId: string,
  amount: number,
  description: string,
  userId: string,
  txOrDb: TxOrDb = db,
  occupancyPeriodId?: string,
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'credit',
    amount: amount.toFixed(2),
    referenceType: 'waiver',
    referenceId: null,
    description,
    occupancyPeriodId: occupancyPeriodId ?? null,
    createdBy: userId,
  });
}

/**
 * Record a debit adjustment (e.g. write off overpayment).
 */
export async function recordDebitAdjustment(
  apartmentId: string,
  amount: number,
  description: string,
  userId: string,
  txOrDb: TxOrDb = db,
  occupancyPeriodId?: string,
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'debit',
    amount: amount.toFixed(2),
    referenceType: 'waiver',
    referenceId: null,
    description,
    occupancyPeriodId: occupancyPeriodId ?? null,
    createdBy: userId,
  });
}

/**
 * Record occupancy credit (prorated refund on termination).
 */
export async function recordOccupancyCredit(
  apartmentId: string,
  amount: number,
  userId: string,
  txOrDb: TxOrDb = db,
  occupancyPeriodId?: string,
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'credit',
    amount: amount.toFixed(2),
    referenceType: 'occupancy_credit',
    referenceId: null,
    description: `Occupancy termination credit`,
    occupancyPeriodId: occupancyPeriodId ?? null,
    createdBy: userId,
  });
}

/**
 * Record a reversal entry (opposite of original).
 */
export async function recordReversal(
  apartmentId: string,
  originalReferenceId: string,
  amount: number,
  originalEntryType: 'debit' | 'credit',
  description: string,
  userId: string,
  txOrDb: TxOrDb = db,
  occupancyPeriodId?: string,
) {
  // Reversal is the opposite of the original: if original was credit, reversal is debit and vice versa.
  const reversalType = originalEntryType === 'credit' ? 'debit' : 'credit';
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: reversalType,
    amount: amount.toFixed(2),
    referenceType: 'reversal',
    referenceId: originalReferenceId,
    description,
    occupancyPeriodId: occupancyPeriodId ?? null,
    createdBy: userId,
  });
}

/**
 * Get ledger entries for an apartment, paginated.
 * If periodId is provided, filters to that period.
 */
export async function getLedger(
  apartmentId: string,
  options: { limit?: number; offset?: number; periodId?: string } = {},
) {
  const { limit = 50, offset = 0, periodId } = options;

  const conditions = [eq(apartmentLedger.apartmentId, apartmentId)];
  if (periodId) {
    conditions.push(eq(apartmentLedger.occupancyPeriodId, periodId));
  }

  return db
    .select()
    .from(apartmentLedger)
    .where(and(...conditions))
    .orderBy(desc(apartmentLedger.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Find the occupancy period ID of a ledger entry by reference.
 * Used to tag reversals with the same period as the original entry.
 */
export async function findEntryPeriodId(
  apartmentId: string,
  referenceType: 'payment' | 'expense' | 'subscription' | 'waiver' | 'occupancy_credit' | 'reversal',
  referenceId: string,
  txOrDb: TxOrDb = db,
): Promise<string | null> {
  const [entry] = await txOrDb
    .select({ occupancyPeriodId: apartmentLedger.occupancyPeriodId })
    .from(apartmentLedger)
    .where(
      and(
        eq(apartmentLedger.apartmentId, apartmentId),
        eq(apartmentLedger.referenceType, referenceType),
        eq(apartmentLedger.referenceId, referenceId),
      ),
    )
    .limit(1);
  return entry?.occupancyPeriodId ?? null;
}

/**
 * Check if a subscription ledger entry already exists for a given apartment and month.
 */
export async function hasSubscriptionForMonth(
  apartmentId: string,
  month: string,
  txOrDb: TxOrDb = db,
): Promise<boolean> {
  const [existing] = await txOrDb
    .select({ id: apartmentLedger.id })
    .from(apartmentLedger)
    .where(
      and(
        eq(apartmentLedger.apartmentId, apartmentId),
        eq(apartmentLedger.referenceType, 'subscription'),
        eq(apartmentLedger.description, `Monthly subscription ${month}`),
      ),
    )
    .limit(1);
  return !!existing;
}

/**
 * Check if a subscription ledger entry already exists with a specific description.
 * Used for idempotency when posting child apartment charges to parent's ledger.
 */
export async function hasSubscriptionByDescription(
  apartmentId: string,
  description: string,
  txOrDb: TxOrDb = db,
): Promise<boolean> {
  const [existing] = await txOrDb
    .select({ id: apartmentLedger.id })
    .from(apartmentLedger)
    .where(
      and(
        eq(apartmentLedger.apartmentId, apartmentId),
        eq(apartmentLedger.referenceType, 'subscription'),
        eq(apartmentLedger.description, description),
      ),
    )
    .limit(1);
  return !!existing;
}
