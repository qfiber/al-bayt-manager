import { db } from '../config/database.js';
import { apartmentLedger, apartments } from '../db/schema/index.js';
import { eq, sql, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type TxOrDb = NodePgDatabase<any> | typeof db;

/**
 * Get the balance of an apartment from the ledger.
 * Balance = SUM(credits) - SUM(debits). Positive = overpayment, negative = debt.
 */
export async function getBalance(apartmentId: string, txOrDb: TxOrDb = db): Promise<number> {
  const [result] = await txOrDb
    .select({
      balance: sql<string>`COALESCE(SUM(
        CASE WHEN ${apartmentLedger.entryType} = 'credit' THEN ${apartmentLedger.amount}::numeric
             ELSE -${apartmentLedger.amount}::numeric
        END
      ), 0)`,
    })
    .from(apartmentLedger)
    .where(eq(apartmentLedger.apartmentId, apartmentId));

  return parseFloat(result.balance);
}

/**
 * Refresh the cached_balance column on the apartments table.
 */
export async function refreshCachedBalance(apartmentId: string, txOrDb: TxOrDb = db): Promise<number> {
  const balance = await getBalance(apartmentId, txOrDb);
  await txOrDb
    .update(apartments)
    .set({ cachedBalance: balance.toFixed(2), updatedAt: new Date() })
    .where(eq(apartments.id, apartmentId));
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
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'credit',
    amount: amount.toFixed(2),
    referenceType: 'payment',
    referenceId: paymentId,
    description: `Payment of ${amount}`,
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
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'debit',
    amount: amount.toFixed(2),
    referenceType: 'expense',
    referenceId: apartmentExpenseId,
    description,
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
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'debit',
    amount: amount.toFixed(2),
    referenceType: 'subscription',
    referenceId: null,
    description: description || `Monthly subscription ${month}`,
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
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'credit',
    amount: amount.toFixed(2),
    referenceType: 'waiver',
    referenceId: null,
    description,
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
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'debit',
    amount: amount.toFixed(2),
    referenceType: 'waiver',
    referenceId: null,
    description,
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
) {
  await txOrDb.insert(apartmentLedger).values({
    apartmentId,
    entryType: 'credit',
    amount: amount.toFixed(2),
    referenceType: 'occupancy_credit',
    referenceId: null,
    description: `Occupancy termination credit`,
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
    createdBy: userId,
  });
}

/**
 * Get ledger entries for an apartment, paginated.
 */
export async function getLedger(
  apartmentId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const { limit = 50, offset = 0 } = options;
  return db
    .select()
    .from(apartmentLedger)
    .where(eq(apartmentLedger.apartmentId, apartmentId))
    .orderBy(desc(apartmentLedger.createdAt))
    .limit(limit)
    .offset(offset);
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
