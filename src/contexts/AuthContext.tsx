import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '@/lib/api';

interface UserData {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  preferredLanguage?: string;
  role: string;
  totpFactors?: { id: string; status: string; friendlyName?: string }[];
}

interface AuthContextType {
  user: UserData | null;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{
    error?: any;
    requires2FA?: boolean;
    sessionToken?: string;
  }>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isModerator = user?.role === 'moderator';

  const fetchUser = useCallback(async () => {
    if (!auth.isAuthenticated()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await auth.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const refreshUser = async () => {
    await fetchUser();
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await auth.login(email, password);

      if (result.requires2FA) {
        return {
          requires2FA: true,
          sessionToken: result.sessionToken,
        };
      }

      // Cookies set by server
      await fetchUser();
      navigate('/dashboard');
      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    try {
      await auth.register(email, password, name, phone);
      // Auto-login after registration
      const loginResult = await auth.login(email, password);
      if (!loginResult.requires2FA) {
        await fetchUser();
        navigate('/dashboard');
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Registration failed' };
    }
  };

  const signOut = async () => {
    await auth.logout();
    setUser(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isModerator, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
