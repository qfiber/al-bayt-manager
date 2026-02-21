import { db } from '../config/database.js';
import {
  buildings, apartments, payments, expenses, apartmentExpenses, apartmentLedger,
} from '../db/schema/index.js';
import { eq, and, sql, desc, inArray, gte, lte } from 'drizzle-orm';

export async function getSummary(allowedBuildingIds?: string[], startDate?: string, endDate?: string) {
  const buildingConditions: any[] = [];
  if (allowedBuildingIds?.length) {
    buildingConditions.push(inArray(buildings.id, allowedBuildingIds));
  }

  const [buildingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(buildings)
    .where(buildingConditions.length ? and(...buildingConditions) : undefined);

  const aptConditions: any[] = [];
  if (allowedBuildingIds?.length) {
    aptConditions.push(inArray(apartments.buildingId, allowedBuildingIds));
  }

  const [apartmentStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      occupied: sql<number>`count(*) FILTER (WHERE ${apartments.status} = 'occupied')::int`,
      vacant: sql<number>`count(*) FILTER (WHERE ${apartments.status} = 'vacant')::int`,
      totalDebt: sql<string>`COALESCE(SUM(CASE WHEN ${apartments.cachedBalance}::numeric < 0 THEN ABS(${apartments.cachedBalance}::numeric) ELSE 0 END), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CASE WHEN ${apartments.cachedBalance}::numeric > 0 THEN ${apartments.cachedBalance}::numeric ELSE 0 END), 0)`,
    })
    .from(apartments)
    .where(aptConditions.length ? and(...aptConditions) : undefined);

  // Payment totals (optionally date-filtered)
  const paymentConditions: any[] = [eq(payments.isCanceled, false)];
  if (allowedBuildingIds?.length) {
    paymentConditions.push(inArray(apartments.buildingId, allowedBuildingIds));
  }
  if (startDate) paymentConditions.push(gte(payments.month, startDate.slice(0, 7)));
  if (endDate) paymentConditions.push(lte(payments.month, endDate.slice(0, 7)));

  const [paymentStats] = await db
    .select({
      totalPayments: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      paymentCount: sql<number>`count(*)::int`,
    })
    .from(payments)
    .innerJoin(apartments, eq(payments.apartmentId, apartments.id))
    .where(and(...paymentConditions));

  // Expense totals — use apartment_expenses (actual charges) not expenses (raw amounts)
  // This gives accurate totals for building-wide expenses that were split
  const expenseConditions: any[] = [eq(apartmentExpenses.isCanceled, false)];
  if (allowedBuildingIds?.length) {
    expenseConditions.push(inArray(apartments.buildingId, allowedBuildingIds));
  }
  if (startDate) expenseConditions.push(gte(expenses.expenseDate, startDate));
  if (endDate) expenseConditions.push(lte(expenses.expenseDate, endDate));

  const [expenseStats] = await db
    .select({
      totalExpenses: sql<string>`COALESCE(SUM(${apartmentExpenses.amount}::numeric), 0)`,
      expenseCount: sql<number>`count(DISTINCT ${expenses.id})::int`,
    })
    .from(apartmentExpenses)
    .innerJoin(expenses, eq(apartmentExpenses.expenseId, expenses.id))
    .innerJoin(apartments, eq(apartmentExpenses.apartmentId, apartments.id))
    .where(and(...expenseConditions));

  return {
    buildings: buildingCount.count,
    apartments: apartmentStats,
    payments: paymentStats,
    expenses: expenseStats,
  };
}

export async function getBuildingReports(allowedBuildingIds?: string[]) {
  const conditions: any[] = [];
  if (allowedBuildingIds?.length) {
    conditions.push(inArray(buildings.id, allowedBuildingIds));
  }

  return db
    .select({
      buildingId: buildings.id,
      buildingName: buildings.name,
      totalApartments: sql<number>`count(DISTINCT ${apartments.id})::int`,
      occupiedApartments: sql<number>`count(DISTINCT ${apartments.id}) FILTER (WHERE ${apartments.status} = 'occupied')::int`,
      totalDebt: sql<string>`COALESCE(SUM(CASE WHEN ${apartments.cachedBalance}::numeric < 0 THEN ABS(${apartments.cachedBalance}::numeric) ELSE 0 END), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CASE WHEN ${apartments.cachedBalance}::numeric > 0 THEN ${apartments.cachedBalance}::numeric ELSE 0 END), 0)`,
    })
    .from(buildings)
    .leftJoin(apartments, eq(buildings.id, apartments.buildingId))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(buildings.id, buildings.name);
}

export async function getMonthlyTrends(allowedBuildingIds?: string[], months: number = 12) {
  const paymentConditions: any[] = [eq(payments.isCanceled, false)];
  if (allowedBuildingIds?.length) {
    paymentConditions.push(inArray(apartments.buildingId, allowedBuildingIds));
  }

  const paymentsQuery = db
    .select({
      month: payments.month,
      total: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
    })
    .from(payments)
    .innerJoin(apartments, eq(payments.apartmentId, apartments.id))
    .where(and(...paymentConditions))
    .groupBy(payments.month)
    .orderBy(desc(payments.month))
    .limit(months);

  // Use apartment_expenses for accurate per-apartment charge totals
  const expenseConditions: any[] = [eq(apartmentExpenses.isCanceled, false)];
  if (allowedBuildingIds?.length) {
    expenseConditions.push(inArray(apartments.buildingId, allowedBuildingIds));
  }

  const expensesQuery = db
    .select({
      month: sql<string>`TO_CHAR(${expenses.expenseDate}::date, 'YYYY-MM')`,
      total: sql<string>`COALESCE(SUM(${apartmentExpenses.amount}::numeric), 0)`,
    })
    .from(apartmentExpenses)
    .innerJoin(expenses, eq(apartmentExpenses.expenseId, expenses.id))
    .innerJoin(apartments, eq(apartmentExpenses.apartmentId, apartments.id))
    .where(and(...expenseConditions))
    .groupBy(sql`TO_CHAR(${expenses.expenseDate}::date, 'YYYY-MM')`)
    .orderBy(desc(sql`TO_CHAR(${expenses.expenseDate}::date, 'YYYY-MM')`))
    .limit(months);

  const [paymentTrends, expenseTrends] = await Promise.all([paymentsQuery, expensesQuery]);

  return { payments: paymentTrends, expenses: expenseTrends };
}

export async function getExpensesByCategory(allowedBuildingIds?: string[], startDate?: string, endDate?: string) {
  // Use apartment_expenses joined to expenses for accurate charge totals
  const conditions: any[] = [eq(apartmentExpenses.isCanceled, false)];
  if (allowedBuildingIds?.length) {
    conditions.push(inArray(apartments.buildingId, allowedBuildingIds));
  }
  if (startDate) conditions.push(gte(expenses.expenseDate, startDate));
  if (endDate) conditions.push(lte(expenses.expenseDate, endDate));

  return db
    .select({
      category: sql<string>`COALESCE(${expenses.category}, 'uncategorized')`.as('category'),
      total: sql<string>`COALESCE(SUM(${apartmentExpenses.amount}::numeric), 0)`,
      count: sql<number>`count(DISTINCT ${expenses.id})::int`,
    })
    .from(apartmentExpenses)
    .innerJoin(expenses, eq(apartmentExpenses.expenseId, expenses.id))
    .innerJoin(apartments, eq(apartmentExpenses.apartmentId, apartments.id))
    .where(and(...conditions))
    .groupBy(sql`COALESCE(${expenses.category}, 'uncategorized')`);
}

/**
 * Reconciliation: Compare cachedBalance vs actual ledger SUM for all apartments.
 * Returns only apartments with discrepancies.
 */
export async function getReconciliation() {
  const rows = await db
    .select({
      apartmentId: apartments.id,
      apartmentNumber: apartments.apartmentNumber,
      buildingId: apartments.buildingId,
      buildingName: buildings.name,
      cachedBalance: apartments.cachedBalance,
      ledgerBalance: sql<string>`COALESCE(SUM(
        CASE WHEN ${apartmentLedger.entryType} = 'credit' THEN ${apartmentLedger.amount}::numeric
             ELSE -${apartmentLedger.amount}::numeric
        END
      ), 0)`,
    })
    .from(apartments)
    .innerJoin(buildings, eq(apartments.buildingId, buildings.id))
    .leftJoin(apartmentLedger, eq(apartments.id, apartmentLedger.apartmentId))
    .groupBy(apartments.id, apartments.apartmentNumber, apartments.buildingId, buildings.name, apartments.cachedBalance);

  const discrepancies = rows
    .map((row) => {
      const cached = parseFloat(row.cachedBalance);
      const ledger = parseFloat(row.ledgerBalance);
      const diff = Math.round((cached - ledger) * 100) / 100;
      return {
        apartmentId: row.apartmentId,
        apartmentNumber: row.apartmentNumber,
        buildingId: row.buildingId,
        buildingName: row.buildingName,
        cachedBalance: cached,
        ledgerBalance: ledger,
        discrepancy: diff,
      };
    })
    .filter((r) => r.discrepancy !== 0);

  return {
    totalApartments: rows.length,
    discrepancyCount: discrepancies.length,
    discrepancies,
  };
}
