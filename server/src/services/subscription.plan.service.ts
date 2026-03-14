import { db } from '../config/database.js';
import { subscriptionPlans, organizationSubscriptions, subscriptionInvoices, organizations } from '../db/schema/index.js';
import { eq, desc, sql, and, lte } from 'drizzle-orm';
import { AppError } from '../middleware/error-handler.js';

// ============ PLANS ============

export async function listPlans() {
  return db.select().from(subscriptionPlans).orderBy(subscriptionPlans.displayOrder);
}

export async function getPlan(id: string) {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  if (!plan) throw new AppError(404, 'Plan not found');
  return plan;
}

export async function createPlan(data: {
  name: string; slug: string; maxBuildings: number; maxApartmentsPerBuilding: number;
  monthlyPrice: string; semiAnnualPrice?: string; yearlyPrice?: string;
  currency?: string; isCustom?: boolean; displayOrder?: number;
}) {
  const [plan] = await db.insert(subscriptionPlans).values(data).returning();
  return plan;
}

export async function updatePlan(id: string, data: Partial<{
  name: string; maxBuildings: number; maxApartmentsPerBuilding: number;
  monthlyPrice: string; semiAnnualPrice: string; yearlyPrice: string;
  currency: string; isActive: boolean; isCustom: boolean; displayOrder: number;
}>) {
  const [plan] = await db.update(subscriptionPlans).set({ ...data, updatedAt: new Date() }).where(eq(subscriptionPlans.id, id)).returning();
  if (!plan) throw new AppError(404, 'Plan not found');
  return plan;
}

export async function deletePlan(id: string) {
  const [plan] = await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id)).returning();
  if (!plan) throw new AppError(404, 'Plan not found');
  return plan;
}

// ============ SUBSCRIPTIONS ============

export async function getOrgSubscription(organizationId: string) {
  const [sub] = await db
    .select({
      subscription: organizationSubscriptions,
      planName: subscriptionPlans.name,
      planSlug: subscriptionPlans.slug,
      maxBuildings: subscriptionPlans.maxBuildings,
      maxApartmentsPerBuilding: subscriptionPlans.maxApartmentsPerBuilding,
    })
    .from(organizationSubscriptions)
    .leftJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
    .where(eq(organizationSubscriptions.organizationId, organizationId))
    .orderBy(desc(organizationSubscriptions.createdAt))
    .limit(1);
  return sub || null;
}

export async function assignPlan(organizationId: string, planId: string, billingCycle: string) {
  const plan = await getPlan(planId);

  // Calculate amount based on billing cycle
  let amount = plan.monthlyPrice;
  if (billingCycle === 'semi_annual' && plan.semiAnnualPrice) amount = plan.semiAnnualPrice;
  if (billingCycle === 'yearly' && plan.yearlyPrice) amount = plan.yearlyPrice;

  // Calculate period end
  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
  else if (billingCycle === 'semi_annual') periodEnd.setMonth(periodEnd.getMonth() + 6);
  else if (billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  // Upsert subscription
  const existing = await getOrgSubscription(organizationId);
  if (existing) {
    const [updated] = await db.update(organizationSubscriptions)
      .set({
        planId, billingCycle, status: 'active', amount: amount,
        currentPeriodStart: now, currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(eq(organizationSubscriptions.id, existing.subscription.id))
      .returning();

    // Update org limits from plan
    await db.update(organizations).set({
      maxBuildings: plan.maxBuildings,
      maxApartments: plan.maxBuildings * plan.maxApartmentsPerBuilding,
      updatedAt: now,
    }).where(eq(organizations.id, organizationId));

    return updated;
  } else {
    const [sub] = await db.insert(organizationSubscriptions).values({
      organizationId, planId, billingCycle, status: 'active', amount,
      currentPeriodStart: now, currentPeriodEnd: periodEnd,
    }).returning();

    await db.update(organizations).set({
      maxBuildings: plan.maxBuildings,
      maxApartments: plan.maxBuildings * plan.maxApartmentsPerBuilding,
      updatedAt: now,
    }).where(eq(organizations.id, organizationId));

    return sub;
  }
}

export async function startTrial(organizationId: string, planId?: string) {
  // Prevent duplicate trials
  const existing = await getOrgSubscription(organizationId);
  if (existing) return existing.subscription;

  const defaultPlanId = planId || (await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.slug, 'starter')).limit(1))[0]?.id;

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 30); // 30-day trial

  const [sub] = await db.insert(organizationSubscriptions).values({
    organizationId,
    planId: defaultPlanId,
    status: 'trial',
    billingCycle: 'monthly',
    trialStartDate: now,
    trialEndDate: trialEnd,
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd,
  }).returning();

  return sub;
}

export async function cancelSubscription(organizationId: string) {
  const sub = await getOrgSubscription(organizationId);
  if (!sub) throw new AppError(404, 'No subscription found');

  const [updated] = await db.update(organizationSubscriptions)
    .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(organizationSubscriptions.id, sub.subscription.id))
    .returning();
  return updated;
}

// ============ INVOICES ============

export async function listOrgInvoices(organizationId: string) {
  return db.select().from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.organizationId, organizationId))
    .orderBy(desc(subscriptionInvoices.createdAt));
}

export async function listAllInvoices() {
  return db
    .select({
      invoice: subscriptionInvoices,
      orgName: organizations.name,
    })
    .from(subscriptionInvoices)
    .innerJoin(organizations, eq(subscriptionInvoices.organizationId, organizations.id))
    .orderBy(desc(subscriptionInvoices.createdAt))
    .limit(100);
}

export async function generateInvoice(organizationId: string, amount: string, billingCycle: string, periodStart: Date, periodEnd: Date) {
  const year = new Date().getFullYear();
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(subscriptionInvoices);
  const invoiceNumber = `SUB-${year}-${String((count[0]?.count || 0) + 1).padStart(5, '0')}`;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14); // Due in 14 days

  const [invoice] = await db.insert(subscriptionInvoices).values({
    organizationId,
    invoiceNumber,
    amount,
    billingCycle,
    periodStart,
    periodEnd,
    dueDate,
  }).returning();

  return invoice;
}

// ============ TRIAL EXPIRY ============

export async function processExpiredTrials() {
  const now = new Date();

  // Find active trials that have expired
  const expired = await db
    .select({ id: organizationSubscriptions.id, organizationId: organizationSubscriptions.organizationId })
    .from(organizationSubscriptions)
    .where(and(
      eq(organizationSubscriptions.status, 'trial'),
      lte(organizationSubscriptions.trialEndDate, now),
    ));

  for (const sub of expired) {
    // Mark subscription as expired
    await db.update(organizationSubscriptions)
      .set({ status: 'past_due', updatedAt: now })
      .where(eq(organizationSubscriptions.id, sub.id));

    // Suspend the organization
    await db.update(organizations)
      .set({ isActive: false, updatedAt: now })
      .where(eq(organizations.id, sub.organizationId));
  }

  return expired.length;
}

// ============ AUTO-INVOICING ============

export async function generateMonthlyInvoices() {
  const now = new Date();

  // Find all active subscriptions where current period has ended
  const activeSubs = await db
    .select({
      sub: organizationSubscriptions,
      orgName: organizations.name,
    })
    .from(organizationSubscriptions)
    .innerJoin(organizations, eq(organizationSubscriptions.organizationId, organizations.id))
    .where(and(
      eq(organizationSubscriptions.status, 'active'),
      lte(organizationSubscriptions.currentPeriodEnd, now),
    ));

  let generated = 0;

  for (const { sub, orgName } of activeSubs) {
    if (!sub.amount || parseFloat(sub.amount) <= 0) continue;

    // Generate invoice
    const periodStart = sub.currentPeriodEnd || now;
    let periodEnd = new Date(periodStart);
    if (sub.billingCycle === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (sub.billingCycle === 'semi_annual') periodEnd.setMonth(periodEnd.getMonth() + 6);
    else if (sub.billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    await generateInvoice(sub.organizationId, sub.amount, sub.billingCycle, periodStart, periodEnd);

    // Advance the subscription period
    await db.update(organizationSubscriptions)
      .set({ currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, updatedAt: now })
      .where(eq(organizationSubscriptions.id, sub.id));

    generated++;
  }

  return generated;
}

// ============ METRICS ============

export async function getSubscriptionMetrics() {
  const [metrics] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM organization_subscriptions WHERE status = 'trial') AS trial_count,
        (SELECT count(*)::int FROM organization_subscriptions WHERE status = 'active') AS active_count,
        (SELECT count(*)::int FROM organization_subscriptions WHERE status = 'cancelled') AS cancelled_count,
        (SELECT count(*)::int FROM organization_subscriptions WHERE status = 'past_due') AS past_due_count,
        (SELECT COALESCE(SUM(amount::numeric), 0)::text FROM organization_subscriptions WHERE status = 'active' AND billing_cycle = 'monthly') AS mrr,
        (SELECT count(*)::int FROM organization_subscriptions WHERE status = 'trial' AND trial_end_date < NOW()) AS expired_trials
    `),
  ]);
  return metrics.rows[0];
}
