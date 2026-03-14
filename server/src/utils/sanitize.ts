/**
 * Strip HTML tags from a string to prevent XSS.
 * Keeps text content only.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML entities for safe rendering.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize a string field: trim whitespace and strip HTML tags.
 */
export function sanitizeString(input: string): string {
  return stripHtml(input).trim();
}

// Fields where we preserve content (no HTML stripping) but still validate safety
const SENSITIVE_FIELDS = new Set([
  'password', 'newPassword', 'currentPassword', 'confirmPassword',
  'secret', 'token', 'code', 'nonce',
  'resendApiKey', 'stripeSecretKey', 'stripeWebhookSecret', 'stripePublishableKey',
  'cardcomApiPassword', 'paypalClientSecret', 'paypalClientId',
  'twilioAuthToken', 'twilioAccountSid', 'smsApiToken', 'turnstileSecretKey',
]);

/**
 * Sanitize a sensitive field: no HTML stripping (preserves special chars like <>)
 * but validates against SQL injection patterns and null bytes.
 */
export function sanitizeSensitiveField(input: string): string {
  // Remove null bytes (used in some injection attacks)
  let clean = input.replace(/\0/g, '');
  // Remove unicode direction override characters (BiDi attack)
  clean = clean.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
  return clean;
}

/**
 * Recursively sanitize all string values in an object.
 * Regular fields: strips HTML tags (XSS prevention).
 * Sensitive fields (passwords, API keys): preserves content but removes null bytes and BiDi chars.
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      (result as any)[key] = SENSITIVE_FIELDS.has(key)
        ? sanitizeSensitiveField(value)
        : sanitizeString(value);
    } else if (Array.isArray(value)) {
      (result as any)[key] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      (result as any)[key] = sanitizeObject(value);
    }
  }
  return result;
}
