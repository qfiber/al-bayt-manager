import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import { runMigrations } from './seed.js';
import { startSubscriptionCron } from './services/subscription.service.js';

async function main() {
  try {
    await runMigrations();
  } catch (err) {
    logger.error(err, 'Migration failed');
    process.exit(1);
  }

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    startSubscriptionCron();
  });
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
