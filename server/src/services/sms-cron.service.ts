import cron from 'node-cron';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { settings, apartments, buildings, userApartments, profiles } from '../db/schema/index.js';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { sendSms } from './sms.service.js';
import { resolveSmsTemplate } from './sms-template.service.js';

/**
 * Get tenant details for an apartment (phone, name, preferred language).
 */
async function getApartmentTenants(apartmentId: string) {
  const assignments = await db
    .select({ userId: userApartments.userId })
    .from(userApartments)
    .where(eq(userApartments.apartmentId, apartmentId));

  if (assignments.length === 0) return [];

  const userIds = assignments.map((a) => a.userId);
  const tenantProfiles = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      phone: profiles.phone,
      preferredLanguage: profiles.preferredLanguage,
      smsNotificationsEnabled: profiles.smsNotificationsEnabled,
    })
    .from(profiles)
    .where(inArray(profiles.id, userIds));

  return tenantProfiles.filter((p) => p.phone && p.smsNotificationsEnabled !== false);
}

/**
 * 1st of each month: Send subscription reminder to all occupied apartments.
 */
async function sendMonthlyReminders() {
  logger.info('SMS cron: Sending monthly subscription reminders');

  try {
    const [config] = await db.select().from(settings).limit(1);
    if (!config?.smsEnabled) {
      logger.info('SMS cron: SMS is disabled, skipping');
      return;
    }

    const occupiedApartments = await db
      .select()
      .from(apartments)
      .where(
        and(
          eq(apartments.status, 'occupied'),
          eq(apartments.subscriptionStatus, 'active'),
        ),
      );

    let sent = 0;
    let skipped = 0;

    for (const apt of occupiedApartments) {
      const amount = parseFloat(apt.subscriptionAmount || '0');
      if (amount <= 0) { skipped++; continue; }

      const [building] = await db
        .select({ name: buildings.name })
        .from(buildings)
        .where(eq(buildings.id, apt.buildingId))
        .limit(1);

      const tenants = await getApartmentTenants(apt.id);
      if (tenants.length === 0) { skipped++; continue; }

      for (const tenant of tenants) {
        try {
          const message = await resolveSmsTemplate('sms_monthly_reminder', tenant.preferredLanguage || 'ar', {
            tenantName: tenant.name || '',
            apartmentNumber: apt.apartmentNumber,
            buildingName: building?.name || '',
            subscriptionAmount: amount.toFixed(2),
            currencySymbol: config.currencySymbol || '₪',
          });

          if (message) {
            await sendSms(tenant.phone!, message, { templateIdentifier: 'sms_monthly_reminder', userId: tenant.id, languageUsed: tenant.preferredLanguage || 'ar' });
            sent++;
          }
        } catch (err) {
          logger.error({ err, apartmentId: apt.id, phone: tenant.phone }, 'SMS cron: Failed to send monthly reminder');
        }
      }
    }

    logger.info({ sent, skipped }, 'SMS cron: Monthly reminders complete');
  } catch (err) {
    logger.error(err, 'SMS cron: Error sending monthly reminders');
  }
}

/**
 * 7th of each month: Send overdue reminder to tenants with negative balance.
 */
async function sendOverdueReminders() {
  logger.info('SMS cron: Sending overdue payment reminders');

  try {
    const [config] = await db.select().from(settings).limit(1);
    if (!config?.smsEnabled) {
      logger.info('SMS cron: SMS is disabled, skipping');
      return;
    }

    // Find apartments with negative balance (debt)
    const debtApartments = await db
      .select()
      .from(apartments)
      .where(
        and(
          eq(apartments.status, 'occupied'),
          lt(apartments.cachedBalance, '0'),
        ),
      );

    let sent = 0;
    let skipped = 0;

    for (const apt of debtApartments) {
      const balance = Math.abs(parseFloat(apt.cachedBalance)).toFixed(2);

      const [building] = await db
        .select({ name: buildings.name })
        .from(buildings)
        .where(eq(buildings.id, apt.buildingId))
        .limit(1);

      const tenants = await getApartmentTenants(apt.id);
      if (tenants.length === 0) { skipped++; continue; }

      for (const tenant of tenants) {
        try {
          const message = await resolveSmsTemplate('sms_overdue_reminder', tenant.preferredLanguage || 'ar', {
            tenantName: tenant.name || '',
            apartmentNumber: apt.apartmentNumber,
            buildingName: building?.name || '',
            balance,
            currencySymbol: config.currencySymbol || '₪',
          });

          if (message) {
            await sendSms(tenant.phone!, message, { templateIdentifier: 'sms_overdue_reminder', userId: tenant.id, languageUsed: tenant.preferredLanguage || 'ar' });
            sent++;
          }
        } catch (err) {
          logger.error({ err, apartmentId: apt.id, phone: tenant.phone }, 'SMS cron: Failed to send overdue reminder');
        }
      }
    }

    logger.info({ sent, skipped }, 'SMS cron: Overdue reminders complete');
  } catch (err) {
    logger.error(err, 'SMS cron: Error sending overdue reminders');
  }
}

export function startSmsCron() {
  // 1st of each month at 09:00
  cron.schedule('0 9 1 * *', () => {
    sendMonthlyReminders().catch((err) => logger.error(err, 'SMS monthly cron failed'));
  });

  // 7th of each month at 09:00
  cron.schedule('0 9 7 * *', () => {
    sendOverdueReminders().catch((err) => logger.error(err, 'SMS overdue cron failed'));
  });

  logger.info('SMS cron jobs scheduled: monthly reminders (1st) and overdue reminders (7th)');
}

// Export for manual triggering
export { sendMonthlyReminders, sendOverdueReminders };
