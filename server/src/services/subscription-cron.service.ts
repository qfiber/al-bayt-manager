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

  logger.info('Subscription billing cron scheduled: trial check (daily), invoicing (1st of month), backup (daily 03:00)');
}
