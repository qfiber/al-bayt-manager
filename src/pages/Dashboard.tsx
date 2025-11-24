import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Home, DollarSign, FileText, Settings, Key, Plus, Shield } from 'lucide-react';
import { GeneralInformationCard } from '@/components/GeneralInformationCard';
import { GeneralInformationDialog } from '@/components/GeneralInformationDialog';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user, isAdmin, isModerator, loading, signOut } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>('');
  const [generalInfo, setGeneralInfo] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInfoId, setSelectedInfoId] = useState<string | undefined>();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          setUserName(data.name);
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchGeneralInformation();
    }
  }, [user]);

  const fetchGeneralInformation = async () => {
    const { data, error } = await supabase
      .from('general_information')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) {
      setGeneralInfo(data);
    }
  };

  const handleDeleteInfo = async (id: string) => {
    const { error } = await supabase
      .from('general_information')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(t('error'));
    } else {
      toast.success(t('deleteSuccess'));
      fetchGeneralInformation();
    }
  };

  const handleEditInfo = (id: string) => {
    setSelectedInfoId(id);
    setDialogOpen(true);
  };

  const handleAddInfo = () => {
    setSelectedInfoId(undefined);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  if (!user) return null;

  const adminCards = [
    { title: t('buildings'), icon: Building, path: '/buildings', color: 'bg-blue-500' },
    { title: t('apartments'), icon: Home, path: '/apartments', color: 'bg-green-500' },
    { title: t('payments'), icon: DollarSign, path: '/payments', color: 'bg-yellow-500' },
    { title: t('expenses'), icon: FileText, path: '/expenses', color: 'bg-red-500' },
    { title: t('reports'), icon: FileText, path: '/reports', color: 'bg-purple-500' },
    { title: t('users'), icon: Settings, path: '/users', color: 'bg-indigo-500' },
    { title: t('settings'), icon: Settings, path: '/settings', color: 'bg-gray-500' },
    { title: t('apiKeys'), icon: Key, path: '/api-keys', color: 'bg-orange-500' },
    { title: t('auditLogs'), icon: Shield, path: '/audit-logs', color: 'bg-pink-500' },
  ];

  const userCards = [
    { title: t('apartments'), icon: Home, path: '/my-apartments', color: 'bg-green-500' },
    { title: t('reports'), icon: FileText, path: '/reports', color: 'bg-purple-500' },
  ];

  const moderatorCards = [
    { title: t('payments'), icon: DollarSign, path: '/payments', color: 'bg-yellow-500' },
    { title: t('expenses'), icon: FileText, path: '/expenses', color: 'bg-red-500' },
    { title: t('reports'), icon: FileText, path: '/reports', color: 'bg-purple-500' },
    { title: t('auditLogs'), icon: Shield, path: '/audit-logs', color: 'bg-pink-500' },
  ];

  const cards = isAdmin ? adminCards : isModerator ? moderatorCards : userCards;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
            <p className="text-muted-foreground mt-2">
              {t('welcomeBack')}, {userName || user.email}
            </p>
          </div>
          <Button onClick={signOut} variant="outline">
            {t('logout')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Card
              key={card.path}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(card.path)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${card.color} text-white`}>
                    <card.icon className="w-6 h-6" />
                  </div>
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('clickToManage')} {card.title.toLowerCase()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* General Information Section */}
        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{t('generalInformation')}</h2>
            {isAdmin && (
              <Button onClick={handleAddInfo}>
                <Plus className="w-4 h-4 mr-2" />
                {t('addInformation')}
              </Button>
            )}
          </div>
          {generalInfo.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t('noInformationAvailable')}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generalInfo.map((info) => (
                <GeneralInformationCard
                  key={info.id}
                  id={info.id}
                  title={info.title}
                  text_1={info.text_1}
                  text_2={info.text_2}
                  text_3={info.text_3}
                  isAdmin={isAdmin}
                  onEdit={handleEditInfo}
                  onDelete={handleDeleteInfo}
                />
              ))}
            </div>
          )}
        </div>

        <GeneralInformationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          informationId={selectedInfoId}
          onSuccess={fetchGeneralInformation}
        />

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          {language === 'ar' ? 'تصميم شركة ' : language === 'he' ? 'מופעל על ידי ' : 'Powered by '}
          <a 
            href="https://qfiber.co.il" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {language === 'ar' ? 'كيوفايبر' : language === 'he' ? 'qFiber בע״מ' : 'qFiber LTD'}
          </a>
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
