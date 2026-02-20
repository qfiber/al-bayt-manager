import cron from 'node-cron';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { apartments } from '../db/schema/index.js';
import { eq, and, gt } from 'drizzle-orm';
import * as ledgerService from './ledger.service.js';

/**
 * Generate monthly subscription charges for all occupied apartments.
 * Runs on the 1st of each month at midnight.
 */
async function generateMonthlySubscriptions() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  logger.info({ month }, 'Generating subscription charges');

  try {
    const occupiedApartments = await db
      .select()
      .from(apartments)
      .where(
        and(
          eq(apartments.status, 'occupied'),
          eq(apartments.subscriptionStatus, 'active'),
          gt(apartments.subscriptionAmount, '0'),
        ),
      );

    let count = 0;
    for (const apt of occupiedApartments) {
      try {
        await db.transaction(async (tx) => {
          // Idempotency check within transaction
          const exists = await ledgerService.hasSubscriptionForMonth(apt.id, month, tx);
          if (exists) return;

          const amount = parseFloat(apt.subscriptionAmount || '0');
          if (amount <= 0) return;

          await ledgerService.recordSubscriptionCharge(apt.id, amount, month, null, tx);
          await ledgerService.refreshCachedBalance(apt.id, tx);
          count++;
        });
      } catch (err) {
        logger.error({ err, apartmentId: apt.id, month }, 'Failed to charge subscription for apartment');
      }
    }

    logger.info({ month, count }, 'Generated subscription charges');
  } catch (err) {
    logger.error(err, 'Error generating subscriptions');
  }
}

export function startSubscriptionCron() {
  // Run at midnight on the 1st of each month
  cron.schedule('0 0 1 * *', generateMonthlySubscriptions);
  logger.info('Subscription cron job scheduled for 1st of each month');
}

// Export for manual triggering (testing)
export { generateMonthlySubscriptions };
