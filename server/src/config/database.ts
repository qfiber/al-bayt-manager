import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';
import * as schema from '../db/schema/index.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: env.DB_SSL === 'true' ? true
     : env.DB_SSL === 'no-verify' ? { rejectUnauthorized: false }
     : false,
});

pool.on('error', (err) => {
  logger.error(err, 'Unexpected pool error');
});

export const db = drizzle(pool, { schema });
export { pool };
