import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import * as debtCollectionService from '../services/debt-collection.service.js';

export const debtCollectionRoutes = Router();

const createStageSchema = z.object({
  stageNumber: z.number().int().positive(),
  name: z.string().min(1).max(255),
  daysOverdue: z.number().int().min(0),
  actionType: z.enum(['email_reminder', 'formal_notice', 'final_warning', 'custom']),
  templateId: z.string().uuid().optional(),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const updateStageSchema = createStageSchema.partial();

debtCollectionRoutes.get('/stages', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await debtCollectionService.listStages();
    res.json(result);
  } catch (err) { next(err); }
});

debtCollectionRoutes.post('/stages', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createStageSchema.parse(req.body);
    const result = await debtCollectionService.createStage(data);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

debtCollectionRoutes.put('/stages/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateStageSchema.parse(req.body);
    const result = await debtCollectionService.updateStage(req.params.id as string, data);
    res.json(result);
  } catch (err) { next(err); }
});

debtCollectionRoutes.delete('/stages/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await debtCollectionService.deleteStage(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

debtCollectionRoutes.get('/log', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apartmentId, limit, offset } = req.query as any;
    const result = await debtCollectionService.getCollectionLog({
      apartmentId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
});

debtCollectionRoutes.post('/process', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await debtCollectionService.processCollections();
    res.json(result);
  } catch (err) { next(err); }
});
