import crypto from 'crypto';
import { db } from '../config/database.js';
import { apiKeys } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

export async function listApiKeys(userId: string) {
  return db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    isActive: apiKeys.isActive,
    lastUsedAt: apiKeys.lastUsedAt,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(eq(apiKeys.userId, userId));
}

export async function createApiKey(userId: string, name: string) {
  // Generate a random API key
  const rawKey = `abm_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const [key] = await db
    .insert(apiKeys)
    .values({ userId, name, keyHash })
    .returning({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt });

  // Return the raw key only once
  return { ...key, key: rawKey };
}

export async function updateApiKey(id: string, data: { name?: string; isActive?: boolean }, userId: string) {
  const [key] = await db
    .update(apiKeys)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt,
    });
  if (!key) throw new AppError(404, 'API key not found');
  return key;
}

export async function deleteApiKey(id: string, userId: string) {
  const [key] = await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId))).returning();
  if (!key) throw new AppError(404, 'API key not found');
  return { success: true };
}
