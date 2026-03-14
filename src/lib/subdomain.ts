// Configurable via env vars
const BASE_DOMAIN = import.meta.env.VITE_BASE_DOMAIN || ''; // e.g., 'al-bayt.com'
const ADMIN_SUBDOMAIN = import.meta.env.VITE_ADMIN_SUBDOMAIN || 'app'; // e.g., 'app' → app.al-bayt.com

const RESERVED_SUBDOMAINS = [ADMIN_SUBDOMAIN, 'www', 'api', 'mail', 'smtp', 'ftp'];

/**
 * Extract the org subdomain from the current hostname.
 * Returns null if on main domain, admin subdomain, or 'www'.
 */
export function getOrgSubdomain(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // localhost or IP — no subdomain
  if (parts.length < 3 || hostname === 'localhost') return null;

  const sub = parts[0];
  if (RESERVED_SUBDOMAINS.includes(sub)) return null;

  return sub;
}

/**
 * Check if we're on the main/marketing domain (no subdomain).
 */
export function isMainDomain(): boolean {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  if (hostname === 'localhost' || parts.length < 3) return true;

  const sub = parts[0];
  return sub === 'www' || !sub;
}

/**
 * Check if we're on the admin subdomain (super-admin).
 */
export function isAppSubdomain(): boolean {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  return parts.length >= 3 && parts[0] === ADMIN_SUBDOMAIN;
}

/**
 * Get the base domain for display (e.g., 'al-bayt.com').
 */
export function getBaseDomain(): string {
  if (BASE_DOMAIN) return BASE_DOMAIN;
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  return parts.slice(-2).join('.');
}
