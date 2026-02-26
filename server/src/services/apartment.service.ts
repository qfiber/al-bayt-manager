import { db } from '../config/database.js';
import {
  apartments, buildings, profiles, apartmentExpenses, payments,
  apartmentLedger, userApartments, expenses, paymentAllocations,
} from '../db/schema/index.js';
import { eq, and, inArray, sql, desc, gte, lte } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as ledgerService from './ledger.service.js';
import * as occupancyPeriodService from './occupancy-period.service.js';
import { backfillSubscriptions } from './subscription.service.js';
import { backfillExpensesForApartment } from './expense.service.js';

/**
 * Helper: look up a profile name by ID.
 */
async function getProfileName(profileId: string | null, txOrDb: any = db): Promise<string | null> {
  if (!profileId) return null;
  const [profile] = await txOrDb.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  return profile?.name ?? null;
}

export async function listApartments(buildingId?: string, allowedBuildingIds?: string[]) {
  let query = db
    .select({
      apartment: apartments,
      buildingName: buildings.name,
      ownerName: sql<string | null>`owner_profile.name`,
      beneficiaryName: sql<string | null>`beneficiary_profile.name`,
    })
    .from(apartments)
    .innerJoin(buildings, eq(apartments.buildingId, buildings.id))
    .leftJoin(
      sql`${profiles} AS owner_profile`,
      sql`${apartments.ownerId} = owner_profile.id`,
    )
    .leftJoin(
      sql`${profiles} AS beneficiary_profile`,
      sql`${apartments.beneficiaryId} = beneficiary_profile.id`,
    );

  const conditions: any[] = [];
  if (buildingId) conditions.push(eq(apartments.buildingId, buildingId));
  if (allowedBuildingIds && allowedBuildingIds.length > 0) {
    conditions.push(inArray(apartments.buildingId, allowedBuildingIds));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query;
}

export async function getApartment(id: string) {
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, id)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');
  return apt;
}

export async function createApartment(data: {
  apartmentNumber: string;
  floor?: number;
  buildingId: string;
  status?: string;
  subscriptionAmount?: string;
  subscriptionStatus?: string;
  ownerId?: string;
  beneficiaryId?: string;
  occupancyStart?: Date;
  apartmentType?: string;
  parentApartmentId?: string | null;
}, userId: string) {
  return await db.transaction(async (tx) => {
    // Verify building exists
    const [building] = await tx.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, data.buildingId)).limit(1);
    if (!building) throw new AppError(404, 'Building not found');

    // Validate apartment type and parent relationship
    const aptType = data.apartmentType || 'regular';
    if (aptType === 'storage' || aptType === 'parking') {
      if (!data.parentApartmentId) {
        throw new AppError(400, 'Parent apartment is required for storage/parking units');
      }
      const [parent] = await tx.select().from(apartments).where(eq(apartments.id, data.parentApartmentId)).limit(1);
      if (!parent) throw new AppError(404, 'Parent apartment not found');
      if (parent.apartmentType !== 'regular') throw new AppError(400, 'Parent apartment must be a regular apartment');
      if (parent.buildingId !== data.buildingId) throw new AppError(400, 'Parent apartment must be in the same building');
    } else {
      // Regular apartments cannot have a parent
      data.parentApartmentId = undefined;
    }

    const [apt] = await tx.insert(apartments).values({
      ...data,
      apartmentType: aptType,
      parentApartmentId: data.parentApartmentId || null,
      cachedBalance: '0',
    }).returning();

    // Create occupancy period if apartment is occupied
    if (apt.status === 'occupied' && apt.occupancyStart) {
      const tenantName = await getProfileName(apt.ownerId, tx);
      await occupancyPeriodService.createPeriod(
        apt.id,
        apt.ownerId,
        tenantName,
        new Date(apt.occupancyStart),
        tx,
      );
    }

    // Backfill subscriptions and expenses if apartment is occupied with a past date
    if (apt.status === 'occupied' && apt.occupancyStart) {
      await backfillSubscriptions(apt.id, tx);
      // Only backfill expenses for regular apartments
      if (apt.apartmentType === 'regular') {
        await backfillExpensesForApartment(apt.id, apt.buildingId, new Date(apt.occupancyStart), userId, tx);
      }
    }

    return apt;
  });
}

export async function updateApartment(id: string, data: Partial<{
  apartmentNumber: string;
  floor: number;
  status: string;
  subscriptionAmount: string;
  subscriptionStatus: string;
  ownerId: string | null;
  beneficiaryId: string | null;
  occupancyStart: Date | null;
  apartmentType: string;
  parentApartmentId: string | null;
}>, userId: string) {
  return await db.transaction(async (tx) => {
    // Fetch old state before update
    const [oldApt] = await tx.select().from(apartments).where(eq(apartments.id, id)).limit(1);
    if (!oldApt) throw new AppError(404, 'Apartment not found');

    // Validate apartment type and parent relationship if changing
    const aptType = data.apartmentType ?? oldApt.apartmentType;
    if (aptType === 'storage' || aptType === 'parking') {
      const parentId = data.parentApartmentId !== undefined ? data.parentApartmentId : oldApt.parentApartmentId;
      if (!parentId) {
        throw new AppError(400, 'Parent apartment is required for storage/parking units');
      }
      const [parent] = await tx.select().from(apartments).where(eq(apartments.id, parentId)).limit(1);
      if (!parent) throw new AppError(404, 'Parent apartment not found');
      if (parent.apartmentType !== 'regular') throw new AppError(400, 'Parent apartment must be a regular apartment');
      if (parent.buildingId !== oldApt.buildingId) throw new AppError(400, 'Parent apartment must be in the same building');
    } else if (data.apartmentType === 'regular') {
      // If changing to regular, clear parent
      data.parentApartmentId = null;
    }

    const [apt] = await tx
      .update(apartments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(apartments.id, id))
      .returning();

    // Trigger backfills if apartment transitioned to occupied
    const wasOccupied = oldApt.status === 'occupied';
    const isNowOccupied = apt.status === 'occupied';

    if (!wasOccupied && isNowOccupied && apt.occupancyStart) {
      // Create a new occupancy period
      const tenantName = await getProfileName(apt.ownerId, tx);
      await occupancyPeriodService.createPeriod(
        apt.id,
        apt.ownerId,
        tenantName,
        new Date(apt.occupancyStart),
        tx,
      );

      await backfillSubscriptions(apt.id, tx);
      // Only backfill expenses for regular apartments
      if (apt.apartmentType === 'regular') {
        await backfillExpensesForApartment(apt.id, apt.buildingId, new Date(apt.occupancyStart), userId, tx);
      }
    }

    return apt;
  });
}

export async function deleteApartment(id: string) {
  // Fetch first to check guards
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, id)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  if (apt.status === 'occupied') {
    throw new AppError(400, 'Cannot delete an occupied apartment. Terminate occupancy first.');
  }

  // Use real-time balance, not cached, to ensure accuracy
  const balance = await ledgerService.getBalance(id);
  if (balance !== 0) {
    throw new AppError(400, `Cannot delete apartment with non-zero balance (₪${balance.toFixed(2)}). Settle outstanding balance first.`);
  }

  // Check for linked child apartments (storage/parking)
  const children = await db.select({ id: apartments.id }).from(apartments)
    .where(eq(apartments.parentApartmentId, id)).limit(1);
  if (children.length > 0) {
    throw new AppError(400, 'Cannot delete apartment with linked storage/parking units. Delete child units first.');
  }

  const [deleted] = await db.delete(apartments).where(eq(apartments.id, id)).returning();
  return deleted;
}

export async function terminateOccupancy(id: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [apt] = await tx.select().from(apartments).where(eq(apartments.id, id)).limit(1);
    if (!apt) throw new AppError(404, 'Apartment not found');
    if (apt.status !== 'occupied') throw new AppError(400, 'Apartment is not occupied');

    // Determine where prorated credit goes (parent's ledger for child units)
    const isChild = apt.apartmentType !== 'regular' && !!apt.parentApartmentId;
    const creditTargetId = isChild ? apt.parentApartmentId! : id;

    // Get the active period ID for tagging the occupancy credit
    const activePeriodId = await occupancyPeriodService.getActivePeriodId(creditTargetId, tx);

    // Calculate prorated credit for remaining days of the month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = daysInMonth - now.getDate() + 1;
    const subscriptionAmount = parseFloat(apt.subscriptionAmount || '0');

    if (subscriptionAmount > 0 && remainingDays > 0) {
      const dailyRate = subscriptionAmount / daysInMonth;
      const proratedCredit = Math.round(dailyRate * remainingDays * 100) / 100;

      if (proratedCredit > 0) {
        await ledgerService.recordOccupancyCredit(creditTargetId, proratedCredit, userId, tx, activePeriodId ?? undefined);
      }
    }

    // Process child apartments BEFORE closing parent period so child credits
    // are included in the parent's closing balance snapshot
    if (apt.apartmentType === 'regular') {
      const children = await tx.select().from(apartments)
        .where(and(eq(apartments.parentApartmentId, id), eq(apartments.status, 'occupied')));

      for (const child of children) {
        const childSubAmount = parseFloat(child.subscriptionAmount || '0');
        if (childSubAmount > 0 && remainingDays > 0) {
          const childDailyRate = childSubAmount / daysInMonth;
          const childCredit = Math.round(childDailyRate * remainingDays * 100) / 100;
          if (childCredit > 0) {
            // Child's prorated credit goes to parent's ledger, tagged with parent's period
            await ledgerService.recordOccupancyCredit(id, childCredit, userId, tx, activePeriodId ?? undefined);
          }
        }

        // Close the child's active occupancy period
        await occupancyPeriodService.closePeriod(child.id, tx);

        await tx.update(apartments).set({
          status: 'vacant',
          ownerId: null,
          beneficiaryId: null,
          occupancyStart: null,
          updatedAt: new Date(),
        }).where(eq(apartments.id, child.id));

        await tx.delete(userApartments).where(eq(userApartments.apartmentId, child.id));
      }
    }

    // Close the parent's period AFTER all child credits are recorded
    await occupancyPeriodService.closePeriod(id, tx);

    // Update apartment status
    const [updated] = await tx
      .update(apartments)
      .set({
        status: 'vacant',
        ownerId: null,
        beneficiaryId: null,
        occupancyStart: null,
        updatedAt: new Date(),
      })
      .where(eq(apartments.id, id))
      .returning();

    // Remove user-apartment assignments
    await tx.delete(userApartments).where(eq(userApartments.apartmentId, id));

    await ledgerService.refreshCachedBalance(creditTargetId, tx);
    // Also refresh the child's own balance if it's a child
    if (isChild) {
      await ledgerService.refreshCachedBalance(id, tx);
    }

    return updated;
  });
}

export async function getDebtDetails(apartmentId: string, periodId?: string) {
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  // Resolve period and its date range
  let resolvedPeriodId: string | undefined;
  let periodStartDate: Date | undefined;
  let periodEndDate: Date | undefined;

  if (periodId === 'current' || !periodId) {
    const activePeriod = await occupancyPeriodService.getActivePeriod(apartmentId);
    resolvedPeriodId = activePeriod?.id;
    periodStartDate = activePeriod?.startDate ? new Date(activePeriod.startDate) : undefined;
    periodEndDate = activePeriod?.endDate ? new Date(activePeriod.endDate) : undefined;
  } else if (periodId === 'all') {
    resolvedPeriodId = undefined;
  } else {
    // Specific period UUID — validate it belongs to this apartment
    const periods = await occupancyPeriodService.getPeriodsForApartment(apartmentId);
    const period = periods.find(p => p.id === periodId);
    if (!period) throw new AppError(404, 'Period not found for this apartment');
    resolvedPeriodId = period.id;
    periodStartDate = new Date(period.startDate);
    periodEndDate = period.endDate ? new Date(period.endDate) : undefined;
  }

  // Build conditions for expenses and payments, scoped by period date range
  const expenseConditions: any[] = [eq(apartmentExpenses.apartmentId, apartmentId), eq(apartmentExpenses.isCanceled, false)];
  const paymentConditions: any[] = [eq(payments.apartmentId, apartmentId), eq(payments.isCanceled, false)];

  if (periodStartDate) {
    expenseConditions.push(gte(apartmentExpenses.createdAt, periodStartDate));
    paymentConditions.push(gte(payments.createdAt, periodStartDate));
  }
  if (periodEndDate) {
    expenseConditions.push(lte(apartmentExpenses.createdAt, periodEndDate));
    paymentConditions.push(lte(payments.createdAt, periodEndDate));
  }

  const expenseRows = await db
    .select({
      id: apartmentExpenses.id,
      apartmentId: apartmentExpenses.apartmentId,
      expenseId: apartmentExpenses.expenseId,
      amount: apartmentExpenses.amount,
      amountPaid: apartmentExpenses.amountPaid,
      isCanceled: apartmentExpenses.isCanceled,
      createdAt: apartmentExpenses.createdAt,
      description: expenses.description,
      category: expenses.category,
      expenseDate: expenses.expenseDate,
    })
    .from(apartmentExpenses)
    .innerJoin(expenses, eq(apartmentExpenses.expenseId, expenses.id))
    .where(and(...expenseConditions));

  const aptPayments = await db
    .select()
    .from(payments)
    .where(and(...paymentConditions));

  // Ledger: filter by period ID
  const ledgerConditions: any[] = [eq(apartmentLedger.apartmentId, apartmentId)];
  if (resolvedPeriodId) {
    ledgerConditions.push(eq(apartmentLedger.occupancyPeriodId, resolvedPeriodId));
  }

  const ledger = await db
    .select()
    .from(apartmentLedger)
    .where(and(...ledgerConditions))
    .orderBy(desc(apartmentLedger.createdAt));

  const balance = resolvedPeriodId
    ? await ledgerService.getBalance(apartmentId, db, resolvedPeriodId)
    : await ledgerService.getBalance(apartmentId);

  // Compute subscription allocation totals per ledger entry
  const subscriptionDebits = ledger.filter(e => e.referenceType === 'subscription' && e.entryType === 'debit');
  const subscriptionAllocations: Record<string, number> = {};
  if (subscriptionDebits.length > 0) {
    const allocRows = await db
      .select({
        ledgerEntryId: paymentAllocations.ledgerEntryId,
        total: sql<string>`COALESCE(SUM(${paymentAllocations.amountAllocated}::numeric), 0)`,
      })
      .from(paymentAllocations)
      .where(inArray(paymentAllocations.ledgerEntryId, subscriptionDebits.map(e => e.id)))
      .groupBy(paymentAllocations.ledgerEntryId);

    for (const row of allocRows) {
      if (row.ledgerEntryId) {
        subscriptionAllocations[row.ledgerEntryId] = parseFloat(row.total);
      }
    }
  }

  return {
    apartment: apt,
    balance,
    expenses: expenseRows,
    payments: aptPayments,
    ledger,
    periodId: resolvedPeriodId || null,
    subscriptionAllocations,
  };
}

export async function getApartmentLedger(apartmentId: string, limit: number = 50, offset: number = 0, periodId?: string) {
  return ledgerService.getLedger(apartmentId, { limit, offset, periodId });
}

/**
 * Get all occupancy periods for an apartment.
 */
export async function getApartmentPeriods(apartmentId: string) {
  return occupancyPeriodService.getPeriodsForApartment(apartmentId);
}

/**
 * Write off the remaining balance of an apartment (creates a waiver credit/debit
 * to bring the balance to zero). Works for both debt (negative balance → credit waiver)
 * and overpayment (positive balance → debit adjustment).
 */
export async function writeOffBalance(id: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [apt] = await tx.select().from(apartments).where(eq(apartments.id, id)).limit(1);
    if (!apt) throw new AppError(404, 'Apartment not found');

    const balance = await ledgerService.getBalance(id, tx);
    if (balance === 0) throw new AppError(400, 'Balance is already zero');

    const periodId = await occupancyPeriodService.getActivePeriodId(id, tx);

    if (balance < 0) {
      // Debt: create a credit waiver to zero it out
      await ledgerService.recordWaiver(
        id,
        Math.abs(balance),
        'Balance write-off (debt cleared)',
        userId,
        tx,
        periodId ?? undefined,
      );
    } else {
      // Overpayment: create a debit adjustment to zero it out
      await ledgerService.recordDebitAdjustment(
        id,
        balance,
        'Balance write-off (overpayment cleared)',
        userId,
        tx,
        periodId ?? undefined,
      );
    }

    await ledgerService.refreshCachedBalance(id, tx);
    return { success: true, previousBalance: balance };
  });
}

/**
 * Check if a user is assigned to an apartment (via user_apartments).
 */
export async function userOwnsApartment(userId: string, apartmentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userApartments.id })
    .from(userApartments)
    .where(and(eq(userApartments.userId, userId), eq(userApartments.apartmentId, apartmentId)))
    .limit(1);
  return !!row;
}

/**
 * Get apartments for a specific user (via user_apartments).
 */
export async function getMyApartments(userId: string) {
  return db
    .select({
      apartment: apartments,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
    })
    .from(userApartments)
    .innerJoin(apartments, eq(userApartments.apartmentId, apartments.id))
    .innerJoin(buildings, eq(apartments.buildingId, buildings.id))
    .where(eq(userApartments.userId, userId));
}

export async function getPaymentHistory(apartmentId: string, limit: number = 50, offset: number = 0) {
  const { receipts } = await import('../db/schema/index.js');

  const result = await db
    .select({
      payment: payments,
      receiptId: receipts.id,
      receiptNumber: receipts.receiptNumber,
    })
    .from(payments)
    .leftJoin(receipts, eq(payments.id, receipts.paymentId))
    .where(eq(payments.apartmentId, apartmentId))
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(offset);

  return result;
}

export async function getUpcomingCharges(apartmentId: string) {
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  const subscriptionAmount = parseFloat(apt.subscriptionAmount || '0');

  // Find pending unpaid expenses
  const pendingExpenses = await db
    .select({
      id: apartmentExpenses.id,
      amount: apartmentExpenses.amount,
      amountPaid: apartmentExpenses.amountPaid,
      description: expenses.description,
    })
    .from(apartmentExpenses)
    .innerJoin(expenses, eq(apartmentExpenses.expenseId, expenses.id))
    .where(
      and(
        eq(apartmentExpenses.apartmentId, apartmentId),
        eq(apartmentExpenses.isCanceled, false),
        sql`${apartmentExpenses.amount}::numeric > ${apartmentExpenses.amountPaid}::numeric`,
      ),
    );

  const pendingTotal = pendingExpenses.reduce(
    (sum, e) => sum + (parseFloat(e.amount) - parseFloat(e.amountPaid)),
    0,
  );

  return {
    subscriptionAmount,
    pendingExpenses: pendingExpenses.map(e => ({
      id: e.id,
      description: e.description || 'Building expense',
      remaining: Math.round((parseFloat(e.amount) - parseFloat(e.amountPaid)) * 100) / 100,
    })),
    totalUpcoming: Math.round((subscriptionAmount + pendingTotal) * 100) / 100,
  };
}
