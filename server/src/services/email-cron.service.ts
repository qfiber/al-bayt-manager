import cron from 'node-cron';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { apartments } from '../db/schema/index.js';
import { eq, and, lt } from 'drizzle-orm';
import * as notificationService from './notification.service.js';
import { getRawSettings } from './settings.service.js';

/**
 * 1st of each month: Send email payment reminders to all occupied apartments with active subscriptions.
 */
async function sendMonthlyEmailReminders() {
  logger.info('Email cron: Sending monthly payment reminders');

  try {
    const config = await getRawSettings();
    if (!config?.resendApiKey) {
      logger.info('Email cron: Email is not configured, skipping');
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

      try {
        await notificationService.sendPaymentReminder(apt.id);
        sent++;
      } catch (err) {
        logger.error({ err, apartmentId: apt.id }, 'Email cron: Failed to send reminder');
      }
    }

    logger.info({ sent, skipped }, 'Email cron: Monthly reminders complete');
  } catch (err) {
    logger.error(err, 'Email cron: Error sending monthly reminders');
  }
}

/**
 * 7th of each month: Send email overdue reminders to tenants with negative balance.
 */
async function sendOverdueEmailReminders() {
  logger.info('Email cron: Sending overdue payment reminders');

  try {
    const config = await getRawSettings();
    if (!config?.resendApiKey) {
      logger.info('Email cron: Email is not configured, skipping');
      return;
    }

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

    for (const apt of debtApartments) {
      try {
        await notificationService.sendPaymentReminder(apt.id);
        sent++;
      } catch (err) {
        logger.error({ err, apartmentId: apt.id }, 'Email cron: Failed to send overdue reminder');
      }
    }

    logger.info({ sent }, 'Email cron: Overdue reminders complete');
  } catch (err) {
    logger.error(err, 'Email cron: Error sending overdue reminders');
  }
}

export function startEmailCron() {
  // 1st of each month at 09:30 (offset from SMS to avoid spike)
  cron.schedule('30 9 1 * *', () => {
    sendMonthlyEmailReminders().catch((err) => logger.error(err, 'Email monthly cron failed'));
  });

  // 7th of each month at 09:30
  cron.schedule('30 9 7 * *', () => {
    sendOverdueEmailReminders().catch((err) => logger.error(err, 'Email overdue cron failed'));
  });

  logger.info('Email cron jobs scheduled: monthly reminders (1st) and overdue reminders (7th)');
}

export { sendMonthlyEmailReminders, sendOverdueEmailReminders };
