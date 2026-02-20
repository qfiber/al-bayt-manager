import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  MoreHorizontal,
  Home,
  FileText,
  Settings,
  Users,
  Key,
  Shield,
  Mail,
  MailOpen,
  Receipt,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

export const MobileBottomNav = () => {
  const { isAdmin, isModerator } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const allAdminItems: NavItem[] = [
    { label: t('dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { label: t('buildings'), icon: Building2, path: '/buildings' },
    { label: t('apartments'), icon: Home, path: '/apartments' },
    { label: t('payments'), icon: CreditCard, path: '/payments' },
    { label: t('expenses'), icon: Receipt, path: '/expenses' },
    { label: t('reports'), icon: FileText, path: '/reports' },
    { label: t('users'), icon: Users, path: '/users' },
    { label: t('settings'), icon: Settings, path: '/settings' },
    { label: t('apiKeys'), icon: Key, path: '/api-keys' },
    { label: t('auditLogs'), icon: Shield, path: '/audit-logs' },
    { label: t('emailTemplates'), icon: Mail, path: '/email-templates' },
    { label: t('emailLogs'), icon: MailOpen, path: '/email-logs' },
  ];

  const allModeratorItems: NavItem[] = [
    { label: t('dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { label: t('payments'), icon: CreditCard, path: '/payments' },
    { label: t('expenses'), icon: Receipt, path: '/expenses' },
    { label: t('reports'), icon: FileText, path: '/reports' },
    { label: t('auditLogs'), icon: Shield, path: '/audit-logs' },
  ];

  const userItems: NavItem[] = [
    { label: t('dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { label: t('myApartments'), icon: Home, path: '/my-apartments' },
  ];

  const allItems = isAdmin ? allAdminItems : isModerator ? allModeratorItems : userItems;

  // Show first 3 items in bottom bar, rest in "More" sheet
  const showMore = allItems.length > 4;
  const visibleItems = showMore ? allItems.slice(0, 3) : allItems;
  const moreItems = showMore ? allItems.slice(3) : [];

  const handleNavigate = (path: string) => {
    navigate(path);
    setSheetOpen(false);
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16">
        {visibleItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNavigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-xs transition-colors ${
              isActive(item.path)
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate max-w-[64px]">{item.label}</span>
          </button>
        ))}

        {showMore && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-xs transition-colors ${
                  moreItems.some((item) => isActive(item.path))
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>{t('more')}</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[60vh]">
              <SheetHeader>
                <SheetTitle>{t('menu')}</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-4 py-4">
                {moreItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs text-center leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
};
