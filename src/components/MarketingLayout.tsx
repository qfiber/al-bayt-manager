import { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Building2, Menu, X, ArrowRight, Mail, Globe } from 'lucide-react';

export const MarketingLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { companyName, logoUrl } = usePublicSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: t('features'), href: '/#features' },
    { label: t('pricingNav'), href: '/pricing' },
    { label: t('faqNav'), href: '/faq' },
    { label: t('contactNav'), href: '/contact' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName || 'Al-Bayt Manager'} className="h-8 w-auto" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-xl">{companyName || 'Al-Bayt'}</span>
                </>
              )}
            </a>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  onClick={(e) => {
                    if (link.href.startsWith('/')) { e.preventDefault(); navigate(link.href); }
                  }}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              {user ? (
                <Button onClick={() => navigate('/dashboard')} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('dashboard')}</Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/login')} className="hidden sm:inline-flex">{t('signIn')}</Button>
                  <Button onClick={() => navigate('/register')} className="bg-gradient-to-r from-blue-600 to-indigo-600">{t('landingGetStarted')}</Button>
                </>
              )}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-gray-100 dark:border-gray-800 mt-2 pt-4">
              {navLinks.map(link => (
                <a key={link.href} href={link.href}
                  className="block py-2 text-sm text-gray-600 dark:text-gray-300"
                  onClick={(e) => { setMobileMenuOpen(false); if (link.href.startsWith('/')) { e.preventDefault(); navigate(link.href); } }}
                >{link.label}</a>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">{companyName || 'Al-Bayt Manager'}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('footerTagline')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('product')}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="/#features" className="hover:text-gray-900 dark:hover:text-white">{t('features')}</a></li>
                <li><a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing'); }} className="hover:text-gray-900 dark:hover:text-white">{t('pricingNav')}</a></li>
                <li><a href="/faq" onClick={(e) => { e.preventDefault(); navigate('/faq'); }} className="hover:text-gray-900 dark:hover:text-white">{t('faqNav')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('company')}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }} className="hover:text-gray-900 dark:hover:text-white">{t('contactNav')}</a></li>
                <li><a href="/privacy-policy" className="hover:text-gray-900 dark:hover:text-white">{t('privacyPolicy')}</a></li>
                <li><a href="/terms" className="hover:text-gray-900 dark:hover:text-white">{t('termsOfUsage')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('contactNav')}</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> info@albayt.cloud</li>
                <li className="flex items-center gap-2"><Globe className="w-4 h-4" /> albayt.cloud</li>
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
