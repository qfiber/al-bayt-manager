import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { processExpiredTrials, generateMonthlyInvoices } from './subscription.plan.service.js';

export function startSubscriptionBillingCron() {
  // Check expired trials daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const count = await processExpiredTrials();
      logger.info({ count }, 'Processed expired trials');
    } catch (err) {
      logger.error(err, 'Failed to process expired trials');
    }
  });

  // Generate monthly invoices on 1st of each month at 06:00
  cron.schedule('0 6 1 * *', async () => {
    try {
      const count = await generateMonthlyInvoices();
      logger.info({ count }, 'Generated monthly invoices');
    } catch (err) {
      logger.error(err, 'Failed to generate monthly invoices');
    }
  });

  // Daily backup at 03:00
  cron.schedule('0 3 * * *', async () => {
    try {
      const { createBackup } = await import('./backup.service.js');
      const filepath = await createBackup();
      logger.info({ filepath }, 'Daily backup completed');
    } catch (err) {
      logger.error(err, 'Daily backup failed');
    }
  });

  // Send automated payment links 3 days before trial/subscription expires
  cron.schedule('0 9 * * *', async () => {
    try {
      const count = await sendPaymentReminders();
      logger.info({ count }, 'Sent payment reminder links');
    } catch (err) {
      logger.error(err, 'Failed to send payment reminders');
    }
  });

  logger.info('Subscription billing cron scheduled: trial check (daily), invoicing (1st of month), payment reminders (daily 09:00), backup (daily 03:00)');
}

async function sendPaymentReminders() {
  const { db } = await import('../config/database.js');
  const { organizationSubscriptions, subscriptionPlans, organizations, organizationMembers, users } = await import('../db/schema/index.js');
  const { eq, and, lte, gte, or } = await import('drizzle-orm');

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Find subscriptions expiring within 3 days (trial or active)
  const expiringSubs = await db
    .select({
      sub: organizationSubscriptions,
      planName: subscriptionPlans.name,
      planId: subscriptionPlans.id,
      orgName: organizations.name,
      orgId: organizations.id,
    })
    .from(organizationSubscriptions)
    .innerJoin(organizations, eq(organizationSubscriptions.organizationId, organizations.id))
    .leftJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
    .where(and(
      or(eq(organizationSubscriptions.status, 'trial'), eq(organizationSubscriptions.status, 'active')),
      or(
        and(eq(organizationSubscriptions.status, 'trial'), lte(organizationSubscriptions.trialEndDate, threeDaysFromNow), gte(organizationSubscriptions.trialEndDate, now)),
        and(eq(organizationSubscriptions.status, 'active'), lte(organizationSubscriptions.currentPeriodEnd, threeDaysFromNow), gte(organizationSubscriptions.currentPeriodEnd, now)),
      ),
    ));

  let sent = 0;

  for (const { sub, planName, planId, orgName, orgId } of expiringSubs) {
    // Get org admins' emails
    const admins = await db
      .select({ email: users.email })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.role, 'org_admin')));

    if (admins.length === 0 || !planId) continue;

    // Generate CardCom payment link
    try {
      const plan = await (await import('./subscription.plan.service.js')).getPlan(planId);
      const amount = parseFloat(plan.monthlyPrice);
      if (amount <= 0) continue;

      const { getRawSettings: getRaw } = await import('./settings.service.js');
      const cardcomConfig = await getRaw();
      if (!cardcomConfig?.cardcomEnabled || !cardcomConfig.cardcomTerminalNumber) continue;

      const siteUrl = process.env.CORS_ORIGIN || 'https://albayt.cloud';
      const successUrl = `${siteUrl}/dashboard?subscription=success`;
      const failedUrl = `${siteUrl}/dashboard?subscription=failed`;
      const webhookUrl = `${siteUrl}/api/subscriptions/cardcom-webhook`;

      const cardcomBody = {
        TerminalNumber: parseInt(cardcomConfig.cardcomTerminalNumber),
        ApiName: cardcomConfig.cardcomApiName || '',
        Operation: 'ChargeOnly',
        Amount: amount,
        ProductName: `${planName} Plan - ${sub.billingCycle}`,
        Language: 'he',
        ISOCoinId: 1,
        ReturnValue: JSON.stringify({ orgId, planId, billingCycle: sub.billingCycle }),
        SuccessRedirectUrl: successUrl,
        FailedRedirectUrl: failedUrl,
        WebHookUrl: webhookUrl,
      };

      const cardcomRes = await fetch('https://secure.cardcom.solutions/api/v11/LowProfile/Create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardcomBody),
      });
      const cardcomData = await cardcomRes.json() as any;
      if (!cardcomData.LowProfileId) continue;

      const result = { url: cardcomData.Url || `https://secure.cardcom.solutions/external/LowProfile/${cardcomData.LowProfileId}` };

      // Send email with payment link
      const { getRawSettings } = await import('./settings.service.js');
      const config = await getRawSettings();
      if (config?.resendApiKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(config.resendApiKey);

        for (const admin of admins) {
          await resend.emails.send({
            from: config.smtpFromEmail || 'noreply@albayt.cloud',
            to: admin.email,
            subject: sub.status === 'trial' ? `Your trial is ending soon — ${orgName}` : `Subscription renewal — ${orgName}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2>${sub.status === 'trial' ? 'Your trial is ending soon' : 'Time to renew your subscription'}</h2>
                <p>Dear ${orgName} team,</p>
                <p>${sub.status === 'trial' ? 'Your free trial expires in 3 days.' : 'Your subscription is due for renewal.'}</p>
                <div style="background:#f4f4f4;padding:15px;border-radius:8px;margin:15px 0;">
                  <p><strong>Plan:</strong> ${planName}</p>
                  <p><strong>Amount:</strong> ₪${amount.toFixed(2)}</p>
                </div>
                <a href="${result.url}" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                  Pay Now →
                </a>
                <p style="color:#666;font-size:12px;margin-top:20px;">${config.companyName || 'Al-Bayt Manager'}</p>
              </div>
            `,
          }).catch(() => {});
          sent++;
        }
      }
    } catch (err) {
      logger.error({ err, orgId }, 'Failed to send payment reminder for org');
    }
  }

  return sent;
}
