import { db } from '../config/database.js';
import { auditLogs } from '../db/schema/index.js';
import { logger } from '../config/logger.js';

type SecurityEventType = 'failed_login' | 'account_locked' | 'rate_limited' | 'unauthorized_access';

interface SecurityEvent {
  eventType: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

/**
 * Log a security event to both the audit log table and the structured logger.
 * Fire-and-forget — never throws.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const { eventType, userId, email, ipAddress, userAgent, details } = event;

  // Structured log for log aggregation / SIEM
  logger.warn({
    securityEvent: eventType,
    userId,
    email,
    ipAddress,
    details,
  }, `Security event: ${eventType}`);

  // Persist to audit_logs table
  db.insert(auditLogs)
    .values({
      userId,
      userEmail: email,
      actionType: eventType as any,
      tableName: 'security',
      actionDetails: details,
      ipAddress,
      userAgent: userAgent?.slice(0, 500),
    })
    .catch((err) => logger.error(err, 'Failed to log security event'));
}
