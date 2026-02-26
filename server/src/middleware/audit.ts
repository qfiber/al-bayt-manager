import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { auditLogs } from '../db/schema/index.js';

type AuditAction = 'create' | 'update' | 'delete' | 'role_change' | 'password_change' | 'api_key_created' | 'api_key_deleted';

// Fields that should never appear in audit logs
const SENSITIVE_FIELDS = [
  'password', 'newPassword', 'adminPassword', 'confirmPassword',
  'resendApiKey', 'turnstileSecretKey',
  'token', 'refreshToken', 'code', 'secret',
  'keyHash', 'key', 'htmlBody',
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
      }
      return originalJson(body);
    };

    next();
  };
}
