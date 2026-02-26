import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { scopeToModeratorBuildings } from '../middleware/building-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as issueService from '../services/issue.service.js';

export const issueRoutes = Router();

const createIssueSchema = z.object({
  buildingId: z.string().uuid(),
  floor: z.number().int().nullable().optional(),
  category: z.enum(['plumbing', 'electrical', 'elevator', 'water_leak', 'cleaning', 'structural', 'safety', 'other']),
  description: z.string().min(1).max(2000),
  attachments: z.array(z.object({
    fileUrl: z.string().max(500),
    fileType: z.enum(['image', 'video']),
    originalName: z.string().max(255).optional(),
  })).max(10).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

// GET /issues - List issues (scoped by role)
issueRoutes.get('/', requireAuth, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { buildingId, status, category } = req.query;
    let allowedBuildingIds = req.allowedBuildingIds; // moderator scope

    // Regular users can only see issues from their buildings
    if (req.user!.role === 'user') {
      allowedBuildingIds = await issueService.getUserBuildingIds(req.user!.userId);
      if (allowedBuildingIds.length === 0) {
        res.json([]);
        return;
      }
    }

    const result = await issueService.listIssues({
      buildingId: buildingId as string | undefined,
      status: status as string | undefined,
      category: category as string | undefined,
      allowedBuildingIds,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /issues/count/open - Open issue count (MUST be before /:id)
issueRoutes.get('/count/open', requireAuth, scopeToModeratorBuildings, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let buildingIds = req.allowedBuildingIds;

    if (req.user!.role === 'user') {
      buildingIds = await issueService.getUserBuildingIds(req.user!.userId);
    }

    const count = await issueService.countOpenIssues(buildingIds);
    res.json({ count });
  } catch (err) { next(err); }
});

// GET /issues/:id - Single issue
issueRoutes.get('/:id', requireAuth, validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await issueService.getIssue(req.params.id as string);

    // Regular users can only see their own reports
    if (req.user!.role === 'user' && result.issue.reporterId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(result);
  } catch (err) { next(err); }
});

// POST /issues - Create issue (any authenticated user)
issueRoutes.post('/', requireAuth, validate(createIssueSchema), auditLog('create', 'issue_reports'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify user belongs to the building (for regular users)
    if (req.user!.role === 'user') {
      const userBuildingIds = await issueService.getUserBuildingIds(req.user!.userId);
      if (!userBuildingIds.includes(req.body.buildingId)) {
        res.status(403).json({ error: 'You do not belong to this building' });
        return;
      }
    }

    const result = await issueService.createIssue({
      ...req.body,
      reporterId: req.user!.userId,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PUT /issues/:id/resolve - Admin/moderator only
issueRoutes.put('/:id/resolve', requireAuth, requireRole('admin', 'moderator'), validate({ params: idParams }), auditLog('update', 'issue_reports'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await issueService.resolveIssue(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});
