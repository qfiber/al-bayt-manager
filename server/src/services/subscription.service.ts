import cron from 'node-cron';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { apartments, expenses, apartmentExpenses } from '../db/schema/index.js';
import { eq, and, gt, isNull } from 'drizzle-orm';
import * as ledgerService from './ledger.service.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type TxOrDb = NodePgDatabase<any> | typeof db;

/**
 * Generate an array of YYYY-MM strings from startDate to endDate (inclusive).
 * Uses UTC to avoid timezone-dependent month boundaries.
 */
export function generateMonthRange(startDate: Date, endDate: Date): string[] {
  const months: string[] = [];
  const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

  while (current <= end) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
    months.push(`${yyyy}-${mm}`);
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return months;
}

/**
 * Backfill subscription charges for an apartment from its occupancy start date
 * to the current month. First month is prorated based on occupancy start day.
 * Idempotent — skips months that already have a subscription charge.
 */
export async function backfillSubscriptions(apartmentId: string, tx: TxOrDb) {
  const [apt] = await tx.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apt) return;

  // Guard conditions
  if (apt.status !== 'occupied') return;
  if (apt.subscriptionStatus !== 'active') return;
  const amount = parseFloat(apt.subscriptionAmount || '0');
  if (amount <= 0) return;
  if (!apt.occupancyStart) return;

  // Determine if this is a child apartment (storage/parking) that routes charges to parent
  const isChild = apt.apartmentType !== 'regular' && !!apt.parentApartmentId;
  const targetApartmentId = isChild ? apt.parentApartmentId! : apartmentId;

  // Build description prefix for child apartments (e.g. "Storage S-1 subscription 2026-02")
  const typeLabel = apt.apartmentType === 'storage' ? 'Storage' : apt.apartmentType === 'parking' ? 'Parking' : '';

  const occupancyStart = new Date(apt.occupancyStart);
  const now = new Date();
  const months = generateMonthRange(occupancyStart, now);

  for (let i = 0; i < months.length; i++) {
    const month = months[i];

    // Idempotency check
    if (isChild) {
      const desc = `${typeLabel} ${apt.apartmentNumber} subscription ${month}`;
      const exists = await ledgerService.hasSubscriptionByDescription(targetApartmentId, desc, tx);
      if (exists) continue;
    } else {
      const exists = await ledgerService.hasSubscriptionForMonth(targetApartmentId, month, tx);
      if (exists) continue;
    }

    let chargeAmount: number;

    if (i === 0) {
      // First month: prorate based on occupancy start day
      const [yyyy, mm] = month.split('-').map(Number);
      const daysInMonth = new Date(yyyy, mm, 0).getDate();
      const startDay = occupancyStart.getUTCDate();
      const remainingDays = daysInMonth - startDay + 1;

      if (remainingDays >= daysInMonth) {
        // Started on the 1st — full charge
        chargeAmount = amount;
      } else {
        const dailyRate = amount / daysInMonth;
        chargeAmount = Math.round(dailyRate * remainingDays * 100) / 100;
      }
    } else {
      // Full month charge
      chargeAmount = amount;
    }

    if (chargeAmount > 0) {
      const description = isChild
        ? `${typeLabel} ${apt.apartmentNumber} subscription ${month}`
        : undefined;
      await ledgerService.recordSubscriptionCharge(targetApartmentId, chargeAmount, month, null, tx, description);
    }
  }

  await ledgerService.refreshCachedBalance(targetApartmentId, tx);
}

/**
 * Generate monthly subscription charges for all occupied apartments.
 * Uses backfillSubscriptions so it's idempotent and handles missed months.
 * Runs on the 1st of each month at midnight.
 */
async function generateMonthlySubscriptions() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  logger.info({ month }, 'Generating subscription charges');

  try {
    const occupiedApartments = await db
      .select()
      .from(apartments)
      .where(
        and(
          eq(apartments.status, 'occupied'),
          eq(apartments.subscriptionStatus, 'active'),
          gt(apartments.subscriptionAmount, '0'),
        ),
      );

    let count = 0;
    for (const apt of occupiedApartments) {
      try {
        await db.transaction(async (tx) => {
          await backfillSubscriptions(apt.id, tx);
          count++;
        });
      } catch (err) {
        logger.error({ err, apartmentId: apt.id, month }, 'Failed to charge subscription for apartment');
      }
    }

    logger.info({ month, count }, 'Generated subscription charges');
  } catch (err) {
    logger.error(err, 'Error generating subscriptions');
  }
}

/**
 * Generate child expenses for a single recurring parent expense.
 * Creates one child per month from recurringStartDate to now (or recurringEndDate),
 * splits each among occupied apartments. Idempotent — skips months that already
 * have a child expense.
 *
 * Can be called inside an existing transaction (from createExpense) or with
 * its own transactions (from the cron job).
 */
export async function generateChildExpenses(
  expense: typeof expenses.$inferSelect,
  userId: string | null,
  txOrDb?: TxOrDb,
): Promise<number> {
  if (!expense.recurringStartDate) return 0;

  const startDate = new Date(expense.recurringStartDate);
  const now = new Date();
  const endDate = expense.recurringEndDate
    ? new Date(Math.min(new Date(expense.recurringEndDate).getTime(), now.getTime()))
    : now;

  const months = generateMonthRange(startDate, endDate);
  let created = 0;

  for (const month of months) {
    const childDate = `${month}-01`;

    const runInTx = async (tx: TxOrDb) => {
      // Check if child expense already exists for this month
      const [existing] = await tx
        .select({ id: expenses.id })
        .from(expenses)
        .where(
          and(
            eq(expenses.parentExpenseId, expense.id),
            eq(expenses.expenseDate, childDate),
          ),
        )
        .limit(1);

      if (existing) return;

      // Create child expense
      const amount = parseFloat(expense.amount);
      const [child] = await tx
        .insert(expenses)
        .values({
          buildingId: expense.buildingId,
          description: expense.description,
          amount: expense.amount,
          expenseDate: childDate,
          category: expense.category,
          parentExpenseId: expense.id,
        })
        .returning();

      // Split among currently occupied regular apartments only
      const occupiedApartments = await tx
        .select()
        .from(apartments)
        .where(and(
          eq(apartments.buildingId, expense.buildingId),
          eq(apartments.status, 'occupied'),
          eq(apartments.apartmentType, 'regular'),
        ));

      if (occupiedApartments.length === 0) return;

      const count = occupiedApartments.length;
      const totalCents = Math.round(amount * 100);
      const baseCents = Math.floor(totalCents / count);
      const extraPennies = totalCents - baseCents * count;

      for (let i = 0; i < occupiedApartments.length; i++) {
        const apt = occupiedApartments[i];
        const aptShare = (baseCents + (i < extraPennies ? 1 : 0)) / 100;

        const [ae] = await tx
          .insert(apartmentExpenses)
          .values({
            apartmentId: apt.id,
            expenseId: child.id,
            amount: aptShare.toFixed(2),
          })
          .returning();

        await ledgerService.recordExpenseCharge(
          apt.id,
          ae.id,
          aptShare,
          expense.description || 'Recurring expense charge',
          userId as any,
          tx,
        );

        await ledgerService.refreshCachedBalance(apt.id, tx);
      }

      created++;
    };

    if (txOrDb) {
      // Run within the provided transaction
      await runInTx(txOrDb);
    } else {
      // Create own transaction per month (cron job mode)
      await db.transaction(async (tx) => {
        await runInTx(tx);
      });
    }
  }

  return created;
}

/**
 * Process recurring expenses: generate child expenses for each month
 * in the recurring range that doesn't already have one.
 * Runs alongside the subscription cron.
 */
async function processRecurringExpenses() {
  logger.info('Processing recurring expenses');

  try {
    const recurringExpenses = await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.isRecurring, true),
          isNull(expenses.parentExpenseId), // Only parent recurring expenses
        ),
      );

    let totalCreated = 0;
    for (const expense of recurringExpenses) {
      try {
        const created = await generateChildExpenses(expense, null);
        totalCreated += created;
      } catch (err) {
        logger.error({ err, expenseId: expense.id }, 'Failed to process recurring expense');
      }
    }

    logger.info({ created: totalCreated }, 'Processed recurring expenses');
  } catch (err) {
    logger.error(err, 'Error processing recurring expenses');
  }
}

export function startSubscriptionCron() {
  // Run at midnight on the 1st of each month
  cron.schedule('0 0 1 * *', async () => {
    await generateMonthlySubscriptions();
    await processRecurringExpenses();
  });
  logger.info('Subscription and recurring expense cron jobs scheduled for 1st of each month');
}

// Export for manual triggering (testing)
export { generateMonthlySubscriptions, processRecurringExpenses };
