import { db } from '../config/database.js';
import { buildings, apartments } from '../db/schema/index.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listBuildings(organizationId?: string, allowedBuildingIds?: string[]) {
  const conditions: any[] = [];
  if (organizationId) conditions.push(eq(buildings.organizationId, organizationId));
  if (allowedBuildingIds) {
    if (allowedBuildingIds.length === 0) return [];
    conditions.push(inArray(buildings.id, allowedBuildingIds));
  }
  if (conditions.length === 0) return db.select().from(buildings);
  return db.select().from(buildings).where(and(...conditions));
}

export async function getBuilding(id: string) {
  const [building] = await db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
  if (!building) throw new AppError(404, 'Building not found');
  return building;
}

export async function createBuilding(data: {
  name: string;
  address?: string;
  numberOfFloors?: number;
  undergroundFloors?: number;
  monthlyFee?: string;
  logoUrl?: string;
  ntfyTopicUrl?: string | null;
  generateApartments?: boolean;
  uniformApartmentsPerFloor?: number;
  apartmentsPerFloor?: Record<string, number>;
}) {
  const { generateApartments, uniformApartmentsPerFloor, apartmentsPerFloor, ...buildingData } = data;

  return await db.transaction(async (tx) => {
    const [building] = await tx.insert(buildings).values(buildingData).returning();

    if (generateApartments && building.numberOfFloors) {
      const totalAboveGround = building.numberOfFloors;
      const aptRows: { apartmentNumber: string; floor: number; buildingId: string; cachedBalance: string; status: string }[] = [];

      for (let floor = 0; floor < totalAboveGround; floor++) {
        const floorKey = String(floor);
        const count = uniformApartmentsPerFloor ?? apartmentsPerFloor?.[floorKey] ?? 0;
        for (let apt = 1; apt <= count; apt++) {
          aptRows.push({
            apartmentNumber: `${floor * 100 + apt}`,
            floor,
            buildingId: building.id,
            cachedBalance: '0',
            status: 'vacant',
          });
        }
      }

      if (aptRows.length > 0) {
        await tx.insert(apartments).values(aptRows);
      }
    }

    return building;
  });
}

export async function updateBuilding(id: string, data: Partial<{
  name: string;
  address: string;
  numberOfFloors: number;
  undergroundFloors: number;
  monthlyFee: string;
  logoUrl: string;
  ntfyTopicUrl: string | null;
}>) {
  const [building] = await db
    .update(buildings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(buildings.id, id))
    .returning();
  if (!building) throw new AppError(404, 'Building not found');
  return building;
}

export async function cloneBuilding(id: string) {
  return await db.transaction(async (tx) => {
    const [source] = await tx.select().from(buildings).where(eq(buildings.id, id)).limit(1);
    if (!source) throw new AppError(404, 'Building not found');

    const [cloned] = await tx.insert(buildings).values({
      name: `${source.name} (copy)`,
      address: source.address,
      numberOfFloors: source.numberOfFloors,
      undergroundFloors: source.undergroundFloors,
      monthlyFee: source.monthlyFee,
      logoUrl: source.logoUrl,
      ntfyTopicUrl: null,
    }).returning();

    // Clone apartment structure (all vacant, no occupancy)
    const sourceApartments = await tx.select().from(apartments).where(eq(apartments.buildingId, id));
    if (sourceApartments.length > 0) {
      // First pass: create regular apartments (no parent dependency)
      const parentMap = new Map<string, string>(); // old id -> new id
      const regularApts = sourceApartments.filter(a => !a.parentApartmentId);
      for (const apt of regularApts) {
        const [created] = await tx.insert(apartments).values({
          apartmentNumber: apt.apartmentNumber,
          floor: apt.floor,
          buildingId: cloned.id,
          apartmentType: apt.apartmentType,
          cachedBalance: '0',
          status: 'vacant',
        }).returning();
        parentMap.set(apt.id, created.id);
      }

      // Second pass: create child apartments (storage/parking with parent references)
      const childApts = sourceApartments.filter(a => a.parentApartmentId);
      for (const apt of childApts) {
        await tx.insert(apartments).values({
          apartmentNumber: apt.apartmentNumber,
          floor: apt.floor,
          buildingId: cloned.id,
          apartmentType: apt.apartmentType,
          parentApartmentId: parentMap.get(apt.parentApartmentId!) || null,
          cachedBalance: '0',
          status: 'vacant',
        });
      }
    }

    return cloned;
  });
}

export async function deleteBuilding(id: string) {
  // Check if building has any apartments
  const [aptCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apartments)
    .where(eq(apartments.buildingId, id));

  if (aptCount.count > 0) {
    throw new AppError(400, `Cannot delete building with ${aptCount.count} apartment(s). Remove all apartments first.`);
  }

  const [building] = await db.delete(buildings).where(eq(buildings.id, id)).returning();
  if (!building) throw new AppError(404, 'Building not found');
  return building;
}
