import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t, language } = useLanguage();
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

  const canViewFinancials = isAdmin || isModerator;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  if (!user) return null;

  // User role: simple welcome view
  if (!canViewFinancials) {
    return (
      <div className="container mx-auto px-3 py-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('welcomeBack')}, {user.name || user.email}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/my-apartments')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <Home className="w-6 h-6" />
                </div>
                {t('myApartments')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('clickToManage')}</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/issues')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <span className="flex items-center gap-2">
                  {t('issues')}
                  {openIssueCount > 0 && (
                    <Badge variant="destructive" className="text-xs">{openIssueCount}</Badge>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('reportIssue')}</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/profile')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-violet-50 text-violet-600">
                  <User className="w-6 h-6" />
                </div>
                {t('profile')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('manageProfile')}</p>
            </CardContent>
          </Card>
        </div>

        {/* General Information */}
        {generalInfo.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-xl font-bold">{t('generalInformation')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generalInfo.map((info) => (
                <GeneralInformationCard
                  key={info.id}
                  id={info.id}
                  title={info.title}
                  text_1={info.text1}
                  text_2={info.text2}
                  text_3={info.text3}
                  isAdmin={false}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              ))}
            </div>
          </div>
        )}
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
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => {
                      const [y, m] = v.split('-');
                      return `${m}/${y.slice(2)}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${currencySymbol}${v}`} />
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
              <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 shrink-0">
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
