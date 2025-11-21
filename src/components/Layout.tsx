import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Building } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchLogo = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('logo_url')
        .limit(1)
        .single();
      
      if (!error && data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    };
    
    fetchLogo();
    
    // Subscribe to settings changes for real-time updates
    const channel = supabase
      .channel('settings-logo-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'logo_url' in payload.new) {
            setLogoUrl(payload.new.logo_url as string);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
              {logoUrl ? (
                <div className="h-12 w-auto flex items-center">
                  <img src={logoUrl} alt="Logo" className="h-full max-w-[150px] object-contain" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building className="w-6 h-6 text-primary" />
                </div>
              )}
              <h1 className="text-xl font-bold">{t('buildingManagementSystem')}</h1>
            </div>
            <Button onClick={signOut} variant="outline">
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
};

export default Layout;
