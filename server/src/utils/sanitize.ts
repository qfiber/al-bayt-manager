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

/**
 * Recursively sanitize all string values in an object.
 * Useful for sanitizing request bodies.
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      (result as any)[key] = sanitizeString(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      (result as any)[key] = sanitizeObject(value);
    }
  }
  return result;
}
