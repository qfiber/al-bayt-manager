import { db } from '../config/database.js';
import { documents, buildings, apartments, profiles } from '../db/schema/index.js';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';
import * as storageService from './storage.service.js';

export async function listDocuments(filters?: {
  scopeType?: string;
  scopeId?: string;
  allowedBuildingIds?: string[];
  organizationId?: string;
}) {
  const conditions: any[] = [];

  if (filters?.scopeType) {
    conditions.push(eq(documents.scopeType, filters.scopeType as any));
  }
  if (filters?.scopeId) {
    conditions.push(eq(documents.scopeId, filters.scopeId));
  }

  // Organization scoping: only show documents belonging to buildings in the org
  if (filters?.organizationId) {
    const orgBuildingIds = db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.organizationId, filters.organizationId));

    const orgApartmentIds = db
      .select({ id: apartments.id })
      .from(apartments)
      .where(inArray(apartments.buildingId, orgBuildingIds));

    conditions.push(
      sql`(
        (${documents.scopeType} = 'building' AND ${documents.scopeId} IN (${orgBuildingIds}))
        OR (${documents.scopeType} = 'apartment' AND ${documents.scopeId} IN (${orgApartmentIds}))
        OR ${documents.scopeType} = 'user'
      )`,
    );
  }

  // For building scope, enforce moderator access (parameterized to prevent SQL injection)
  if (filters?.allowedBuildingIds?.length) {
    const buildingApartmentIds = db
      .select({ id: apartments.id })
      .from(apartments)
      .where(inArray(apartments.buildingId, filters.allowedBuildingIds));

    conditions.push(
      sql`(
        (${documents.scopeType} = 'building' AND ${documents.scopeId} IN ${sql`(SELECT unnest(${filters.allowedBuildingIds}::uuid[]))`})
        OR (${documents.scopeType} = 'apartment' AND ${documents.scopeId} IN (${buildingApartmentIds}))
        OR ${documents.scopeType} = 'user'
      )`,
    );
  }

  let query = db.select().from(documents);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  return (query as any).orderBy(desc(documents.createdAt));
}

export async function createDocument(data: {
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  originalName?: string;
  scopeType: 'building' | 'apartment' | 'user';
  scopeId: string;
}, userId: string) {
  const [doc] = await db
    .insert(documents)
    .values({
      ...data,
      uploadedBy: userId,
    })
    .returning();
  return doc;
}

export async function getDocument(id: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) throw new AppError(404, 'Document not found');
  return doc;
}

export async function deleteDocument(id: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc) throw new AppError(404, 'Document not found');

  // Delete file from disk
  const filePath = storageService.getDocumentPath(doc.fileUrl.split('/').pop()!);
  storageService.deleteFile(filePath);

  await db.delete(documents).where(eq(documents.id, id));
  return { success: true };
}
