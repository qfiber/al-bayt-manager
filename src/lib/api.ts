import { solveChallenge } from './pow.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function getTokens(): TokenPair | null {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

function setTokens(tokens: TokenPair) {
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

let refreshPromise: Promise<TokenPair | null> | null = null;

async function refreshTokens(): Promise<TokenPair | null> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const tokens = getTokens();
    if (!tokens) return null;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const data = await res.json();
      setTokens(data);
      return data;
    } catch {
      clearTokens();
      return null;
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
  const tokens = getTokens();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (tokens?.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && tokens) {
    const newTokens = await refreshTokens();
    if (newTokens) {
      headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } else {
      // Refresh failed - redirect to login
      clearTokens();
      window.location.href = '/auth';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(res.status, error.error || 'Request failed', error.details);
  }

  // Handle empty responses (204)
  if (res.status === 204) return undefined as T;

  return res.json();
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
  login: async (email: string, password: string) => {
    const pow = await solveChallenge();
    const result = await api.post<{
      accessToken?: string;
      refreshToken?: string;
      requires2FA?: boolean;
      sessionToken?: string;
    }>('/auth/login', { email, password, ...pow });

    if (result.accessToken && result.refreshToken) {
      setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    }

    return result;
  },

  login2FA: async (sessionToken: string, code: string) => {
    const result = await api.post<TokenPair>('/auth/login/2fa', { sessionToken, code });
    setTokens(result);
    return result;
  },

  register: async (email: string, password: string, name: string, phone?: string) => {
    const pow = await solveChallenge();
    return api.post('/auth/register', { email, password, name, phone, ...pow });
  },

  logout: async () => {
    const tokens = getTokens();
    if (tokens?.refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken: tokens.refreshToken });
      } catch {
        // Ignore errors on logout
      }
    }
    clearTokens();
  },

  getMe: () => api.get('/auth/me'),

  isAuthenticated: () => !!getTokens()?.accessToken,

  setTokens,
  clearTokens,
  getTokens,
};
