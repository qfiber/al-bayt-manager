import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import * as meetingService from '../services/meeting.service.js';

export const meetingRoutes = Router();

const createMeetingSchema = z.object({
  buildingId: z.string().uuid(),
  title: z.string().min(1).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  location: z.string().max(500).optional(),
  notes: z.string().optional(),
  attendees: z.array(z.object({
    userId: z.string().uuid(),
    attended: z.boolean().optional(),
  })).optional(),
  decisions: z.array(z.object({
    description: z.string().min(1),
    assignedTo: z.string().uuid().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'canceled']).optional(),
  })).optional(),
});

const updateMeetingSchema = createMeetingSchema.partial().omit({ buildingId: true });

meetingRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buildingId } = req.query as any;
    const result = await meetingService.listMeetings({
      buildingId,
      allowedBuildingIds: req.allowedBuildingIds,
    });
    res.json(result);
  } catch (err) { next(err); }
});

meetingRoutes.get('/:id', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await meetingService.getMeeting(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

meetingRoutes.post('/', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createMeetingSchema.parse(req.body);
    const result = await meetingService.createMeeting(data, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

meetingRoutes.put('/:id', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateMeetingSchema.parse(req.body);
    const result = await meetingService.updateMeeting(req.params.id as string, data);
    res.json(result);
  } catch (err) { next(err); }
});

meetingRoutes.delete('/:id', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await meetingService.deleteMeeting(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

meetingRoutes.put('/decisions/:id/status', requireAuth, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({
      status: z.enum(['pending', 'in_progress', 'completed', 'canceled']),
    }).parse(req.body);
    const result = await meetingService.updateDecisionStatus(req.params.id as string, status);
    res.json(result);
  } catch (err) { next(err); }
});
