import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import * as auditService from '../services/audit.service.js';

export const auditLogRoutes = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}/;

const auditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  actionType: z.enum(['login', 'logout', 'signup', 'create', 'update', 'delete', 'role_change', 'password_change', 'api_key_created', 'api_key_deleted']).optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

auditLogRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = auditQuerySchema.parse(req.query);
    const result = await auditService.listAuditLogs(query);
    res.json(result);
  } catch (err) { next(err); }
});
