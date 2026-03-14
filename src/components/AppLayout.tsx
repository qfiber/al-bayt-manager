import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileBottomNav } from './MobileBottomNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LegalFooter } from '@/components/LegalFooter';
import { formatDate } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Home,
  CreditCard,
  Receipt,
  FileText,
  ChevronDown,
  LogOut,
  Users,
  Settings,
  Key,
  Shield,
  Bell,
  Mail,
  MailOpen,
  AlertTriangle,
  Wrench,
  User,
  Moon,
  Sun,
  ScrollText,
  ClipboardCheck,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppLayoutProps {
  children: ReactNode;
}

interface NavLink {
  label: string;
  path: string;
  icon: React.ElementType;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, isAdmin, isModerator, isSuperAdmin, loading, signOut } = useAuth();
  const { t, dir } = useLanguage();
  const { logoUrl, companyName } = usePublicSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { theme, setTheme, isDark } = useTheme();
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [lastSeenKey] = useState(() => `notif_last_seen_${user?.id || ''}`);

  const fetchNotifCount = () => {
    const lastSeen = localStorage.getItem(lastSeenKey);
    const url = lastSeen ? `/notifications/count?since=${encodeURIComponent(lastSeen)}` : '/notifications/count';
    api.get<{ count: number }>(url)
      .then(data => setNotifCount(data.count))
      .catch(() => {});
    api.get('/notifications').then(setNotifications).catch(() => {});
  };

  const handleNotifClick = () => {
    localStorage.setItem(lastSeenKey, new Date().toISOString());
    setNotifCount(0);
    navigate('/audit-logs');
  };

  useEffect(() => {
    if (user) {
      fetchNotifCount();
      const interval = setInterval(fetchNotifCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

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

  // Super-admin gets a completely separate nav
  const primaryLinks: NavLink[] = isSuperAdmin
    ? [
        { label: t('superAdminDashboard'), path: '/super-admin', icon: Shield },
        { label: t('organizations'), path: '/organizations', icon: Building2 },
        { label: t('landlords'), path: '/landlords', icon: Users },
        { label: t('auditLogs'), path: '/audit-logs', icon: Shield },
      ]
    : isAdmin
    ? [
        { label: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
        { label: t('buildings'), path: '/buildings', icon: Building2 },
        { label: t('apartments'), path: '/apartments', icon: Home },
        { label: t('payments'), path: '/payments', icon: CreditCard },
        { label: t('expenses'), path: '/expenses', icon: Receipt },
        { label: t('reports'), path: '/reports', icon: FileText },
        { label: t('issues'), path: '/issues', icon: AlertTriangle },
        { label: t('messages'), path: '/messages', icon: MessageSquare },
      ]
    : isModerator
    ? [
        { label: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
        { label: t('payments'), path: '/payments', icon: CreditCard },
        { label: t('expenses'), path: '/expenses', icon: Receipt },
        { label: t('reports'), path: '/reports', icon: FileText },
        { label: t('issues'), path: '/issues', icon: AlertTriangle },
        { label: t('maintenanceJobs'), path: '/maintenance', icon: Wrench },
        { label: t('auditLogs'), path: '/audit-logs', icon: Shield },
      ]
    : [
        { label: t('dashboard'), path: '/dashboard', icon: LayoutDashboard },
        { label: t('myApartments'), path: '/my-apartments', icon: Home },
        { label: t('issues'), path: '/issues', icon: AlertTriangle },
        { label: t('myInspections'), path: '/my-inspections', icon: ClipboardCheck },
        { label: t('messages'), path: '/messages', icon: MessageSquare },
      ];

  // Admin-only dropdown items
  const adminDropdownLinks: NavLink[] = isSuperAdmin
    ? [
        { label: t('users'), path: '/users', icon: Users },
        { label: t('settings'), path: '/settings', icon: Settings },
        { label: t('notificationTemplates'), path: '/email-templates', icon: Bell },
        { label: t('emailLogs'), path: '/email-logs', icon: MailOpen },
        { label: t('apiKeys'), path: '/api-keys', icon: Key },
      ]
    : [
        { label: t('maintenanceJobs'), path: '/maintenance', icon: Wrench },
        { label: t('invoices'), path: '/invoices', icon: FileText },
        { label: t('leases'), path: '/leases', icon: ScrollText },
        { label: t('inspections'), path: '/inspections', icon: ClipboardCheck },
        { label: t('users'), path: '/users', icon: Users },
        { label: t('settings'), path: '/settings', icon: Settings },
        { label: t('apiKeys'), path: '/api-keys', icon: Key },
        { label: t('auditLogs'), path: '/audit-logs', icon: Shield },
        { label: t('notificationTemplates'), path: '/email-templates', icon: Bell },
        { label: t('emailLogs'), path: '/email-logs', icon: MailOpen },
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
              onClick={() => navigate(isSuperAdmin ? '/super-admin' : '/dashboard')}
              className="flex items-center gap-2 font-semibold text-foreground shrink-0"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-7 max-w-[120px] object-contain" />
              ) : (
                <Building2 className="h-5 w-5 text-primary" />
              )}
              <span className="hidden lg:inline">
                {companyName || t('buildingManagementSystem')}
              </span>
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

            {/* End: theme toggle + notification bell + language + user */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Theme toggle */}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Notification bell dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Bell className="h-4 w-4" />
                    {notifCount > 0 && (
                      <span className="absolute -top-0.5 -end-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                        {notifCount > 99 ? '99+' : notifCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="px-3 py-2 flex items-center justify-between border-b">
                    <span className="text-sm font-medium">{t('notifications')}</span>
                    <Button variant="ghost" size="sm" className="text-xs h-6" onClick={handleNotifClick}>
                      {t('viewAll')}
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">{t('noNotifications')}</div>
                    ) : (
                      notifications.slice(0, 8).map((n: any) => (
                        <div key={n.id} className="px-3 py-2 text-xs border-b last:border-0 hover:bg-muted/50">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{n.userEmail || '—'}</span>
                            <span className="text-muted-foreground">{formatDate(n.createdAt)}</span>
                          </div>
                          <span className="text-muted-foreground">{n.actionType}{n.tableName ? ` (${n.tableName})` : ''}</span>
                        </div>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <LanguageSwitcher />

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
                    {user.organizationName && (
                      <div className="text-xs text-primary truncate mt-0.5">{user.organizationName}</div>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="h-4 w-4 me-2" />
                    {t('profile')}
                  </DropdownMenuItem>
                  {user.organizationId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={async () => {
                        try {
                          const orgs = await api.get<any[]>('/auth/my-organizations');
                          if (orgs.length <= 1) return;
                          const currentIdx = orgs.findIndex((o: any) => o.organizationId === user.organizationId);
                          const nextOrg = orgs[(currentIdx + 1) % orgs.length];
                          await api.post('/auth/switch-organization', { organizationId: nextOrg.organizationId });
                          window.location.reload();
                        } catch {}
                      }}>
                        <Building2 className="h-4 w-4 me-2" />
                        {t('switchOrganization')}
                      </DropdownMenuItem>
                    </>
                  )}
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
              onClick={() => navigate(isSuperAdmin ? '/super-admin' : '/dashboard')}
              className="flex items-center gap-2 font-semibold text-foreground"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-6 max-w-[100px] object-contain" />
              ) : (
                <Building2 className="h-5 w-5 text-primary" />
              )}
              <span className="text-sm truncate max-w-[140px]">
                {companyName || t('buildingManagementSystem')}
              </span>
            </button>

            <div className="flex items-center gap-1">
              {/* Theme toggle (mobile) */}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Notification bell (mobile) */}
              <button
                onClick={handleNotifClick}
                className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Bell className="h-4 w-4" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </button>

              <LanguageSwitcher variant="icon" />

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
                    {user.organizationName && (
                      <div className="text-xs text-primary truncate mt-0.5">{user.organizationName}</div>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="h-4 w-4 me-2" />
                    {t('profile')}
                  </DropdownMenuItem>
                  {user.organizationId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={async () => {
                        try {
                          const orgs = await api.get<any[]>('/auth/my-organizations');
                          if (orgs.length <= 1) return;
                          const currentIdx = orgs.findIndex((o: any) => o.organizationId === user.organizationId);
                          const nextOrg = orgs[(currentIdx + 1) % orgs.length];
                          await api.post('/auth/switch-organization', { organizationId: nextOrg.organizationId });
                          window.location.reload();
                        } catch {}
                      }}>
                        <Building2 className="h-4 w-4 me-2" />
                        {t('switchOrganization')}
                      </DropdownMenuItem>
                    </>
                  )}
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
        <footer className="border-t border-border py-4 px-6 text-xs text-muted-foreground">
          <div className="container mx-auto flex items-center justify-between">
            <LegalFooter variant="spread" />
          </div>
        </footer>
      )}

      {/* Mobile bottom nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};
