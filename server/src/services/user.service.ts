import { db } from '../config/database.js';
import {
  users, profiles, userRoles, userApartments, apartments,
  moderatorBuildings, totpFactors, buildings,
} from '../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listUsers() {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: profiles.name,
      phone: profiles.phone,
      preferredLanguage: profiles.preferredLanguage,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.id));

  // Get roles for all users
  const roles = await db.select().from(userRoles);
  const roleMap = new Map<string, string>();
  for (const r of roles) {
    roleMap.set(r.userId, r.role);
  }

  return result.map((u) => ({
    ...u,
    role: roleMap.get(u.id) || 'user',
  }));
}

export async function getUser(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: profiles.name,
      phone: profiles.phone,
      preferredLanguage: profiles.preferredLanguage,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.id))
    .where(eq(users.id, id))
    .limit(1);

  if (!user) throw new AppError(404, 'User not found');

  const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, id)).limit(1);

  // Get apartment assignments
  const aptAssignments = await db
    .select({
      id: userApartments.id,
      apartmentId: userApartments.apartmentId,
      apartmentNumber: apartments.apartmentNumber,
      buildingId: apartments.buildingId,
    })
    .from(userApartments)
    .innerJoin(apartments, eq(userApartments.apartmentId, apartments.id))
    .where(eq(userApartments.userId, id));

  // Get building assignments (for moderators)
  const buildingAssignments = await db
    .select({
      id: moderatorBuildings.id,
      buildingId: moderatorBuildings.buildingId,
      buildingName: buildings.name,
    })
    .from(moderatorBuildings)
    .innerJoin(buildings, eq(moderatorBuildings.buildingId, buildings.id))
    .where(eq(moderatorBuildings.userId, id));

  // Get owner/beneficiary assignments
  const ownerApartments = await db
    .select({ id: apartments.id, apartmentNumber: apartments.apartmentNumber, buildingId: apartments.buildingId })
    .from(apartments)
    .where(eq(apartments.ownerId, id));

  const beneficiaryApartments = await db
    .select({ id: apartments.id, apartmentNumber: apartments.apartmentNumber, buildingId: apartments.buildingId })
    .from(apartments)
    .where(eq(apartments.beneficiaryId, id));

  return {
    ...user,
    role: role?.role || 'user',
    apartments: aptAssignments,
    buildings: buildingAssignments,
    ownerApartments,
    beneficiaryApartments,
  };
}

export async function updateUser(id: string, data: {
  name?: string;
  phone?: string;
  preferredLanguage?: string;
  role?: string;
}) {
  return await db.transaction(async (tx) => {
    // Update profile
    if (data.name !== undefined || data.phone !== undefined || data.preferredLanguage !== undefined) {
      const profileData: any = {};
      if (data.name !== undefined) profileData.name = data.name;
      if (data.phone !== undefined) profileData.phone = data.phone;
      if (data.preferredLanguage !== undefined) profileData.preferredLanguage = data.preferredLanguage;
      profileData.updatedAt = new Date();

      await tx.update(profiles).set(profileData).where(eq(profiles.id, id));
    }

    // Update role (delete + insert pattern)
    if (data.role) {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      await tx.insert(userRoles).values({ userId: id, role: data.role as any });
    }

    return getUser(id);
  });
}

export async function deleteUser(id: string) {
  const [user] = await db.delete(users).where(eq(users.id, id)).returning();
  if (!user) throw new AppError(404, 'User not found');
  return { success: true };
}

export async function updateOwnerAssignments(userId: string, apartmentIds: string[]) {
  // Clear existing owner assignments for this user
  await db
    .update(apartments)
    .set({ ownerId: null })
    .where(eq(apartments.ownerId, userId));

  // Set new assignments
  if (apartmentIds.length > 0) {
    await db
      .update(apartments)
      .set({ ownerId: userId })
      .where(inArray(apartments.id, apartmentIds));
  }

  return { success: true };
}

export async function updateBeneficiaryAssignments(userId: string, apartmentIds: string[]) {
  await db
    .update(apartments)
    .set({ beneficiaryId: null })
    .where(eq(apartments.beneficiaryId, userId));

  if (apartmentIds.length > 0) {
    await db
      .update(apartments)
      .set({ beneficiaryId: userId })
      .where(inArray(apartments.id, apartmentIds));
  }

  return { success: true };
}

export async function updateBuildingAssignments(userId: string, buildingIds: string[]) {
  // Clear existing
  await db.delete(moderatorBuildings).where(eq(moderatorBuildings.userId, userId));

  // Insert new
  if (buildingIds.length > 0) {
    await db.insert(moderatorBuildings).values(
      buildingIds.map((buildingId) => ({ userId, buildingId })),
    );
  }

  return { success: true };
}

export async function get2FAStatuses() {
  const allUsers = await db
    .select({ id: users.id, email: users.email, name: profiles.name })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.id));

  const factors = await db
    .select({ userId: totpFactors.userId, status: totpFactors.status })
    .from(totpFactors);

  const factorMap = new Map<string, string>();
  for (const f of factors) {
    if (f.status === 'verified') factorMap.set(f.userId, 'verified');
    else if (!factorMap.has(f.userId)) factorMap.set(f.userId, f.status);
  }

  return allUsers.map((u) => ({
    ...u,
    totpStatus: factorMap.get(u.id) || 'none',
  }));
}
