import { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

const isProduction = env.NODE_ENV === 'production';

function parseExpiryMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([mhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  const [, num, unit] = match;
  const ms = { m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return parseInt(num) * ms;
}

const accessMaxAge = parseExpiryMs(env.JWT_ACCESS_EXPIRY);
const refreshMaxAge = parseExpiryMs(env.JWT_REFRESH_EXPIRY);

const baseCookieOptions: CookieOptions = {
  sameSite: 'strict',
  secure: isProduction,
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, {
    ...baseCookieOptions,
    httpOnly: true,
    path: '/api',
    maxAge: accessMaxAge,
  });

  res.cookie('refresh_token', refreshToken, {
    ...baseCookieOptions,
    httpOnly: true,
    path: '/api/auth',
    maxAge: refreshMaxAge,
  });

  // Non-secret flag for frontend auth state check
  res.cookie('session', '1', {
    ...baseCookieOptions,
    httpOnly: false,
    path: '/',
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { ...baseCookieOptions, httpOnly: true, path: '/api' });
  res.clearCookie('refresh_token', { ...baseCookieOptions, httpOnly: true, path: '/api/auth' });
  res.clearCookie('session', { ...baseCookieOptions, httpOnly: false, path: '/' });
}
