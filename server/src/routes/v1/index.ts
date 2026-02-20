import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireApiKey } from '../../middleware/api-key.js';
import { db } from '../../config/database.js';
import {
  apartments, buildings, expenses, payments, users, userApartments, profiles,
} from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export const v1Routes = Router();

// All v1 routes require API key
v1Routes.use(requireApiKey);

// Shared pagination schema
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const uuidParams = z.object({ id: z.string().uuid() });

v1Routes.get('/apartments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);
    const result = await db
      .select({
        id: apartments.id,
        apartmentNumber: apartments.apartmentNumber,
        floor: apartments.floor,
        buildingId: apartments.buildingId,
        status: apartments.status,
        cachedBalance: apartments.cachedBalance,
        subscriptionAmount: apartments.subscriptionAmount,
      })
      .from(apartments)
      .limit(limit)
      .offset(offset);
    res.json(result);
  } catch (err) { next(err); }
});

v1Routes.get('/apartments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = uuidParams.parse(req.params);
    const [result] = await db
      .select({
        id: apartments.id,
        apartmentNumber: apartments.apartmentNumber,
        floor: apartments.floor,
        buildingId: apartments.buildingId,
        status: apartments.status,
        cachedBalance: apartments.cachedBalance,
        subscriptionAmount: apartments.subscriptionAmount,
        ownerId: apartments.ownerId,
        beneficiaryId: apartments.beneficiaryId,
        subscriptionStatus: apartments.subscriptionStatus,
        createdAt: apartments.createdAt,
      })
      .from(apartments)
      .where(eq(apartments.id, id))
      .limit(1);
    if (!result) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(result);
  } catch (err) { next(err); }
});

v1Routes.get('/buildings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);
    const result = await db.select().from(buildings).limit(limit).offset(offset);
    res.json(result);
  } catch (err) { next(err); }
});

v1Routes.get('/expenses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);
    const result = await db.select().from(expenses).limit(limit).offset(offset);
    res.json(result);
  } catch (err) { next(err); }
});

v1Routes.get('/payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);
    const result = await db.select().from(payments).limit(limit).offset(offset);
    res.json(result);
  } catch (err) { next(err); }
});

v1Routes.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);
    const result = await db
      .select({
        id: users.id,
        name: profiles.name,
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.id))
      .limit(limit)
      .offset(offset);
    res.json(result);
  } catch (err) { next(err); }
});

v1Routes.get('/user-apartments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginationSchema.parse(req.query);
    const result = await db.select().from(userApartments).limit(limit).offset(offset);
    res.json(result);
  } catch (err) { next(err); }
});
