import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Home,
  TrendingUp,
  AlertCircle,
  Plus,
  Shield,
  CreditCard,
  FileText,
  Users,
  Clock,
  Info,
  AlertTriangle,
  Wrench,
  User,
  Layers,
  FolderOpen,
  BarChart3,
  CalendarDays,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  ChevronRight,
  Receipt,
  CircleCheck,
  CircleAlert,
  Megaphone,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatDate } from '@/lib/utils';
import { GeneralInformationCard } from '@/components/GeneralInformationCard';
import { GeneralInformationDialog } from '@/components/GeneralInformationDialog';
import { toast } from 'sonner';

interface Summary {
  buildings: number;
  apartments: {
    total: number;
    occupied: number;
    vacant: number;
    totalDebt: string;
    totalCredit: string;
  };
  payments: {
    totalPayments: string;
    paymentCount: number;
  };
  expenses: {
    totalExpenses: string;
    expenseCount: number;
  };
}

interface BuildingReport {
  buildingId: string;
  buildingName: string;
  totalApartments: number;
  occupiedApartments: number;
  totalDebt: string;
  totalCredit: string;
}

interface MonthlyTrends {
  payments: { month: string; total: string }[];
  expenses: { month: string; total: string }[];
}

interface AuditEntry {
  id: string;
  userEmail: string | null;
  actionType: string;
  tableName: string | null;
  recordId: string | null;
  actionDetails: any;
  createdAt: string;
}

// formatCurrencyShort is defined inside component to use currencySymbol from context

const actionIcons: Record<string, React.ElementType> = {
  create: Plus,
  update: FileText,
  delete: AlertCircle,
  login: Shield,
  logout: Shield,
  signup: Users,
  role_change: Users,
  password_change: Shield,
  api_key_created: CreditCard,
  api_key_deleted: CreditCard,
};

function relativeTime(dateStr: string, language: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const labels: Record<string, Record<string, string>> = {
    ar: { m: 'دقيقة', h: 'ساعة', d: 'يوم', now: 'الآن' },
    he: { m: 'דקה', h: 'שעה', d: 'יום', now: 'עכשיו' },
    en: { m: 'min', h: 'hr', d: 'day', now: 'just now' },
  };
  const l = labels[language] || labels.en;

  if (diffMin < 1) return l.now;
  if (diffMin < 60) return `${diffMin} ${l.m}`;
  if (diffHr < 24) return `${diffHr} ${l.h}`;
  return `${diffDay} ${l.d}`;
}

const Dashboard = () => {
  useRequireAuth();

  const { user, isAdmin, isModerator } = useAuth();
  const { t, language, dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const { currencySymbol, formatCurrency } = useCurrency();
  const navigate = useNavigate();

  const formatCurrencyShort = (val: number) =>
    `${currencySymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<MonthlyTrends | null>(null);
  const [buildingsReport, setBuildingsReport] = useState<BuildingReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [generalInfo, setGeneralInfo] = useState<any[]>([]);
  const [openIssueCount, setOpenIssueCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInfoId, setSelectedInfoId] = useState<string | undefined>();
  const [dataLoading, setDataLoading] = useState(true);

  // Tenant dashboard state
  const [tenantApartments, setTenantApartments] = useState<any[]>([]);

  const canViewFinancials = isAdmin || isModerator;

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setDataLoading(true);
      try {
        const promises: Promise<any>[] = [
          api.get('/general-info'),
          api.get('/issues/count/open'),
        ];

        if (canViewFinancials) {
          promises.push(
            api.get('/reports/summary'),
            api.get('/reports/monthly-trends?months=12'),
            api.get('/reports/buildings'),
            api.get('/audit-logs?limit=5'),
          );
        }

        const results = await Promise.allSettled(promises);
        const getValue = (r: PromiseSettledResult<any>) =>
          r.status === 'fulfilled' ? r.value : null;

        setGeneralInfo(getValue(results[0]) || []);
        const issueCountData = getValue(results[1]);
        setOpenIssueCount(issueCountData?.count || 0);

        if (canViewFinancials) {
          setSummary(getValue(results[2]));
          setTrends(getValue(results[3]));
          setBuildingsReport(getValue(results[4]) || []);
          setAuditLogs(getValue(results[5]) || []);
        }

        // Tenant: fetch apartment details inline
        if (!canViewFinancials) {
          try {
            const apts: any[] = await api.get('/my-apartments');
            if (apts && apts.length > 0) {
              const withDetails = await Promise.all(
                apts.map(async (item: any) => {
                  try {
                    const details = await api.get(`/apartments/${item.apartment.id}/debt-details`);
                    return {
                      ...item.apartment,
                      buildingName: item.buildingName,
                      buildingAddress: item.buildingAddress,
                      payments: details.payments || [],
                      expenses: details.expenses || [],
                      balance: details.balance,
                    };
                  } catch {
                    return {
                      ...item.apartment,
                      buildingName: item.buildingName,
                      buildingAddress: item.buildingAddress,
                      payments: [],
                      expenses: [],
                      balance: parseFloat(item.apartment.cachedBalance),
                    };
                  }
                }),
              );
              setTenantApartments(withDetails);
            }
          } catch { /* silent */ }
        }
      } finally {
        setDataLoading(false);
      }
    };

    fetchAll();
  }, [user, canViewFinancials]);

  // Merge trends into chart data
  const chartData = useMemo(() => {
    if (!trends) return [];

    const map = new Map<string, { month: string; income: number; expenses: number }>();

    for (const p of trends.payments) {
      const entry = map.get(p.month) || { month: p.month, income: 0, expenses: 0 };
      entry.income = Number(p.total) || 0;
      map.set(p.month, entry);
    }
    for (const e of trends.expenses) {
      const entry = map.get(e.month) || { month: e.month, income: 0, expenses: 0 };
      entry.expenses = Number(e.total) || 0;
      map.set(e.month, entry);
    }

    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [trends]);

  // Buildings with outstanding debt
  const outstandingBuildings = useMemo(
    () =>
      buildingsReport
        .filter((b) => Number(b.totalDebt) > 0)
        .sort((a, b) => Number(b.totalDebt) - Number(a.totalDebt)),
    [buildingsReport],
  );

  // General info handlers
  const fetchGeneralInformation = async () => {
    try {
      const data = await api.get('/general-info');
      setGeneralInfo(data);
    } catch {
      // silently fail
    }
  };

  const handleDeleteInfo = async (id: string) => {
    try {
      await api.delete(`/general-info/${id}`);
      toast.success(t('deleteSuccess'));
      fetchGeneralInformation();
    } catch {
      toast.error(t('error'));
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

  if (!user) return null;

  // User role: rich tenant dashboard
  if (!canViewFinancials) {
    // Compute aggregate tenant stats
    const totalBalance = tenantApartments.reduce((sum, a) => sum + (typeof a.balance === 'number' ? a.balance : parseFloat(a.cachedBalance || '0')), 0);
    const totalPaid = tenantApartments.reduce((sum, a) => sum + (a.payments || []).filter((p: any) => !p.isCanceled).reduce((s: number, p: any) => s + parseFloat(p.amount), 0), 0);
    const totalExpenses = tenantApartments.reduce((sum, a) => sum + (a.expenses || []).filter((e: any) => !e.isCanceled).reduce((s: number, e: any) => s + parseFloat(e.amount), 0), 0);

    // Merge all transactions for recent activity
    const allTransactions = tenantApartments.flatMap((apt) => [
      ...(apt.payments || []).map((p: any) => ({
        id: p.id,
        date: p.createdAt,
        description: t('paymentForMonth').replace('{month}', p.month),
        type: 'payment' as const,
        amount: parseFloat(p.amount),
        isCanceled: p.isCanceled,
        aptNumber: apt.apartmentNumber,
      })),
      ...(apt.expenses || []).map((e: any) => ({
        id: e.id,
        date: e.createdAt,
        description: e.expenseDescription || t('buildingExpense'),
        type: 'expense' as const,
        amount: parseFloat(e.amount),
        isCanceled: e.isCanceled,
        aptNumber: apt.apartmentNumber,
      })),
    ]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

    // Loading skeleton for tenant dashboard
    if (dataLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-primary/[0.03] to-background">
          <div className="container mx-auto px-4 py-5 sm:p-6 max-w-lg sm:max-w-2xl space-y-5">
            <div className="animate-pulse space-y-5">
              <div className="flex items-center justify-between">
                <div><div className="h-7 w-40 bg-muted rounded-lg" /><div className="h-4 w-28 bg-muted rounded mt-2" /></div>
                <div className="h-9 w-9 bg-muted rounded-full" />
              </div>
              <div className="h-48 bg-muted rounded-2xl" />
              <div className="grid grid-cols-2 gap-3"><div className="h-28 bg-muted rounded-xl" /><div className="h-28 bg-muted rounded-xl" /></div>
              <div className="h-64 bg-muted rounded-xl" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/[0.03] to-background" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="container mx-auto px-4 py-5 sm:p-6 max-w-lg sm:max-w-2xl space-y-5">

          {/* ─── Header ─── */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{t('welcomeBack')}</h1>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{user.name || user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full shrink-0"
              onClick={() => navigate('/profile')}
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                {(user.name || user.email || '?')[0].toUpperCase()}
              </div>
            </Button>
          </div>

          {/* ─── Announcements / General Information ─── */}
          {generalInfo.length > 0 && (
            <div className="space-y-2.5">
              {generalInfo.map((info) => {
                const texts = [info.text1, info.text2, info.text3].filter(Boolean) as string[];
                return (
                  <div
                    key={info.id}
                    className="flex gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3.5 py-3"
                  >
                    <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-tight">{info.title}</p>
                      {texts.length > 0 && (
                        <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-1 leading-relaxed line-clamp-2">
                          {texts.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── Hero Balance Card ─── */}
          {tenantApartments.length > 0 && (
            <div className={`relative overflow-hidden rounded-2xl shadow-lg ${
              totalBalance >= 0
                ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700'
                : 'bg-gradient-to-br from-rose-500 via-rose-600 to-red-700'
            } text-white`}>
              {/* Decorative circles */}
              <div className="absolute -top-8 -end-8 h-32 w-32 rounded-full bg-white/[0.07]" />
              <div className="absolute -bottom-10 -start-10 h-28 w-28 rounded-full bg-white/[0.05]" />

              <div className="relative p-5 sm:p-7">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-white/80 text-xs font-medium uppercase tracking-wider">
                    <Wallet className="h-3.5 w-3.5" />
                    {t('accountBalance')}
                  </div>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${totalBalance >= 0 ? 'bg-white/20' : 'bg-white/15'}`}>
                    {totalBalance >= 0 ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                  </div>
                </div>

                <p className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {formatCurrency(Math.abs(totalBalance))}
                </p>
                <p className="text-white/70 text-xs mt-1.5 font-medium">
                  {totalBalance >= 0 ? t('inGoodStanding') : t('overdue')}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-white/20">
                  <div className="bg-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">{t('totalPaid')}</p>
                    <p className="text-base sm:text-lg font-bold flex items-center gap-1">
                      <ArrowUpRight className="h-3.5 w-3.5 text-white/60" />
                      {formatCurrency(totalPaid)}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1">{t('totalExpenses')}</p>
                    <p className="text-base sm:text-lg font-bold flex items-center gap-1">
                      <ArrowDownRight className="h-3.5 w-3.5 text-white/60" />
                      {formatCurrency(totalExpenses)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Quick Actions Row ─── */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Receipt, label: t('payments'), path: '/my-apartments', color: 'text-primary', bg: 'bg-primary/10' },
              { icon: AlertTriangle, label: t('issues'), path: '/issues', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40', badge: openIssueCount },
              { icon: User, label: t('profile'), path: '/profile', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
              { icon: Home, label: t('myApartments'), path: '/my-apartments', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
            ].map((action) => (
              <button
                key={action.path + action.label}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl active:scale-95 transition-transform"
              >
                <div className={`relative h-11 w-11 rounded-xl ${action.bg} flex items-center justify-center`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                  {action.badge ? (
                    <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {action.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight line-clamp-1">{action.label}</span>
              </button>
            ))}
          </div>

          {/* ─── Apartment Cards ─── */}
          {tenantApartments.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-0.5">
                <Home className="h-4 w-4" />
                {t('myApartments')}
              </h2>
              <div className="space-y-3">
                {tenantApartments.map((apt) => {
                  const bal = typeof apt.balance === 'number' ? apt.balance : parseFloat(apt.cachedBalance || '0');
                  const sub = parseFloat(apt.subscriptionAmount || '0');
                  const paidCount = (apt.payments || []).filter((p: any) => !p.isCanceled).length;
                  return (
                    <button
                      key={apt.id}
                      onClick={() => navigate('/my-apartments')}
                      className="w-full text-start rounded-xl border border-border/60 bg-card shadow-sm hover:shadow-md active:scale-[0.98] transition-all p-4 group"
                    >
                      <div className="flex items-center gap-3 mb-3.5">
                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0 shadow-sm">
                          {apt.apartmentNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{apt.buildingName}</p>
                          <p className="text-xs text-muted-foreground truncate">{apt.buildingAddress}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 rtl:rotate-180" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{t('balance')}</p>
                          <p className={`text-sm font-bold tabular-nums ${bal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatCurrency(bal)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{t('monthly')}</p>
                          <p className="text-sm font-bold tabular-nums">{formatCurrency(sub)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{t('payments')}</p>
                          <p className="text-sm font-bold tabular-nums">{paidCount}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Recent Activity ─── */}
          {allTransactions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('recentActivity')}
                </h2>
                <button onClick={() => navigate('/my-apartments')} className="text-xs text-primary font-medium">
                  {t('viewAll')}
                </button>
              </div>
              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden divide-y divide-border/40">
                {allTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3 active:bg-muted/40 transition-colors">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'payment'
                        ? tx.isCanceled ? 'bg-muted text-muted-foreground' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : tx.isCanceled ? 'bg-muted text-muted-foreground' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                    }`}>
                      {tx.type === 'payment' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${tx.isCanceled ? 'line-through text-muted-foreground' : ''}`}>
                        {tx.description}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDate(tx.date)} · #{tx.aptNumber}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                      tx.isCanceled ? 'text-muted-foreground' :
                      tx.type === 'payment' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {tx.type === 'payment' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom spacer for mobile nav */}
          <div className="h-2" />
        </div>
      </div>
    );
  }

  // Admin / Moderator financial dashboard
  const totalPayments = Number(summary?.payments.totalPayments) || 0;
  const totalExpenses = Number(summary?.expenses.totalExpenses) || 0;
  const totalDebt = Number(summary?.apartments.totalDebt) || 0;
  const totalApartments = summary?.apartments.total || 0;
  const occupiedApartments = summary?.apartments.occupied || 0;
  const occupancyPct = totalApartments > 0 ? ((occupiedApartments / totalApartments) * 100).toFixed(1) : '0';

  return (
    <div className="container mx-auto px-3 py-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('welcomeBack')}, {user.name || user.email}
        </p>
      </div>

      {/* KPI Cards */}
      {dataLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6"><div className="h-16" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Buildings */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{t('totalBuildings')}</p>
                  <p className="text-lg sm:text-2xl font-bold tabular-nums">{summary?.buildings ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Occupied Units */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <Home className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{t('occupiedUnits')}</p>
                  <p className="text-lg sm:text-2xl font-bold tabular-nums">{occupancyPct}%</p>
                  <p className="text-xs text-muted-foreground">
                    {occupiedApartments} / {totalApartments}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Income */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-violet-50 text-violet-600 shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{t('monthlyIncome')}</p>
                  <p className="text-lg sm:text-2xl font-bold tabular-nums">{formatCurrency(totalPayments)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Balance */}
          <Card className={totalDebt > 0 ? 'border-red-200 bg-red-50/30' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg shrink-0 ${totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{t('outstandingBalance')}</p>
                  <p className={`text-lg sm:text-2xl font-bold tabular-nums ${totalDebt > 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(totalDebt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart + Outstanding */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Income vs Expenses Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('incomeVsExpenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {t('noTrendData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 5, right: isRTL ? 0 : 10, left: isRTL ? 10 : 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    reversed={isRTL}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => {
                      const [y, m] = v.split('-');
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} orientation={isRTL ? 'right' : 'left'} tickFormatter={(v) => `${currencySymbol}${v}`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'income' ? t('totalIncome') : t('totalExpenses'),
                    ]}
                    labelFormatter={(label) => {
                      const [y, m] = label.split('-');
                      return `${m}/${y}`;
                    }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === 'income' ? t('totalIncome') : t('totalExpenses')
                    }
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Payments */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('outstandingBalance')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => navigate('/reports')}
              >
                {t('viewAll')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {outstandingBuildings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                <AlertCircle className="h-8 w-8 opacity-30" />
                {t('noOutstandingPayments')}
              </div>
            ) : (
              <div className="space-y-3 max-h-[260px] overflow-y-auto">
                {outstandingBuildings.map((b) => (
                  <div
                    key={b.buildingId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/buildings')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded bg-red-100 text-red-600 shrink-0">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.buildingName}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.occupiedApartments}/{b.totalApartments} {t('occupiedUnits').toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="tabular-nums shrink-0">
                      {formatCurrency(Number(b.totalDebt))}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issues & Maintenance Quick Nav */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/issues')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-orange-50 text-orange-700 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('issues')}</p>
                <p className="text-xs text-muted-foreground">{t('issueReports')}</p>
              </div>
              {openIssueCount > 0 && (
                <Badge variant="destructive" className="tabular-nums shrink-0">{openIssueCount}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/maintenance')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('maintenanceJobs')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Features Quick Nav */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
<Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/bulk-operations')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-50 text-cyan-600 shrink-0"><Layers className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('bulkOperations')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/documents')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0"><FolderOpen className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('documents')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/portfolio')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 shrink-0"><BarChart3 className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('portfolio')}</p>
                <p className="text-xs text-muted-foreground">{t('portfolioOverview')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/meetings')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 shrink-0"><CalendarDays className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('meetings')}</p>
                <p className="text-xs text-muted-foreground">{t('vaadBayit')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/debt-collection')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-red-50 text-red-600 shrink-0"><AlertCircle className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t('debtCollection')}</p>
                  <p className="text-xs text-muted-foreground">{t('collectionWorkflow')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('recentActivity')}</CardTitle>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => navigate('/audit-logs')}
              >
                {t('viewAll')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Clock className="h-8 w-8 opacity-30" />
              {t('noRecentActivity')}
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => {
                const Icon = actionIcons[log.actionType] || FileText;
                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="p-2 rounded bg-primary/10 text-primary shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{log.userEmail || t('system')}</span>
                        {' — '}
                        <span className="text-muted-foreground">
                          {log.actionType}
                          {log.tableName ? ` (${log.tableName})` : ''}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {relativeTime(log.createdAt, language)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Information Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{t('generalInformation')}</h2>
          </div>
          {isAdmin && (
            <Button onClick={handleAddInfo} size="sm">
              <Plus className="w-4 h-4 me-2" />
              {t('addInformation')}
            </Button>
          )}
        </div>
        {generalInfo.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              {t('noInformationAvailable')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generalInfo.map((info) => (
              <GeneralInformationCard
                key={info.id}
                id={info.id}
                title={info.title}
                text_1={info.text1}
                text_2={info.text2}
                text_3={info.text3}
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
    </div>
  );
};

export default Dashboard;
