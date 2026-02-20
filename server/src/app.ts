import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import path from 'path';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.routes.js';
import { buildingRoutes } from './routes/buildings.routes.js';
import { apartmentRoutes } from './routes/apartments.routes.js';
import { paymentRoutes } from './routes/payments.routes.js';
import { expenseRoutes } from './routes/expenses.routes.js';
import { apartmentExpenseRoutes } from './routes/apartment-expenses.routes.js';
import { userRoutes } from './routes/users.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { brandingRoutes } from './routes/branding.routes.js';
import { auditLogRoutes } from './routes/audit-logs.routes.js';
import { apiKeyRoutes } from './routes/api-keys.routes.js';
import { generalInfoRoutes } from './routes/general-info.routes.js';
import { emailRoutes } from './routes/email.routes.js';
import { uploadRoutes } from './routes/upload.routes.js';
import { captchaRoutes } from './routes/captcha.routes.js';
import { reportRoutes } from './routes/reports.routes.js';
import { myApartmentRoutes } from './routes/my-apartments.routes.js';
import { v1Routes } from './routes/v1/index.js';
import { apiRateLimit, v1RateLimit } from './middleware/rate-limit.js';

export function createApp() {
  const app = express();

  // Trust proxy for correct IP detection behind reverse proxy (needed for rate limiting)
  app.set('trust proxy', 1);

  // Global middleware
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(pinoHttp({
    logger,
    genReqId: () => crypto.randomUUID(),
    autoLogging: { ignore: (req) => req.url === '/api/health' },
  }));
  app.use(express.json());

  // Static uploads — with security headers to prevent XSS via uploaded files
  app.use('/api/uploads', (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'");
    next();
  }, express.static(path.resolve(env.UPLOAD_DIR)));

  // Rate limiting
  app.use('/api', apiRateLimit);
  app.use('/api/v1', v1RateLimit);

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/buildings', buildingRoutes);
  app.use('/api/apartments', apartmentRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/apartment-expenses', apartmentExpenseRoutes);
  app.use('/api/my-apartments', myApartmentRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/branding', brandingRoutes);
  app.use('/api/audit-logs', auditLogRoutes);
  app.use('/api/api-keys', apiKeyRoutes);
  app.use('/api/general-info', generalInfoRoutes);
  app.use('/api/email', emailRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/captcha', captchaRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/v1', v1Routes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
