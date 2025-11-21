import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Home, DollarSign, FileText, Settings } from 'lucide-react';

const Dashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    { title: t('settings'), icon: Settings, path: '/settings', color: 'bg-gray-500' },
  ];

  const userCards = [
    { title: t('apartments'), icon: Home, path: '/my-apartments', color: 'bg-green-500' },
    { title: t('reports'), icon: FileText, path: '/reports', color: 'bg-purple-500' },
  ];

  const cards = isAdmin ? adminCards : userCards;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {user.email}
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
                  Click to manage {card.title.toLowerCase()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          {t('poweredBy')} Building Management System
        </footer>
      </div>
    </div>
  );
};

export default Dashboard;
