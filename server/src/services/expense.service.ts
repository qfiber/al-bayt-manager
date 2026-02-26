import { db } from '../config/database.js';
import { expenses, apartmentExpenses, apartments, buildings, apartmentLedger, paymentAllocations } from '../db/schema/index.js';
import { eq, and, inArray, sql, gte, isNull } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as ledgerService from './ledger.service.js';
import * as occupancyPeriodService from './occupancy-period.service.js';
import { generateChildExpenses } from './subscription.service.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

type TxOrDb = NodePgDatabase<any> | typeof db;

export async function listExpenses(filters?: {
  buildingId?: string;
  allowedBuildingIds?: string[];
}) {
  let query = db
    .select({
      expense: expenses,
      buildingName: buildings.name,
    })
    .from(expenses)
    .innerJoin(buildings, eq(expenses.buildingId, buildings.id));

  // Always exclude auto-generated child expenses (they have a parentExpenseId)
  const conditions: any[] = [isNull(expenses.parentExpenseId)];
  if (filters?.buildingId) conditions.push(eq(expenses.buildingId, filters.buildingId));
  if (filters?.allowedBuildingIds?.length) {
    conditions.push(inArray(expenses.buildingId, filters.allowedBuildingIds));
  }

  query = query.where(and(...conditions)) as any;

  return query;
}

export async function getExpense(id: string) {
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!expense) throw new AppError(404, 'Expense not found');
  return expense;
}

export async function createExpense(data: {
  buildingId: string;
  description?: string;
  amount: number;
  expenseDate: string;
  category?: string;
  isRecurring?: boolean;
  recurringType?: string;
  recurringStartDate?: string;
  recurringEndDate?: string;
  parentExpenseId?: string;
  // If provided, expense is for a single apartment
  apartmentId?: string;
}, userId: string) {
  return await db.transaction(async (tx) => {
    // Verify building exists
    const [building] = await tx.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, data.buildingId)).limit(1);
    if (!building) throw new AppError(404, 'Building not found');

    // If single-apartment expense, verify apartment belongs to the building
    if (data.apartmentId) {
      const [apt] = await tx.select({ id: apartments.id, buildingId: apartments.buildingId }).from(apartments).where(eq(apartments.id, data.apartmentId)).limit(1);
      if (!apt) throw new AppError(404, 'Apartment not found');
      if (apt.buildingId !== data.buildingId) throw new AppError(400, 'Apartment does not belong to the specified building');
    }

    // Insert expense
    const [expense] = await tx
      .insert(expenses)
      .values({
        buildingId: data.buildingId,
        description: data.description,
        amount: data.amount.toFixed(2),
        expenseDate: data.expenseDate,
        category: data.category,
        isRecurring: data.isRecurring,
        recurringType: data.recurringType,
        recurringStartDate: data.recurringStartDate,
        recurringEndDate: data.recurringEndDate,
        parentExpenseId: data.parentExpenseId,
      })
      .returning();

    if (data.isRecurring) {
      // Recurring parent expense: do NOT split the parent itself.
      // Instead, immediately generate child expenses for all months up to now.
      await generateChildExpenses(expense, userId, tx);
    } else if (data.apartmentId) {
      // Single apartment expense
      const [ae] = await tx
        .insert(apartmentExpenses)
        .values({
          apartmentId: data.apartmentId,
          expenseId: expense.id,
          amount: data.amount.toFixed(2),
        })
        .returning();

      const periodId = await occupancyPeriodService.getActivePeriodId(data.apartmentId, tx);
      await ledgerService.recordExpenseCharge(
        data.apartmentId,
        ae.id,
        data.amount,
        data.description || 'Expense charge',
        userId,
        tx,
        periodId ?? undefined,
      );

      await ledgerService.refreshCachedBalance(data.apartmentId, tx);
    } else {
      // Building-wide expense: split among occupied regular apartments only
      const occupiedApartments = await tx
        .select()
        .from(apartments)
        .where(and(
          eq(apartments.buildingId, data.buildingId),
          eq(apartments.status, 'occupied'),
          eq(apartments.apartmentType, 'regular'),
        ));

      if (occupiedApartments.length === 0) {
        throw new AppError(400, 'No occupied apartments to split expense among');
      }

      const count = occupiedApartments.length;
      // Use floor for base share, then distribute remaining pennies
      const totalCents = Math.round(data.amount * 100);
      const baseCents = Math.floor(totalCents / count);
      const extraPennies = totalCents - baseCents * count; // 0..count-1

      for (let i = 0; i < occupiedApartments.length; i++) {
        const apt = occupiedApartments[i];
        // First N apartments get 1 extra penny to make sum exact
        const aptShare = (baseCents + (i < extraPennies ? 1 : 0)) / 100;

        const [ae] = await tx
          .insert(apartmentExpenses)
          .values({
            apartmentId: apt.id,
            expenseId: expense.id,
            amount: aptShare.toFixed(2),
          })
          .returning();

        const periodId = await occupancyPeriodService.getActivePeriodId(apt.id, tx);
        await ledgerService.recordExpenseCharge(
          apt.id,
          ae.id,
          aptShare,
          data.description || 'Expense charge (split)',
          userId,
          tx,
          periodId ?? undefined,
        );

        await ledgerService.refreshCachedBalance(apt.id, tx);
      }
    }

    return expense;
  });
}

export async function updateExpense(id: string, data: Partial<{
  description: string;
  amount: number;
  expenseDate: string;
  category: string;
}>) {
  // If amount is being changed, verify no splits exist yet (prevent ledger inconsistency)
  if (data.amount !== undefined) {
    const existingAEs = await db
      .select()
      .from(apartmentExpenses)
      .where(eq(apartmentExpenses.expenseId, id))
      .limit(1);

    if (existingAEs.length > 0) {
      throw new AppError(400, 'Cannot change amount on an expense that has already been split among apartments. Cancel and recreate instead.');
    }
  }

  const updateData: any = { updatedAt: new Date() };
  if (data.description !== undefined) updateData.description = data.description;
  if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2);
  if (data.expenseDate) updateData.expenseDate = data.expenseDate;
  if (data.category !== undefined) updateData.category = data.category;

  const [expense] = await db
    .update(expenses)
    .set(updateData)
    .where(eq(expenses.id, id))
    .returning();
  if (!expense) throw new AppError(404, 'Expense not found');
  return expense;
}

export async function deleteExpense(id: string, userId: string) {
  return await db.transaction(async (tx) => {
    // Fetch the expense first
    const [expense] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!expense) throw new AppError(404, 'Expense not found');

    // Find all apartment_expenses for this expense to reverse their ledger entries
    const aeList = await tx
      .select()
      .from(apartmentExpenses)
      .where(eq(apartmentExpenses.expenseId, id));

    // Create reversal credit entries for each apartment_expense (original was a debit)
    const affectedApartmentIds = new Set<string>();
    for (const ae of aeList) {
      if (!ae.isCanceled) {
        // Use the original entry's period, not the active period
        const periodId = await ledgerService.findEntryPeriodId(ae.apartmentId, 'expense', ae.id, tx);
        await ledgerService.recordReversal(
          ae.apartmentId,
          ae.id,
          parseFloat(ae.amount),
          'debit',
          `Reversal of expense charge ${ae.id} (expense deleted)`,
          userId,
          tx,
          periodId ?? undefined,
        );
        affectedApartmentIds.add(ae.apartmentId);
      }
    }

    // Delete (cascade will remove apartment_expenses)
    await tx.delete(expenses).where(eq(expenses.id, id));

    // Refresh cached balance for all affected apartments
    for (const aptId of affectedApartmentIds) {
      await ledgerService.refreshCachedBalance(aptId, tx);
    }

    return expense;
  });
}

export async function getApartmentExpenseById(id: string) {
  const [ae] = await db.select().from(apartmentExpenses).where(eq(apartmentExpenses.id, id)).limit(1);
  if (!ae) throw new AppError(404, 'Apartment expense not found');
  return ae;
}

export async function getApartmentExpenses(apartmentId: string) {
  const rows = await db
    .select({
      apartmentExpense: apartmentExpenses,
      expenseDescription: expenses.description,
      expenseCategory: expenses.category,
      expenseDate: expenses.expenseDate,
      expenseAmount: expenses.amount,
    })
    .from(apartmentExpenses)
    .innerJoin(expenses, eq(apartmentExpenses.expenseId, expenses.id))
    .where(eq(apartmentExpenses.apartmentId, apartmentId));

  // Flatten and compute remaining for frontend consumption
  const expenseItems = rows
    .map((row) => {
      const amount = parseFloat(row.apartmentExpense.amount);
      const amountPaid = parseFloat(row.apartmentExpense.amountPaid);
      return {
        id: row.apartmentExpense.id,
        apartmentId: row.apartmentExpense.apartmentId,
        expenseId: row.apartmentExpense.expenseId,
        amount,
        amountPaid,
        remaining: Math.max(0, amount - amountPaid),
        isCanceled: row.apartmentExpense.isCanceled,
        createdAt: row.apartmentExpense.createdAt,
        description: row.expenseDescription,
        category: row.expenseCategory,
        expenseDate: row.expenseDate,
        expenseAmount: row.expenseAmount,
        isSubscription: false,
      };
    })
    .filter((item) => !item.isCanceled && item.remaining > 0);

  // Also fetch subscription ledger entries for this apartment
  const subscriptionEntries = await db
    .select()
    .from(apartmentLedger)
    .where(
      and(
        eq(apartmentLedger.apartmentId, apartmentId),
        eq(apartmentLedger.entryType, 'debit'),
        eq(apartmentLedger.referenceType, 'subscription'),
      ),
    );

  // Compute amountPaid for each subscription entry from payment_allocations
  const subscriptionItems: typeof expenseItems = [];
  for (const entry of subscriptionEntries) {
    const amount = parseFloat(entry.amount);

    const [allocSum] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${paymentAllocations.amountAllocated}::numeric), 0)`,
      })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.ledgerEntryId, entry.id));

    const amountPaid = parseFloat(allocSum.total);
    const remaining = Math.max(0, amount - amountPaid);

    if (remaining <= 0) continue; // Skip fully paid subscriptions

    subscriptionItems.push({
      id: entry.id,
      apartmentId: entry.apartmentId,
      expenseId: null as any,
      amount,
      amountPaid,
      remaining,
      isCanceled: false,
      createdAt: entry.createdAt,
      description: entry.description || 'Subscription',
      category: null as any,
      expenseDate: null as any,
      expenseAmount: null as any,
      isSubscription: true,
    });
  }

  // Sort: subscriptions first (by date), then expenses (by date)
  const sorted = [
    ...subscriptionItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    ...expenseItems.sort((a, b) => {
      const dateA = a.expenseDate || '';
      const dateB = b.expenseDate || '';
      return dateA.localeCompare(dateB);
    }),
  ];

  return sorted;
}

export async function cancelApartmentExpense(id: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [ae] = await tx.select().from(apartmentExpenses).where(eq(apartmentExpenses.id, id)).limit(1);
    if (!ae) throw new AppError(404, 'Apartment expense not found');
    if (ae.isCanceled) throw new AppError(400, 'Already canceled');

    await tx.update(apartmentExpenses).set({ isCanceled: true }).where(eq(apartmentExpenses.id, id));

    // Use the original entry's period, not the active period
    const periodId = await ledgerService.findEntryPeriodId(ae.apartmentId, 'expense', ae.id, tx);

    // Reversal: the original was a debit, so reversal is a credit
    await ledgerService.recordReversal(
      ae.apartmentId,
      ae.id,
      parseFloat(ae.amount),
      'debit',
      `Reversal of expense charge ${ae.id}`,
      userId,
      tx,
      periodId ?? undefined,
    );

    await ledgerService.refreshCachedBalance(ae.apartmentId, tx);

    return { success: true };
  });
}

export async function waiveApartmentExpense(id: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [ae] = await tx.select().from(apartmentExpenses).where(eq(apartmentExpenses.id, id)).limit(1);
    if (!ae) throw new AppError(404, 'Apartment expense not found');
    if (ae.isCanceled) throw new AppError(400, 'Cannot waive a canceled expense');

    const outstanding = parseFloat(ae.amount) - parseFloat(ae.amountPaid);
    if (outstanding <= 0) throw new AppError(400, 'Nothing to waive');

    // Mark fully paid
    await tx
      .update(apartmentExpenses)
      .set({ amountPaid: ae.amount })
      .where(eq(apartmentExpenses.id, id));

    // Use the original expense entry's period, not the active period
    const periodId = await ledgerService.findEntryPeriodId(ae.apartmentId, 'expense', ae.id, tx);

    // Create waiver credit entry
    await ledgerService.recordWaiver(
      ae.apartmentId,
      outstanding,
      `Waiver for expense ${ae.id}`,
      userId,
      tx,
      periodId ?? undefined,
    );

    await ledgerService.refreshCachedBalance(ae.apartmentId, tx);

    return { success: true };
  });
}

/**
 * Get the number of days an apartment was occupied during a given expense's month.
 * Returns 0 if the apartment wasn't occupied during that month.
 */
function getOccupiedDays(occupancyStart: Date, expenseDate: string): { days: number; daysInMonth: number } {
  // Parse expense date to get the month
  const [year, month] = expenseDate.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const occYear = occupancyStart.getUTCFullYear();
  const occMonth = occupancyStart.getUTCMonth() + 1; // 1-based
  const occDay = occupancyStart.getUTCDate();

  // If occupancy started before or at the start of this expense month → full month
  if (occYear < year || (occYear === year && occMonth < month)) {
    return { days: daysInMonth, daysInMonth };
  }

  // If occupancy started in the same month → partial (remaining days)
  if (occYear === year && occMonth === month) {
    const remainingDays = daysInMonth - occDay + 1;
    return { days: Math.max(0, remainingDays), daysInMonth };
  }

  // Occupancy started after this expense month → 0 days
  return { days: 0, daysInMonth };
}

/**
 * Retroactively charge an apartment for building-wide expenses that occurred
 * since its occupancy start date.
 *
 * The new tenant pays their prorated equal share:
 *   perTenantShare = totalExpense / numberOfTenants
 *   newTenantCharge = perTenantShare × (occupiedDays / daysInMonth)
 *
 * Existing tenants' shares are NOT changed — they already paid their
 * full-month share when the expense was originally created.
 */
export async function backfillExpensesForApartment(
  apartmentId: string,
  buildingId: string,
  occupancyStart: Date,
  userId: string,
  tx: TxOrDb,
) {
  // Only regular apartments participate in expense splitting
  const [apt] = await tx.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (apt && apt.apartmentType !== 'regular') return;

  // Look up active period ID to tag ledger entries
  const activePeriodId = await occupancyPeriodService.getActivePeriodId(apartmentId, tx);

  const occupancyDateStr = occupancyStart.toISOString().split('T')[0]; // YYYY-MM-DD
  // Also include expenses in the same month as occupancy start (even if expense date is before occupancy day)
  const occupancyMonthStr = occupancyDateStr.slice(0, 7) + '-01'; // First day of occupancy month

  // Find all building-wide expenses since the start of the occupancy month
  const buildingExpenses = await tx
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.buildingId, buildingId),
        gte(expenses.expenseDate, occupancyMonthStr),
      ),
    );

  for (const expense of buildingExpenses) {
    // Skip recurring template parents — they don't have apartment_expenses
    if (expense.isRecurring) continue;

    // Check if this apartment already has an apartment_expense for this expense
    const [existing] = await tx
      .select({ id: apartmentExpenses.id })
      .from(apartmentExpenses)
      .where(
        and(
          eq(apartmentExpenses.apartmentId, apartmentId),
          eq(apartmentExpenses.expenseId, expense.id),
        ),
      )
      .limit(1);

    if (existing) continue; // Already charged — idempotent skip

    // Count existing non-canceled splits to determine per-tenant share
    const existingSplits = await tx
      .select({ id: apartmentExpenses.id, amount: apartmentExpenses.amount })
      .from(apartmentExpenses)
      .where(
        and(
          eq(apartmentExpenses.expenseId, expense.id),
          eq(apartmentExpenses.isCanceled, false),
        ),
      );

    // If no existing splits, skip
    if (existingSplits.length === 0) continue;

    // If there's exactly 1 split whose amount matches the total expense amount,
    // this was a single-apartment expense — not a building-wide split. Skip it.
    const totalAmount = parseFloat(expense.amount);
    if (existingSplits.length === 1) {
      const splitAmount = parseFloat(existingSplits[0].amount);
      if (Math.abs(splitAmount - totalAmount) < 0.01) continue;
    }

    // Check if the new apartment was occupied during this expense's month
    const newAptOccupied = getOccupiedDays(occupancyStart, expense.expenseDate);
    if (newAptOccupied.days <= 0) continue;

    // Per-tenant share = total / number of tenants (including the new one)
    const tenantCount = existingSplits.length + 1;
    const perTenantShare = totalAmount / tenantCount;

    // Prorate for occupied days in the month
    const proratedAmount = Math.round(perTenantShare * newAptOccupied.days / newAptOccupied.daysInMonth * 100) / 100;

    if (proratedAmount <= 0) continue;

    const [ae] = await tx
      .insert(apartmentExpenses)
      .values({
        apartmentId,
        expenseId: expense.id,
        amount: proratedAmount.toFixed(2),
      })
      .returning();

    await ledgerService.recordExpenseCharge(
      apartmentId,
      ae.id,
      proratedAmount,
      expense.description || 'Retroactive expense charge (prorated)',
      userId,
      tx,
      activePeriodId ?? undefined,
    );
  }

  // Refresh cached balance for the new apartment
  await ledgerService.refreshCachedBalance(apartmentId, tx);
}
