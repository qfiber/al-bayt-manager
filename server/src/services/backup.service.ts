import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const MAX_BACKUPS = 7; // Keep last 7 backups

export async function createBackup(): Promise<string> {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  // Parse DATABASE_URL
  const dbUrl = new URL(env.DATABASE_URL);
  const host = dbUrl.hostname;
  const port = dbUrl.port || '5432';
  const dbName = dbUrl.pathname.slice(1);
  const user = dbUrl.username;
  const password = dbUrl.password;

  try {
    const childEnv = { ...process.env, PGPASSWORD: password };
    const pgDump = spawn('pg_dump', ['-h', host, '-p', port, '-U', user, dbName], { env: childEnv });
    const gzip = createGzip();
    const output = fs.createWriteStream(filepath);

    await pipeline(pgDump.stdout!, gzip, output);
    logger.info({ filepath }, 'Database backup created');

    // Cleanup old backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.sql.gz'))
      .sort()
      .reverse();

    for (const old of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      logger.info({ file: old }, 'Old backup deleted');
    }

    return filepath;
  } catch (err) {
    logger.error(err, 'Database backup failed');
    throw err;
  }
}
