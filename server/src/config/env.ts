import crypto from 'crypto';
import { z } from 'zod';

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32).default(generateSecret()),
  JWT_REFRESH_SECRET: z.string().min(32).default(generateSecret()),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  CORS_ORIGIN: z.string().default('http://localhost:8080'),
  POW_DIFFICULTY: z.coerce.number().default(20),
  POW_CHALLENGE_TTL_MS: z.coerce.number().default(300000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set — using auto-generated secret (will change on restart)');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    console.warn('WARNING: JWT_REFRESH_SECRET not set — using auto-generated secret (will change on restart)');
  }

  return result.data;
}

export const env = loadEnv();
