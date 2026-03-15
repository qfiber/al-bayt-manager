import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  Building2, CreditCard, BarChart3, Users, Wrench, FileText,
  ArrowRight, Menu, X, Shield, Globe, Clock, Zap, Mail,
  Moon, Sun, Home, PieChart, CheckCircle2,
} from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, loading } = useAuth();
  const { companyName, logoUrl } = usePublicSettings();
  const { isDark, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: companyName || 'Al-Bayt Manager',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: t('landingHeroSubtitle'),
    url: 'https://albayt.cloud',
    provider: {
      '@type': 'Organization',
      name: 'qFiber LTD',
      url: 'https://qfiber.co.il',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'ILS',
      price: '0',
      description: t('landingBadge'),
    },
  };

  useSeo({
    title: `${companyName || 'Al-Bayt Manager'} — ${t('landingHeroTitle')}`,
    description: t('landingHeroSubtitle'),
    path: '/',
    jsonLd,
  });

  if (loading) return null;

  const isRtl = language === 'ar' || language === 'he';

  const navLinks = [
    { label: t('features'), href: '#features' },
    { label: t('howItWorks'), href: '#how-it-works' },
    { label: t('pricingNav'), href: '/pricing' },
    { label: t('faqNav'), href: '/faq' },
    { label: t('contactNav'), href: '/contact' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName || 'Al-Bayt Manager'} className="h-8 w-auto" />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-xl">{companyName || 'Al-Bayt'}</span>
                </div>
              )}
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  onClick={(e) => {
                    if (link.href.startsWith('/')) {
                      e.preventDefault();
                      navigate(link.href);
                    }
                  }}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:block">
                <LanguageSwitcher variant="icon" />
              </div>

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {user ? (
                <Button onClick={() => navigate('/dashboard')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  {t('dashboard')}
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/login')} className="hidden sm:inline-flex">
                    {t('signIn')}
                  </Button>
                  <Button onClick={() => navigate('/register')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                    {t('landingGetStarted')}
                  </Button>
                </>
              )}

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-gray-100 dark:border-gray-800 mt-2 pt-4 space-y-2">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block py-2 text-sm text-gray-600 dark:text-gray-300"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    if (link.href.startsWith('/')) { e.preventDefault(); navigate(link.href); }
                  }}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <LanguageSwitcher />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-950 dark:via-blue-950/20 dark:to-indigo-950/20" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm mb-8">
            <Zap className="w-4 h-4" />
            {t('landingBadge')}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">
            {t('landingHeroTitle')}
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            {t('landingHeroSubtitle')}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/register')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg px-8 py-6 rounded-xl shadow-lg shadow-blue-500/25 gap-2">
              {t('landingGetStarted')}
              <ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/pricing')}
              className="text-lg px-8 py-6 rounded-xl border-2">
              {t('viewPricing')}
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('landingCtaMicro')}</p>
        </div>
      </section>

      {/* Who Is It For */}
      <section className="py-16 sm:py-24 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{t('whoIsItForTitle')}</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{t('whoIsItForSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Home, title: t('forLandlords'), desc: t('forLandlordsDesc'), color: 'from-blue-500 to-blue-600' },
              { icon: Building2, title: t('forPropertyManagers'), desc: t('forPropertyManagersDesc'), color: 'from-emerald-500 to-emerald-600' },
              { icon: Users, title: t('forBuildingCommittees'), desc: t('forBuildingCommitteesDesc'), color: 'from-violet-500 to-violet-600' },
            ].map((item, i) => (
              <div key={i} className="text-center p-8 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${item.color} shadow-lg mb-5`}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{t('landingFeaturesTitle')}</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{t('landingFeaturesSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Building2, title: t('landingFeatureBuildings'), desc: t('landingFeatureBuildingsDesc'), color: 'from-blue-500 to-blue-600' },
              { icon: CreditCard, title: t('landingFeaturePayments'), desc: t('landingFeaturePaymentsDesc'), color: 'from-emerald-500 to-emerald-600' },
              { icon: BarChart3, title: t('landingFeatureReports'), desc: t('landingFeatureReportsDesc'), color: 'from-violet-500 to-violet-600' },
              { icon: Users, title: t('landingFeatureTenants'), desc: t('landingFeatureTenantsDesc'), color: 'from-amber-500 to-amber-600' },
              { icon: Wrench, title: t('landingFeatureMaintenance'), desc: t('landingFeatureMaintenanceDesc'), color: 'from-rose-500 to-rose-600' },
              { icon: FileText, title: t('landingFeatureDocuments'), desc: t('landingFeatureDocumentsDesc'), color: 'from-cyan-500 to-cyan-600' },
            ].map((feature, i) => (
              <div key={i} className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 transition-all hover:shadow-xl hover:-translate-y-1">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{t('howItWorksTitle')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700" />

            {[
              { step: '01', title: t('step1Title'), desc: t('step1Desc'), icon: Globe },
              { step: '02', title: t('step2Title'), desc: t('step2Desc'), icon: Building2 },
              { step: '03', title: t('step3Title'), desc: t('step3Desc'), icon: BarChart3 },
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-lg mb-6 shadow-lg shadow-blue-500/25 relative z-10">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Preview — Visual Dashboard Mockup */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{t('productPreviewTitle')}</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{t('productPreviewSubtitle')}</p>
          </div>

          {/* Mock Dashboard UI */}
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-block px-4 py-1 rounded-md bg-white dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    albayt.cloud/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6 space-y-5">
                {/* KPI row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: t('previewDashboard'), value: '12', sub: t('buildings'), color: 'text-blue-600 dark:text-blue-400' },
                    { label: t('previewPayments'), value: '₪48,250', sub: t('thisMonth'), color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: t('occupancyRate'), value: '94%', sub: t('occupied'), color: 'text-violet-600 dark:text-violet-400' },
                    { label: t('openIssues'), value: '3', sub: t('pending'), color: 'text-amber-600 dark:text-amber-400' },
                  ].map((kpi, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/50">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{kpi.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Chart + table row */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  {/* Mini chart mockup */}
                  <div className="sm:col-span-3 rounded-xl border border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">{t('previewReports')}</p>
                    <div className="flex items-end gap-1 h-24">
                      {[40, 65, 45, 80, 60, 90, 70, 85, 55, 95, 75, 88].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-blue-500 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 opacity-80" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>

                  {/* Mini table mockup */}
                  <div className="sm:col-span-2 rounded-xl border border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">{t('recentPayments')}</p>
                    <div className="space-y-2">
                      {[
                        { apt: 'A-101', amount: '₪2,400', status: 'text-emerald-500' },
                        { apt: 'B-205', amount: '₪1,800', status: 'text-emerald-500' },
                        { apt: 'C-304', amount: '₪3,100', status: 'text-amber-500' },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">{row.apt}</span>
                          <span className={`font-medium ${row.status}`}>{row.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow effect behind the mockup */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/20 via-indigo-400/20 to-purple-400/20 rounded-3xl blur-2xl -z-10" />
          </div>
        </div>
      </section>

      {/* Trust / Security */}
      <section className="py-16 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: Shield, label: t('trustSecurity') },
              { icon: Globe, label: t('trustMultilingual') },
              { icon: Clock, label: t('trustUptime') },
              { icon: Zap, label: t('trustFast') },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="p-3 rounded-full bg-gray-50 dark:bg-gray-900">
                  <item.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-12 sm:p-16 text-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-30" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t('landingCtaTitle')}</h2>
              <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto">{t('landingCtaSubtitle')}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" onClick={() => navigate('/register')}
                  className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6 rounded-xl gap-2 font-semibold">
                  {t('landingCreateAccount')}
                  <ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/contact')}
                  className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 rounded-xl">
                  {t('contactUs')}
                </Button>
              </div>
              <p className="mt-4 text-sm text-blue-200">{t('landingCtaMicro')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">{companyName || 'Al-Bayt Manager'}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('footerTagline')}</p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('product')}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">{t('features')}</a></li>
                <li><button onClick={() => navigate('/pricing')} className="hover:text-gray-900 dark:hover:text-white transition-colors">{t('pricingNav')}</button></li>
                <li><button onClick={() => navigate('/faq')} className="hover:text-gray-900 dark:hover:text-white transition-colors">{t('faqNav')}</button></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('company')}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><button onClick={() => navigate('/contact')} className="hover:text-gray-900 dark:hover:text-white transition-colors">{t('contactNav')}</button></li>
                <li><button onClick={() => navigate('/privacy-policy')} className="hover:text-gray-900 dark:hover:text-white transition-colors">{t('privacyPolicy')}</button></li>
                <li><button onClick={() => navigate('/terms')} className="hover:text-gray-900 dark:hover:text-white transition-colors">{t('termsOfUsage')}</button></li>
                <li><button onClick={() => navigate('/accessibility')} className="hover:text-gray-900 dark:hover:text-white transition-colors">{t('accessibility')}</button></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('contactNav')}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0" /> info@qfiber.co.il</li>
                <li className="flex items-center gap-2"><Globe className="w-4 h-4 shrink-0" /> qfiber.co.il</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} {companyName || 'Al-Bayt Manager'}. {t('allRightsReserved')}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
