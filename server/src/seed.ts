import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './config/database.js';
import { logger } from './config/logger.js';

export async function runMigrations() {
  logger.info('Running database migrations...');
  await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname });
  logger.info('Migrations complete');
}
