import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileBottomNav } from './MobileBottomNav';
import {
  LayoutDashboard,
  Building2,
  Home,
  CreditCard,
  Receipt,
  FileText,
  ChevronDown,
  LogOut,
  Globe,
  Users,
  Settings,
  Key,
  Shield,
  Mail,
  MailOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Language } from '@/lib/i18n';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavLink {
  label: string;
  path: string;
  icon: React.ElementType;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, isAdmin, isModerator, loading, signOut } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  const isActive = (path: string) => location.pathname === path;

  // Primary nav links (shown directly in top bar)
  const primaryLinks: NavLink[] = isAdmin
    ? [
        { label: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
        { label: t('buildings'), path: '/buildings', icon: Building2 },
        { label: t('apartments'), path: '/apartments', icon: Home },
        { label: t('payments'), path: '/payments', icon: CreditCard },
        { label: t('expenses'), path: '/expenses', icon: Receipt },
        { label: t('reports'), path: '/reports', icon: FileText },
      ]
    : isModerator
    ? [
        { label: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
        { label: t('payments'), path: '/payments', icon: CreditCard },
        { label: t('expenses'), path: '/expenses', icon: Receipt },
        { label: t('reports'), path: '/reports', icon: FileText },
        { label: t('auditLogs'), path: '/audit-logs', icon: Shield },
      ]
    : [
        { label: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
        { label: t('myApartments'), path: '/my-apartments', icon: Home },
      ];

  // Admin-only dropdown items
  const adminDropdownLinks: NavLink[] = [
    { label: t('users'), path: '/users', icon: Users },
    { label: t('settings'), path: '/settings', icon: Settings },
    { label: t('apiKeys'), path: '/api-keys', icon: Key },
    { label: t('auditLogs'), path: '/audit-logs', icon: Shield },
    { label: t('emailTemplates'), path: '/email-templates', icon: Mail },
    { label: t('emailLogs'), path: '/email-logs', icon: MailOpen },
  ];

  const languages: { code: Language; label: string }[] = [
    { code: 'ar', label: 'العربية' },
    { code: 'he', label: 'עברית' },
    { code: 'en', label: 'English' },
  ];

  const adminDropdownActive = adminDropdownLinks.some((l) => isActive(l.path));

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Top Nav */}
      {!isMobile && (
        <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="container mx-auto flex h-14 items-center gap-4 px-4">
            {/* Logo / App name */}
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 font-semibold text-foreground shrink-0"
            >
              <Building2 className="h-5 w-5 text-primary" />
              <span className="hidden lg:inline">{t('buildingManagementSystem')}</span>
            </button>

            {/* Nav links — center */}
            <nav className="flex items-center gap-1 mx-auto">
              {primaryLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isActive(link.path)
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {link.label}
                </button>
              ))}

              {/* Admin dropdown */}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                        adminDropdownActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      {t('administration')}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={dir === 'rtl' ? 'end' : 'start'} className="w-48">
                    {adminDropdownLinks.map((link) => (
                      <DropdownMenuItem
                        key={link.path}
                        onClick={() => navigate(link.path)}
                        className={isActive(link.path) ? 'bg-primary/10 text-primary' : ''}
                      >
                        <link.icon className="h-4 w-4 me-2" />
                        {link.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>

            {/* End: language + user */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Language switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Globe className="h-4 w-4" />
                    <span className="text-xs uppercase">{language}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={language === lang.code ? 'bg-primary/10 text-primary' : ''}
                    >
                      {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 max-w-[160px]">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                      {(user.name || user.email || '?')[0].toUpperCase()}
                    </div>
                    <span className="truncate text-sm hidden lg:inline">
                      {user.name || user.email}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm">
                    <div className="font-medium truncate">{user.name || user.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 me-2" />
                    {t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex h-12 items-center justify-between px-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 font-semibold text-foreground"
            >
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-sm">{t('buildingManagementSystem')}</span>
            </button>

            <div className="flex items-center gap-1">
              {/* Language switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Globe className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={language === lang.code ? 'bg-primary/10 text-primary' : ''}
                    >
                      {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                      {(user.name || user.email || '?')[0].toUpperCase()}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-sm">
                    <div className="font-medium truncate">{user.name || user.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 me-2" />
                    {t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className={`${isMobile ? 'pb-20' : ''}`}>
        {children}
      </main>

      {/* Footer */}
      {!isMobile && (
        <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          {t('footerPoweredBy')}{' '}
          <a
            href="https://qfiber.co.il"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            qFiber LTD
          </a>
        </footer>
      )}

      {/* Mobile bottom nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};
