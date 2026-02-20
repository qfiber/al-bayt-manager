import { db } from '../config/database.js';
import {
  apartments, buildings, profiles, apartmentExpenses, payments,
  apartmentLedger, userApartments,
} from '../db/schema/index.js';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as ledgerService from './ledger.service.js';
import { customRound } from '../utils/rounding.js';

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
}) {
  // Verify building exists
  const [building] = await db.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, data.buildingId)).limit(1);
  if (!building) throw new AppError(404, 'Building not found');

  const [apt] = await db.insert(apartments).values({
    ...data,
    cachedBalance: '0',
  }).returning();
  return apt;
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
}>) {
  const [apt] = await db
    .update(apartments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(apartments.id, id))
    .returning();
  if (!apt) throw new AppError(404, 'Apartment not found');
  return apt;
}

export async function deleteApartment(id: string) {
  // Fetch first to check guards
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, id)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  if (apt.status === 'occupied') {
    throw new AppError(400, 'Cannot delete an occupied apartment. Terminate occupancy first.');
  }

  const balance = parseFloat(apt.cachedBalance);
  if (balance !== 0) {
    throw new AppError(400, `Cannot delete apartment with non-zero balance (₪${balance.toFixed(2)}). Settle outstanding balance first.`);
  }

  const [deleted] = await db.delete(apartments).where(eq(apartments.id, id)).returning();
  return deleted;
}

export async function terminateOccupancy(id: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [apt] = await tx.select().from(apartments).where(eq(apartments.id, id)).limit(1);
    if (!apt) throw new AppError(404, 'Apartment not found');
    if (apt.status !== 'occupied') throw new AppError(400, 'Apartment is not occupied');

    // Calculate prorated credit for remaining days of the month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = daysInMonth - now.getDate();
    const subscriptionAmount = parseFloat(apt.subscriptionAmount || '0');

    if (subscriptionAmount > 0 && remainingDays > 0) {
      const dailyRate = subscriptionAmount / daysInMonth;
      const proratedCredit = customRound(dailyRate * remainingDays);

      if (proratedCredit > 0) {
        await ledgerService.recordOccupancyCredit(id, proratedCredit, userId, tx);
      }
    }

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

    await ledgerService.refreshCachedBalance(id, tx);

    return updated;
  });
}

export async function getDebtDetails(apartmentId: string) {
  const [apt] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);
  if (!apt) throw new AppError(404, 'Apartment not found');

  const expenses = await db
    .select()
    .from(apartmentExpenses)
    .where(and(eq(apartmentExpenses.apartmentId, apartmentId), eq(apartmentExpenses.isCanceled, false)));

  const aptPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.apartmentId, apartmentId), eq(payments.isCanceled, false)));

  const ledger = await db
    .select()
    .from(apartmentLedger)
    .where(eq(apartmentLedger.apartmentId, apartmentId))
    .orderBy(desc(apartmentLedger.createdAt));

  const balance = await ledgerService.getBalance(apartmentId);

  return {
    apartment: apt,
    balance,
    expenses,
    payments: aptPayments,
    ledger,
  };
}

export async function getApartmentLedger(apartmentId: string, limit: number = 50, offset: number = 0) {
  return ledgerService.getLedger(apartmentId, { limit, offset });
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
