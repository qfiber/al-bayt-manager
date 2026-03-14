import { db } from '../config/database.js';
import { organizations, organizationMembers, users, profiles, settings } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listOrganizations() {
  return db.select().from(organizations);
}

export async function getOrganization(id: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) throw new AppError(404, 'Organization not found');
  return org;
}

export async function createOrganization(data: {
  name: string;
  subdomain?: string;
  defaultLanguage?: string;
  maxBuildings?: number;
  maxApartments?: number;
  maxTenants?: number;
}) {
  const subdomain = data.subdomain || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ ...data, subdomain }).returning();

    // Create default settings for the org
    await tx.insert(settings).values({
      organizationId: org.id,
      companyName: data.name,
    });

    return org;
  });
}

export async function updateOrganization(id: string, data: Partial<{
  name: string;
  subdomain: string;
  isActive: boolean;
  defaultLanguage: string;
  maxBuildings: number;
  maxApartments: number;
  maxTenants: number;
}>) {
  const [org] = await db.update(organizations).set({ ...data, updatedAt: new Date() }).where(eq(organizations.id, id)).returning();
  if (!org) throw new AppError(404, 'Organization not found');
  return org;
}

export async function deleteOrganization(id: string) {
  const [org] = await db.delete(organizations).where(eq(organizations.id, id)).returning();
  if (!org) throw new AppError(404, 'Organization not found');
  return org;
}

export async function listMembers(organizationId: string) {
  return db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      email: users.email,
      name: profiles.name,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .leftJoin(profiles, eq(organizationMembers.userId, profiles.id))
    .where(eq(organizationMembers.organizationId, organizationId));
}

export async function addMember(organizationId: string, userId: string, role: 'org_admin' | 'moderator' | 'user') {
  const [existing] = await db.select().from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .limit(1);
  if (existing) throw new AppError(409, 'User is already a member of this organization');

  const [member] = await db.insert(organizationMembers).values({
    userId,
    organizationId,
    role,
  }).returning();
  return member;
}

export async function removeMember(organizationId: string, userId: string) {
  const [member] = await db.delete(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .returning();
  if (!member) throw new AppError(404, 'Member not found');
  return member;
}

export async function addMemberByEmail(organizationId: string, email: string, role: 'org_admin' | 'moderator' | 'user') {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new AppError(404, 'User not found with this email');
  return addMember(organizationId, user.id, role);
}

export async function updateMemberRole(organizationId: string, userId: string, role: 'org_admin' | 'moderator' | 'user') {
  const [member] = await db.update(organizationMembers)
    .set({ role })
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)))
    .returning();
  if (!member) throw new AppError(404, 'Member not found');
  return member;
}

export async function countOrgTenants(organizationId: string): Promise<number> {
  // Count distinct users who are members of this org with role 'user'
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.role, 'user'),
    ));
  return result?.count || 0;
}

export async function checkTenantLimit(organizationId: string): Promise<void> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org || org.maxTenants === 0) return; // 0 = unlimited

  const count = await countOrgTenants(organizationId);
  if (count >= org.maxTenants) {
    throw new AppError(403, 'Tenant limit reached for this organization');
  }
}
