import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import { runMigrations } from './seed.js';
import { startSubscriptionCron } from './services/subscription.service.js';
import { startDebtCollectionCron } from './services/debt-collection.service.js';
import { ensureDefaultTemplates } from './services/email.service.js';
import { ensureDefaultNtfyTemplates } from './services/ntfy-template.service.js';
import { ensureDefaultSmsTemplates } from './services/sms-template.service.js';
import { startSmsCron } from './services/sms-cron.service.js';
import { startEmailCron } from './services/email-cron.service.js';
import { startLandlordReminderCron } from './services/landlord-reminder.service.js';

async function main() {
  try {
    await runMigrations();
  } catch (err) {
    logger.error(err, 'Migration failed');
    process.exit(1);
  }

  try {
    await ensureDefaultTemplates();
    await ensureDefaultNtfyTemplates();
    await ensureDefaultSmsTemplates();
  } catch (err) {
    logger.error(err, 'Failed to seed default templates');
  }

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    startSubscriptionCron();
    startDebtCollectionCron();
    startSmsCron();
    startEmailCron();
    startLandlordReminderCron();
  });
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
