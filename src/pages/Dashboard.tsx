import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Home, DollarSign, FileText, Settings } from 'lucide-react';
import Layout from '@/components/Layout';

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const adminCards = [
    { title: t('buildings'), icon: Building, path: '/buildings', color: 'bg-blue-500' },
    { title: t('apartments'), icon: Home, path: '/apartments', color: 'bg-green-500' },
    { title: t('payments'), icon: DollarSign, path: '/payments', color: 'bg-yellow-500' },
    { title: t('expenses'), icon: FileText, path: '/expenses', color: 'bg-red-500' },
    { title: t('reports'), icon: FileText, path: '/reports', color: 'bg-purple-500' },
    { title: t('users'), icon: Settings, path: '/users', color: 'bg-indigo-500' },
    { title: t('settings'), icon: Settings, path: '/settings', color: 'bg-gray-500' },
  ];

  const userCards = [
    { title: t('apartments'), icon: Home, path: '/my-apartments', color: 'bg-green-500' },
    { title: t('reports'), icon: FileText, path: '/reports', color: 'bg-purple-500' },
  ];

  const cards = isAdmin ? adminCards : userCards;

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('welcomeBack')}, {user?.email}
          </p>
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

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          {t('poweredBy')} {t('buildingManagementSystem')}
        </footer>
      </div>
    </Layout>
  );
};

export default Dashboard;
