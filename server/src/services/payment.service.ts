import { db } from '../config/database.js';
import { payments, paymentAllocations, apartmentExpenses, apartmentLedger } from '../db/schema/index.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as ledgerService from './ledger.service.js';
import * as occupancyPeriodService from './occupancy-period.service.js';
import * as receiptService from './receipt.service.js';
import { apartments, buildings } from '../db/schema/index.js';

export async function listPayments(filters?: {
  buildingId?: string;
  apartmentId?: string;
  allowedBuildingIds?: string[];
}) {
  let query = db
    .select({
      payment: payments,
      apartmentNumber: apartments.apartmentNumber,
      buildingName: buildings.name,
      buildingId: buildings.id,
    })
    .from(payments)
    .innerJoin(apartments, eq(payments.apartmentId, apartments.id))
    .innerJoin(buildings, eq(apartments.buildingId, buildings.id));

  const conditions: any[] = [];
  if (filters?.buildingId) conditions.push(eq(apartments.buildingId, filters.buildingId));
  if (filters?.apartmentId) conditions.push(eq(payments.apartmentId, filters.apartmentId));
  if (filters?.allowedBuildingIds?.length) {
    conditions.push(inArray(apartments.buildingId, filters.allowedBuildingIds));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return query;
}

export async function getPayment(id: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!payment) throw new AppError(404, 'Payment not found');
  return payment;
}

export async function createPayment(data: {
  apartmentId: string;
  month: string;
  amount: number;
  allocations?: { apartmentExpenseId: string; amountAllocated: number }[];
  subscriptionAllocations?: { ledgerEntryId: string; amountAllocated: number }[];
}, userId: string) {
  return await db.transaction(async (tx) => {
    // Verify apartment exists
    const [apt] = await tx.select({ id: apartments.id, buildingId: apartments.buildingId }).from(apartments).where(eq(apartments.id, data.apartmentId)).limit(1);
    if (!apt) throw new AppError(404, 'Apartment not found');

    // Insert payment
    const [payment] = await tx
      .insert(payments)
      .values({
        apartmentId: data.apartmentId,
        month: data.month,
        amount: data.amount.toFixed(2),
      })
      .returning();

    // Create credit ledger entry
    const periodId = await occupancyPeriodService.getActivePeriodId(data.apartmentId, tx);
    await ledgerService.recordPayment(data.apartmentId, payment.id, data.amount, userId, tx, periodId ?? undefined);

    // Validate total allocations (expense + subscription) do not exceed payment amount
    const expenseAllocTotal = (data.allocations || []).reduce((sum, a) => sum + a.amountAllocated, 0);
    const subAllocTotal = (data.subscriptionAllocations || []).reduce((sum, a) => sum + a.amountAllocated, 0);
    const totalAllocated = expenseAllocTotal + subAllocTotal;
    if (totalAllocated > data.amount + 0.01) {
      throw new AppError(400, 'Total allocations exceed payment amount');
    }

    // Handle expense allocations
    if (data.allocations?.length) {
      for (const alloc of data.allocations) {
        const [ae] = await tx.select().from(apartmentExpenses).where(eq(apartmentExpenses.id, alloc.apartmentExpenseId)).limit(1);
        if (!ae) throw new AppError(400, `Apartment expense ${alloc.apartmentExpenseId} not found`);
        if (ae.apartmentId !== data.apartmentId) throw new AppError(400, `Allocation expense does not belong to the payment apartment`);
        if (ae.isCanceled) throw new AppError(400, `Apartment expense ${alloc.apartmentExpenseId} is canceled`);
        const remaining = parseFloat(ae.amount) - parseFloat(ae.amountPaid);
        if (alloc.amountAllocated > remaining + 0.01) {
          throw new AppError(400, `Allocation exceeds remaining balance for expense ${alloc.apartmentExpenseId}`);
        }

        await tx.insert(paymentAllocations).values({
          paymentId: payment.id,
          apartmentExpenseId: alloc.apartmentExpenseId,
          amountAllocated: alloc.amountAllocated.toFixed(2),
        });

        // Update amount_paid on apartment_expense
        await tx
          .update(apartmentExpenses)
          .set({
            amountPaid: sql`${apartmentExpenses.amountPaid}::numeric + ${alloc.amountAllocated}`,
          })
          .where(eq(apartmentExpenses.id, alloc.apartmentExpenseId));
      }
    }

    // Handle subscription allocations
    if (data.subscriptionAllocations?.length) {
      for (const alloc of data.subscriptionAllocations) {
        // Validate: ledger entry exists, is a subscription debit for the correct apartment
        const [entry] = await tx.select().from(apartmentLedger).where(eq(apartmentLedger.id, alloc.ledgerEntryId)).limit(1);
        if (!entry) throw new AppError(400, `Ledger entry ${alloc.ledgerEntryId} not found`);
        if (entry.apartmentId !== data.apartmentId) throw new AppError(400, `Subscription entry does not belong to the payment apartment`);
        if (entry.referenceType !== 'subscription' || entry.entryType !== 'debit') {
          throw new AppError(400, `Ledger entry ${alloc.ledgerEntryId} is not a subscription debit`);
        }

        // Check allocation doesn't exceed remaining
        const [allocSum] = await tx
          .select({
            total: sql<string>`COALESCE(SUM(${paymentAllocations.amountAllocated}::numeric), 0)`,
          })
          .from(paymentAllocations)
          .where(eq(paymentAllocations.ledgerEntryId, alloc.ledgerEntryId));

        const alreadyPaid = parseFloat(allocSum.total);
        const entryAmount = parseFloat(entry.amount);
        const remaining = entryAmount - alreadyPaid;
        if (alloc.amountAllocated > remaining + 0.01) {
          throw new AppError(400, `Allocation exceeds remaining balance for subscription entry ${alloc.ledgerEntryId}`);
        }

        await tx.insert(paymentAllocations).values({
          paymentId: payment.id,
          ledgerEntryId: alloc.ledgerEntryId,
          amountAllocated: alloc.amountAllocated.toFixed(2),
        });
      }
    }

    await ledgerService.refreshCachedBalance(data.apartmentId, tx);

    // Auto-create receipt
    await receiptService.createReceipt(payment.id, data.apartmentId, apt.buildingId, data.amount, tx);

    return payment;
  });
}

export async function updatePayment(id: string, data: { month?: string; amount?: number }, userId: string) {
  return await db.transaction(async (tx) => {
    // Fetch the current payment
    const [existing] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'Payment not found');
    if (existing.isCanceled) throw new AppError(400, 'Cannot update a canceled payment');

    // If amount is changing, block when new amount is below total already-allocated
    if (data.amount !== undefined && data.amount !== parseFloat(existing.amount)) {
      const [allocSum] = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${paymentAllocations.amountAllocated}::numeric), 0)`,
        })
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, id));

      const totalAllocated = parseFloat(allocSum.total);
      if (totalAllocated > 0 && data.amount < totalAllocated) {
        throw new AppError(400, `Cannot reduce payment below total allocated amount (₪${totalAllocated.toFixed(2)}). Cancel allocations first.`);
      }
    }

    const oldAmount = parseFloat(existing.amount);
    const newAmount = data.amount !== undefined ? data.amount : oldAmount;

    const updateData: any = { updatedAt: new Date() };
    if (data.month) updateData.month = data.month;
    if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2);

    const [payment] = await tx
      .update(payments)
      .set(updateData)
      .where(eq(payments.id, id))
      .returning();

    // If amount changed, reverse old ledger entry and create new one
    if (data.amount !== undefined && data.amount !== oldAmount) {
      // Use the original payment entry's period, not the active period
      const periodId = await ledgerService.findEntryPeriodId(existing.apartmentId, 'payment', existing.id, tx);
      // Reverse old credit
      await ledgerService.recordReversal(
        existing.apartmentId,
        existing.id,
        oldAmount,
        'credit',
        `Reversal of payment ${existing.id} (amount update)`,
        userId,
        tx,
        periodId ?? undefined,
      );

      // Record new credit in the same period as the original
      await ledgerService.recordPayment(
        existing.apartmentId,
        existing.id,
        newAmount,
        userId,
        tx,
        periodId ?? undefined,
      );

      await ledgerService.refreshCachedBalance(existing.apartmentId, tx);
    }

    return payment;
  });
}

export async function cancelPayment(id: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) throw new AppError(404, 'Payment not found');
    if (payment.isCanceled) throw new AppError(400, 'Payment already canceled');

    // Mark as canceled
    await tx.update(payments).set({ isCanceled: true, updatedAt: new Date() }).where(eq(payments.id, id));

    // Reverse allocations
    const allocs = await tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, id));

    for (const alloc of allocs) {
      if (alloc.apartmentExpenseId) {
        // Expense allocation — reverse amountPaid on apartment_expense
        await tx
          .update(apartmentExpenses)
          .set({
            amountPaid: sql`GREATEST(${apartmentExpenses.amountPaid}::numeric - ${parseFloat(alloc.amountAllocated)}, 0)`,
          })
          .where(eq(apartmentExpenses.id, alloc.apartmentExpenseId));
      }
      // Subscription allocations: no amountPaid column to reverse — just delete the allocation row
    }

    // Delete all allocation rows for this payment (both expense and subscription)
    await tx.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, id));

    // Create reversal ledger entry (debit to reverse the credit)
    // Use the original payment entry's period, not the active period
    const periodId = await ledgerService.findEntryPeriodId(payment.apartmentId, 'payment', payment.id, tx);
    await ledgerService.recordReversal(
      payment.apartmentId,
      payment.id,
      parseFloat(payment.amount),
      'credit',
      `Reversal of payment ${payment.id}`,
      userId,
      tx,
      periodId ?? undefined,
    );

    await ledgerService.refreshCachedBalance(payment.apartmentId, tx);

    return { success: true };
  });
}
