import { db } from '../config/database.js';
import {
  buildings, apartments, payments, expenses,
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

  // Expense totals (optionally date-filtered)
  const expenseConditions: any[] = [];
  if (allowedBuildingIds?.length) {
    expenseConditions.push(inArray(expenses.buildingId, allowedBuildingIds));
  }
  if (startDate) expenseConditions.push(gte(expenses.expenseDate, startDate));
  if (endDate) expenseConditions.push(lte(expenses.expenseDate, endDate));

  const [expenseStats] = await db
    .select({
      totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      expenseCount: sql<number>`count(*)::int`,
    })
    .from(expenses)
    .where(expenseConditions.length ? and(...expenseConditions) : undefined);

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

  const expenseConditions: any[] = [];
  if (allowedBuildingIds?.length) {
    expenseConditions.push(inArray(expenses.buildingId, allowedBuildingIds));
  }

  const expensesQuery = db
    .select({
      month: sql<string>`TO_CHAR(${expenses.expenseDate}::date, 'YYYY-MM')`,
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
    })
    .from(expenses)
    .where(expenseConditions.length ? and(...expenseConditions) : undefined)
    .groupBy(sql`TO_CHAR(${expenses.expenseDate}::date, 'YYYY-MM')`)
    .orderBy(desc(sql`TO_CHAR(${expenses.expenseDate}::date, 'YYYY-MM')`))
    .limit(months);

  const [paymentTrends, expenseTrends] = await Promise.all([paymentsQuery, expensesQuery]);

  return { payments: paymentTrends, expenses: expenseTrends };
}

export async function getExpensesByCategory(allowedBuildingIds?: string[], startDate?: string, endDate?: string) {
  const conditions: any[] = [];
  if (allowedBuildingIds?.length) {
    conditions.push(inArray(expenses.buildingId, allowedBuildingIds));
  }
  if (startDate) conditions.push(gte(expenses.expenseDate, startDate));
  if (endDate) conditions.push(lte(expenses.expenseDate, endDate));

  return db
    .select({
      category: sql<string>`COALESCE(${expenses.category}, 'uncategorized')`.as('category'),
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(expenses)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(sql`COALESCE(${expenses.category}, 'uncategorized')`);
}
