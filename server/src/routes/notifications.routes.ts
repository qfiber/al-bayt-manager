import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as notificationInbox from '../services/notification-inbox.service.js';

export const notificationInboxRoutes = Router();

notificationInboxRoutes.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationInbox.getNotifications(req.user!.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

notificationInboxRoutes.get('/count', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const count = await notificationInbox.getUnreadCount(req.user!.organizationId, since);
    res.json({ count });
  } catch (err) { next(err); }
});
