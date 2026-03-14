import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import * as reportService from '../services/custom-report.service.js';

export const customReportRoutes = Router();

const executeSchema = z.object({
  dataSource: z.enum(['payments', 'expenses', 'apartments', 'leases']),
  columns: z.array(z.string()).optional(),
  filters: z.object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    buildingId: z.string().uuid().optional(),
    status: z.string().max(50).optional(),
    minAmount: z.number().optional(),
    maxAmount: z.number().optional(),
  }).optional(),
  groupBy: z.enum(['building', 'month', 'category', 'status']).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

const saveSchema = z.object({
  name: z.string().min(1).max(255),
  config: executeSchema,
});

// Execute a report
customReportRoutes.post('/execute', requireAuth, requireOrgScope, requireRole('admin', 'moderator'), validate(executeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const result = await reportService.executeReport(req.body, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

// Get available columns for a data source
customReportRoutes.get('/columns/:dataSource', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const columns = reportService.getAvailableColumns(req.params.dataSource as string);
    res.json(columns);
  } catch (err) { next(err); }
});

// List saved reports
customReportRoutes.get('/saved', requireAuth, requireOrgScope, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.json([]); return; }
    const result = await reportService.listSavedReports(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

// Save a report
customReportRoutes.post('/save', requireAuth, requireOrgScope, requireRole('admin', 'moderator'), validate(saveSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const result = await reportService.saveReport({
      organizationId: req.organizationId,
      createdBy: req.user!.userId,
      name: req.body.name,
      config: req.body.config,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// Delete saved report
customReportRoutes.delete('/saved/:id', requireAuth, requireOrgScope, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const result = await reportService.deleteSavedReport(req.params.id as string, req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});
