import { solveChallenge, type PowProgress } from './pow.js';

const API_URL = import.meta.env.VITE_API_URL || '/api';

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Prevent any browser/proxy/SW caching of API requests
  headers['Cache-Control'] = 'no-cache, no-store';
  headers['Pragma'] = 'no-cache';

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  // Auto-refresh on 401 (skip for auth endpoints — let the actual error through)
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
        cache: 'no-store',
      });
    } else {
      // Only redirect from authenticated pages
      // Check if current page requires auth (dashboard, buildings, etc.)
      const authenticatedPrefixes = ['/dashboard', '/buildings', '/apartments', '/payments', '/expenses', '/reports', '/settings', '/users', '/api-keys', '/audit-logs', '/email-', '/my-apartments', '/my-inspections', '/profile', '/bulk-', '/documents', '/portfolio', '/meetings', '/debt-', '/organizations', '/super-admin', '/landlords', '/messages', '/invoices', '/leases', '/inspections', '/handbook', '/subscription-plans'];
      const isAuthPage = authenticatedPrefixes.some(p => window.location.pathname.startsWith(p));
      if (isAuthPage) {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(res.status, error.error || 'Request failed', error.details);
  }

  // Handle empty responses
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// HTTP methods
export const api = {
  get: <T = any>(path: string) => request<T>(path),

  post: <T = any>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  upload: <T = any>(path: string, file: File, fieldName = 'file') => {
    const formData = new FormData();
    formData.append(fieldName, file);
    return request<T>(path, { method: 'POST', body: formData });
  },
};

// Auth helpers
export const auth = {
  login: async (email: string, password: string, onPowProgress?: (p: PowProgress) => void) => {
    const pow = await solveChallenge(onPowProgress);
    return api.post<{
      success?: boolean;
      requires2FA?: boolean;
      sessionToken?: string;
    }>('/auth/login', { email, password, ...pow });
  },

  login2FA: async (sessionToken: string, code: string) => {
    return api.post<{ success: boolean }>('/auth/login/2fa', { sessionToken, code });
  },

  register: async (email: string, password: string, name: string, phone?: string, organizationName?: string, organizationSubdomain?: string) => {
    const pow = await solveChallenge();
    return api.post('/auth/register', { email, password, name, phone, organizationName, organizationSubdomain, ...pow });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
  },

  getMe: () => api.get('/auth/me'),

  isAuthenticated: () => document.cookie.split(';').some(c => c.trim().startsWith('session=')),
};
