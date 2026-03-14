import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope, requireSuperAdmin } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as subService from '../services/subscription.plan.service.js';

export const subscriptionRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });

const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  maxBuildings: z.number().int().min(0),
  maxApartmentsPerBuilding: z.number().int().min(0),
  monthlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  semiAnnualPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  yearlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().max(10).optional(),
  isCustom: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

const assignPlanSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'semi_annual', 'yearly']),
});

// ---- Plans CRUD (super-admin) ----

subscriptionRoutes.get('/plans', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.listPlans();
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.post('/plans', requireAuth, requireSuperAdmin, validate(createPlanSchema), auditLog('create', 'subscription_plans'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.createPlan(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.put('/plans/:id', requireAuth, requireSuperAdmin, validate({ params: idParams, body: createPlanSchema.partial() }), auditLog('update', 'subscription_plans'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.updatePlan(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.delete('/plans/:id', requireAuth, requireSuperAdmin, validate({ params: idParams }), auditLog('delete', 'subscription_plans'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.deletePlan(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Subscription management ----

subscriptionRoutes.get('/current', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.json(null); return; }
    const result = await subService.getOrgSubscription(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.post('/assign', requireAuth, requireSuperAdmin, validate(assignPlanSchema), auditLog('update', 'organization_subscriptions'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.assignPlan(req.body.organizationId, req.body.planId, req.body.billingCycle);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.post('/cancel', requireAuth, requireOrgScope, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.status(400).json({ error: 'No org context' }); return; }
    const result = await subService.cancelSubscription(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Invoices ----

subscriptionRoutes.get('/invoices', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.organizationId) { res.json([]); return; }
    const result = await subService.listOrgInvoices(req.organizationId);
    res.json(result);
  } catch (err) { next(err); }
});

subscriptionRoutes.get('/all-invoices', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.listAllInvoices();
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Metrics (super-admin) ----

subscriptionRoutes.get('/metrics', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await subService.getSubscriptionMetrics();
    res.json(result);
  } catch (err) { next(err); }
});
