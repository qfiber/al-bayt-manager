import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { db } from '../config/database.js';
import { messages, users, profiles } from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export const messageRoutes = Router();

const createMessageSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional(),
});

// List messages for current user's org
messageRoutes.get('/', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [];
    if (req.organizationId) conditions.push(eq(messages.organizationId, req.organizationId));

    const result = await db
      .select({
        message: messages,
        senderEmail: users.email,
        senderName: profiles.name,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .leftJoin(profiles, eq(messages.senderId, profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(messages.createdAt))
      .limit(50);

    res.json(result);
  } catch (err) { next(err); }
});

// Send a message
messageRoutes.post('/', requireAuth, requireOrgScope, validate(createMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [msg] = await db.insert(messages).values({
      organizationId: req.organizationId,
      senderId: req.user!.userId,
      subject: req.body.subject,
      body: req.body.body,
      parentId: req.body.parentId || null,
    }).returning();

    res.status(201).json(msg);
  } catch (err) { next(err); }
});

// Mark message as read
messageRoutes.put('/:id/read', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [msg] = await db.update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, req.params.id as string))
      .returning();
    res.json(msg);
  } catch (err) { next(err); }
});

// Get unread count
messageRoutes.get('/unread-count', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [eq(messages.isRead, false)];
    if (req.organizationId) conditions.push(eq(messages.organizationId, req.organizationId));
    // Only count messages NOT sent by the current user
    conditions.push(sql`${messages.senderId} != ${req.user!.userId}`);

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(...conditions));

    res.json({ count: result?.count || 0 });
  } catch (err) { next(err); }
});
