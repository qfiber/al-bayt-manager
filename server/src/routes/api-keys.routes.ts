import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import * as apiKeyService from '../services/api-key.service.js';

export const apiKeyRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });
const createSchema = z.object({ name: z.string().min(1).max(100) });
const updateSchema = z.object({ name: z.string().min(1).max(100).optional(), isActive: z.boolean().optional() });

apiKeyRoutes.get('/', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apiKeyService.listApiKeys(req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

apiKeyRoutes.post('/', requireAuth, requireRole('admin'), validate(createSchema), auditLog('api_key_created', 'api_keys'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apiKeyService.createApiKey(req.user!.userId, req.body.name);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

apiKeyRoutes.put('/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateSchema }), auditLog('update', 'api_keys'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apiKeyService.updateApiKey(req.params.id as string, req.body, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

apiKeyRoutes.delete('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('api_key_deleted', 'api_keys'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apiKeyService.deleteApiKey(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});
