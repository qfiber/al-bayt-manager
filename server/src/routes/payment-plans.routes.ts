import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { requireOrgScope } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import { db } from '../config/database.js';
import { paymentPlans, apartments, buildings } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';

export const paymentPlanRoutes = Router();

const createPlanSchema = z.object({
  apartmentId: z.string().uuid(),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  installments: z.number().int().min(2).max(60),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

// List payment plans
paymentPlanRoutes.get('/', requireAuth, requireOrgScope, requireRole('admin', 'moderator'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [];
    if (req.organizationId) conditions.push(eq(paymentPlans.organizationId, req.organizationId));

    const result = await db
      .select({
        plan: paymentPlans,
        apartmentNumber: apartments.apartmentNumber,
        buildingName: buildings.name,
      })
      .from(paymentPlans)
      .innerJoin(apartments, eq(paymentPlans.apartmentId, apartments.id))
      .innerJoin(buildings, eq(apartments.buildingId, buildings.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(paymentPlans.createdAt));

    res.json(result);
  } catch (err) { next(err); }
});

// Create payment plan
paymentPlanRoutes.post('/', requireAuth, requireOrgScope, requireRole('admin'), validate(createPlanSchema), auditLog('create', 'payment_plans'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const totalAmount = parseFloat(req.body.totalAmount);
    const amountPerInstallment = Math.round((totalAmount / req.body.installments) * 100) / 100;

    const [plan] = await db.insert(paymentPlans).values({
      organizationId: req.organizationId,
      apartmentId: req.body.apartmentId,
      totalAmount: req.body.totalAmount,
      installments: req.body.installments,
      amountPerInstallment: amountPerInstallment.toFixed(2),
      startDate: req.body.startDate,
      notes: req.body.notes,
    }).returning();

    res.status(201).json(plan);
  } catch (err) { next(err); }
});

// Record installment payment
paymentPlanRoutes.post('/:id/pay-installment', requireAuth, requireOrgScope, requireRole('admin', 'moderator'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [eq(paymentPlans.id, req.params.id as string)];
    if (req.organizationId) conditions.push(eq(paymentPlans.organizationId, req.organizationId));

    const [plan] = await db.select().from(paymentPlans).where(and(...conditions)).limit(1);
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }
    if (plan.paidInstallments >= plan.installments) { res.status(400).json({ error: 'All installments already paid' }); return; }

    const newPaid = plan.paidInstallments + 1;
    const newStatus = newPaid >= plan.installments ? 'completed' : 'active';

    const [updated] = await db.update(paymentPlans)
      .set({ paidInstallments: newPaid, status: newStatus, updatedAt: new Date() })
      .where(eq(paymentPlans.id, plan.id))
      .returning();

    res.json(updated);
  } catch (err) { next(err); }
});

// Cancel plan
paymentPlanRoutes.put('/:id/cancel', requireAuth, requireOrgScope, requireRole('admin'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conditions: any[] = [eq(paymentPlans.id, req.params.id as string)];
    if (req.organizationId) conditions.push(eq(paymentPlans.organizationId, req.organizationId));

    const [plan] = await db.update(paymentPlans)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return; }

    res.json(plan);
  } catch (err) { next(err); }
});

// Tenant: view own payment plans
paymentPlanRoutes.get('/my-plans', requireAuth, requireOrgScope, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userApartments } = await import('../db/schema/index.js');
    const { inArray } = await import('drizzle-orm');

    const assignments = await db.select({ apartmentId: userApartments.apartmentId })
      .from(userApartments)
      .where(eq(userApartments.userId, req.user!.userId));

    if (assignments.length === 0) { res.json([]); return; }

    const aptIds = assignments.map(a => a.apartmentId);

    const result = await db
      .select({
        plan: paymentPlans,
        apartmentNumber: apartments.apartmentNumber,
        buildingName: buildings.name,
      })
      .from(paymentPlans)
      .innerJoin(apartments, eq(paymentPlans.apartmentId, apartments.id))
      .innerJoin(buildings, eq(apartments.buildingId, buildings.id))
      .where(inArray(paymentPlans.apartmentId, aptIds))
      .orderBy(desc(paymentPlans.createdAt));

    res.json(result);
  } catch (err) { next(err); }
});
