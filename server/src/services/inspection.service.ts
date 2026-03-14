import { db } from '../config/database.js';
import { inspections, buildings, apartments, userApartments, users, profiles } from '../db/schema/index.js';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listInspections(organizationId?: string) {
  const query = db
    .select({
      inspection: inspections,
      buildingName: buildings.name,
      apartmentNumber: apartments.apartmentNumber,
    })
    .from(inspections)
    .leftJoin(buildings, eq(inspections.buildingId, buildings.id))
    .leftJoin(apartments, eq(inspections.apartmentId, apartments.id))
    .orderBy(desc(inspections.scheduledAt));

  if (organizationId) {
    return query.where(eq(inspections.organizationId, organizationId));
  }
  return query;
}

export async function createInspection(data: {
  organizationId?: string;
  buildingId?: string;
  apartmentId?: string;
  title: string;
  description?: string;
  type?: string;
  scheduledAt: string;
  duration?: string;
  notifyEmail?: string;
  notifySms?: string;
}) {
  const [inspection] = await db.insert(inspections).values({
    ...data,
    scheduledAt: new Date(data.scheduledAt),
  }).returning();
  return inspection;
}

export async function updateInspection(id: string, data: Partial<{
  title: string;
  description: string;
  type: string;
  scheduledAt: string;
  duration: string;
  status: string;
}>, organizationId?: string) {
  const updateData: any = { ...data, updatedAt: new Date() };
  if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);

  const conditions: any[] = [eq(inspections.id, id)];
  if (organizationId) conditions.push(eq(inspections.organizationId, organizationId));

  const [inspection] = await db.update(inspections).set(updateData).where(and(...conditions)).returning();
  if (!inspection) throw new AppError(404, 'Inspection not found');
  return inspection;
}

export async function deleteInspection(id: string, organizationId?: string) {
  const conditions: any[] = [eq(inspections.id, id)];
  if (organizationId) conditions.push(eq(inspections.organizationId, organizationId));

  const [inspection] = await db.delete(inspections).where(and(...conditions)).returning();
  if (!inspection) throw new AppError(404, 'Inspection not found');
  return inspection;
}

// Get tenant contact info for notifications
export async function getAffectedTenants(buildingId?: string, apartmentId?: string) {
  if (apartmentId) {
    // Get tenants assigned to this specific apartment
    return db
      .select({ email: users.email, phone: profiles.phone, name: profiles.name })
      .from(userApartments)
      .innerJoin(users, eq(userApartments.userId, users.id))
      .leftJoin(profiles, eq(users.id, profiles.id))
      .where(eq(userApartments.apartmentId, apartmentId));
  } else if (buildingId) {
    // Get all tenants in the building
    return db
      .select({ email: users.email, phone: profiles.phone, name: profiles.name })
      .from(userApartments)
      .innerJoin(apartments, eq(userApartments.apartmentId, apartments.id))
      .innerJoin(users, eq(userApartments.userId, users.id))
      .leftJoin(profiles, eq(users.id, profiles.id))
      .where(eq(apartments.buildingId, buildingId));
  }
  return [];
}

// Generate ICS calendar content
export function generateICS(inspection: {
  title: string;
  description?: string | null;
  scheduledAt: Date;
  duration?: string | null;
}): string {
  const start = inspection.scheduledAt;
  const durationMin = parseInt(inspection.duration || '60');
  const end = new Date(start.getTime() + durationMin * 60000);

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Al-Bayt Manager//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${inspection.title}`,
    `DESCRIPTION:${(inspection.description || '').replace(/\n/g, '\\n')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
