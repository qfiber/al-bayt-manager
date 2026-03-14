import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database.js';
import { organizations } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

// Cache org lookups for 5 minutes to avoid DB hits on every request
const orgCache = new Map<string, { org: any; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

declare global {
  namespace Express {
    interface Request {
      subdomainOrg?: {
        id: string;
        name: string;
        subdomain: string;
      };
    }
  }
}

function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];

  // Split by dots
  const parts = hostname.split('.');

  // Need at least 3 parts (sub.domain.tld) or 4 for sub.domain.co.il
  // Skip 'app', 'www', 'api' as they're reserved
  const reserved = ['app', 'www', 'api', 'mail', 'smtp', 'ftp'];

  if (parts.length >= 3) {
    const sub = parts[0];
    if (!reserved.includes(sub) && sub !== 'localhost') {
      return sub;
    }
  }

  return null;
}

export async function resolveSubdomain(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const host = req.get('host') || '';
    const subdomain = extractSubdomain(host);

    if (!subdomain) {
      next();
      return;
    }

    // Check cache
    const cached = orgCache.get(subdomain);
    if (cached && cached.expiresAt > Date.now()) {
      req.subdomainOrg = cached.org;
      next();
      return;
    }

    // Look up org by subdomain
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        subdomain: organizations.subdomain,
      })
      .from(organizations)
      .where(eq(organizations.subdomain, subdomain))
      .limit(1);

    if (org && org.subdomain) {
      req.subdomainOrg = { id: org.id, name: org.name, subdomain: org.subdomain };
      orgCache.set(subdomain, { org: req.subdomainOrg, expiresAt: Date.now() + CACHE_TTL });
    }

    next();
  } catch (err) {
    next(err);
  }
}
