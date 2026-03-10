import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function useRequireAuth(role?: 'admin' | 'admin-or-moderator'): void {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (role === 'admin' && !isAdmin) {
      navigate('/dashboard');
    } else if (role === 'admin-or-moderator' && !isAdmin && !isModerator) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, isModerator, loading, navigate, role]);
}
