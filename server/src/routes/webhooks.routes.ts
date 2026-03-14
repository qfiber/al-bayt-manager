import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as webhookService from '../services/webhook.service.js';

export const webhookRoutes = Router();

const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string()).min(1),
});

webhookRoutes.get('/', requireAuth, requireOrgScope, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.json([]); return; }
    const result = await webhookService.listWebhooks(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

webhookRoutes.post('/', requireAuth, requireOrgScope, requireRole('admin'), validate(createWebhookSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const result = await webhookService.createWebhook({ ...req.body, organizationId: req.organizationId });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

webhookRoutes.delete('/:id', requireAuth, requireOrgScope, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const result = await webhookService.deleteWebhook(req.params.id as string, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});
