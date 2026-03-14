import { db } from '../config/database.js';
import { leases, apartments, buildings } from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listLeases(organizationId?: string) {
  const query = db
    .select({
      lease: leases,
      apartmentNumber: apartments.apartmentNumber,
      buildingName: buildings.name,
      buildingId: buildings.id,
    })
    .from(leases)
    .innerJoin(apartments, eq(leases.apartmentId, apartments.id))
    .innerJoin(buildings, eq(apartments.buildingId, buildings.id))
    .orderBy(desc(leases.createdAt));

  if (organizationId) {
    return query.where(eq(leases.organizationId, organizationId));
  }
  return query;
}

export async function getLease(id: string, organizationId?: string) {
  const conditions: any[] = [eq(leases.id, id)];
  if (organizationId) conditions.push(eq(leases.organizationId, organizationId));
  const [lease] = await db.select().from(leases).where(and(...conditions)).limit(1);
  if (!lease) throw new AppError(404, 'Lease not found');
  return lease;
}

export async function createLease(data: {
  organizationId?: string;
  apartmentId: string;
  tenantName: string;
  tenantEmail?: string;
  tenantPhone?: string;
  startDate: string;
  endDate?: string;
  monthlyRent: string;
  securityDeposit?: string;
  terms?: string;
  contractDocumentUrl?: string;
}) {
  const [lease] = await db.insert(leases).values(data).returning();
  return lease;
}

export async function updateLease(id: string, data: Partial<{
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  securityDeposit: string;
  terms: string;
  contractDocumentUrl: string;
  status: string;
}>, organizationId?: string) {
  const conditions: any[] = [eq(leases.id, id)];
  if (organizationId) conditions.push(eq(leases.organizationId, organizationId));
  const [lease] = await db.update(leases).set({ ...data, updatedAt: new Date() }).where(and(...conditions)).returning();
  if (!lease) throw new AppError(404, 'Lease not found');
  return lease;
}

export async function deleteLease(id: string, organizationId?: string) {
  const conditions: any[] = [eq(leases.id, id)];
  if (organizationId) conditions.push(eq(leases.organizationId, organizationId));
  const [lease] = await db.delete(leases).where(and(...conditions)).returning();
  if (!lease) throw new AppError(404, 'Lease not found');
  return lease;
}

export async function getExpiringLeases(organizationId?: string, daysAhead = 30) {
  const conditions: any[] = [
    eq(leases.status, 'active'),
    sql`${leases.endDate} IS NOT NULL AND ${leases.endDate} <= CURRENT_DATE + ${daysAhead}::int`,
  ];
  if (organizationId) conditions.push(eq(leases.organizationId, organizationId));

  return db
    .select({
      lease: leases,
      apartmentNumber: apartments.apartmentNumber,
      buildingName: buildings.name,
    })
    .from(leases)
    .innerJoin(apartments, eq(leases.apartmentId, apartments.id))
    .innerJoin(buildings, eq(apartments.buildingId, buildings.id))
    .where(and(...conditions))
    .orderBy(leases.endDate);
}
