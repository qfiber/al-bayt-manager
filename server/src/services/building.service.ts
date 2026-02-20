import { db } from '../config/database.js';
import { buildings, apartments } from '../db/schema/index.js';
import { eq, inArray, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listBuildings(allowedBuildingIds?: string[]) {
  if (allowedBuildingIds) {
    if (allowedBuildingIds.length === 0) return [];
    return db.select().from(buildings).where(inArray(buildings.id, allowedBuildingIds));
  }
  return db.select().from(buildings);
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
  logoUrl?: string;
}) {
  const [building] = await db.insert(buildings).values(data).returning();
  return building;
}

export async function updateBuilding(id: string, data: Partial<{
  name: string;
  address: string;
  numberOfFloors: number;
  undergroundFloors: number;
  logoUrl: string;
}>) {
  const [building] = await db
    .update(buildings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(buildings.id, id))
    .returning();
  if (!building) throw new AppError(404, 'Building not found');
  return building;
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
