import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { auditLogs, organizations } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

type AuditAction = 'login' | 'logout' | 'signup' | 'create' | 'update' | 'delete' | 'role_change' | 'password_change' | 'api_key_created' | 'api_key_deleted' | 'failed_login' | 'account_locked' | 'rate_limited' | 'unauthorized_access';

// Fields that should never appear in audit logs
const SENSITIVE_FIELDS = [
  'password', 'newPassword', 'adminPassword', 'confirmPassword',
  'resendApiKey', 'turnstileSecretKey',
  'token', 'refreshToken', 'code', 'secret',
  'keyHash', 'key', 'htmlBody', 'smsApiToken',
];

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

export function auditLog(actionType: AuditAction, tableName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Capture original json method to log after response
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only log successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const recordId = req.params.id || body?.id;
        db.insert(auditLogs)
          .values({
            userId: req.user.userId,
            userEmail: req.user.email,
            actionType,
            tableName,
            recordId: recordId?.toString(),
            actionDetails: { method: req.method, path: req.path, body: sanitizeBody(req.body) },
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent']?.slice(0, 500),
          })
          .catch((err) => logger.error(err, 'Audit log error'));

        // Update org last activity
        if (req.organizationId) {
          db.update(organizations)
            .set({ lastActivityAt: new Date() })
            .where(eq(organizations.id, req.organizationId))
            .catch(() => {});

          // Fire webhooks
          import('../services/webhook.service.js').then(({ fireWebhook }) => {
            fireWebhook(req.organizationId!, `${actionType}.${tableName || 'unknown'}`, {
              userId: req.user?.userId,
              recordId: recordId?.toString() || undefined,
            }).catch(() => {});
          });

          // Send real-time notification via SSE
          import('../routes/sse.routes.js').then(({ broadcastToOrg }) => {
            broadcastToOrg(req.organizationId!, `${actionType}.${tableName || 'unknown'}`, {
              userId: req.user?.userId,
              userEmail: req.user?.email,
              action: actionType,
              tableName,
              recordId,
              timestamp: new Date().toISOString(),
            });
          }).catch(() => {});
        }
      }
      return originalJson(body);
    };

    next();
  };
}
