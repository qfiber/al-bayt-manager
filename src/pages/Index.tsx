import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Shield, BarChart3, Users, Globe, CreditCard, FileText, Wrench, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const { companyName, logoUrl } = usePublicSettings();

  // If already logged in, go to dashboard
  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const features = [
    { icon: Building2, title: t('landingFeatureBuildings'), desc: t('landingFeatureBuildingsDesc') },
    { icon: CreditCard, title: t('landingFeaturePayments'), desc: t('landingFeaturePaymentsDesc') },
    { icon: BarChart3, title: t('landingFeatureReports'), desc: t('landingFeatureReportsDesc') },
    { icon: Users, title: t('landingFeatureTenants'), desc: t('landingFeatureTenantsDesc') },
    { icon: Wrench, title: t('landingFeatureMaintenance'), desc: t('landingFeatureMaintenanceDesc') },
    { icon: FileText, title: t('landingFeatureDocuments'), desc: t('landingFeatureDocumentsDesc') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName || 'Al-Bayt Manager'} className="h-8 w-auto" />
            ) : (
              <Building2 className="h-8 w-8 text-primary" />
            )}
            <span className="text-xl font-bold">{companyName || 'Al-Bayt Manager'}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(['ar', 'he', 'en'] as const).map((lang) => (
                <Button
                  key={lang}
                  variant={language === lang ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setLanguage(lang)}
                  className="text-xs px-2"
                >
                  {lang === 'ar' ? 'ع' : lang === 'he' ? 'עב' : 'EN'}
                </Button>
              ))}
            </div>
            <Button onClick={() => navigate('/login')}>
              {t('signIn')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          {t('landingHeroTitle')}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          {t('landingHeroSubtitle')}
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button size="lg" onClick={() => navigate('/login')} className="gap-2">
            {t('landingGetStarted')}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/register')}>
            {t('landingCreateAccount')}
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">{t('landingFeaturesTitle')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <feature.icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-12">
            <h2 className="text-3xl font-bold mb-4">{t('landingCtaTitle')}</h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">{t('landingCtaSubtitle')}</p>
            <Button size="lg" variant="secondary" onClick={() => navigate('/register')} className="gap-2">
              {t('landingCreateAccount')}
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{companyName || 'Al-Bayt Manager'} &copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex gap-4 text-sm">
              <a href="/privacy-policy" className="text-muted-foreground hover:text-foreground">{t('privacyPolicy')}</a>
              <a href="/terms" className="text-muted-foreground hover:text-foreground">{t('termsOfUsage')}</a>
              <a href="/accessibility" className="text-muted-foreground hover:text-foreground">{t('accessibility')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
