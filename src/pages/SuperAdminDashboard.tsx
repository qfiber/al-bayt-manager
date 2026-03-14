import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import {
  Building2, Users, Home, TrendingUp, Shield, Plus, Settings, ArrowRight,
  Activity, ShieldAlert, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

interface DashboardData {
  kpis: {
    organizations: { total: number; active: number; inactive: number };
    users: { total: number };
    buildings: { total: number };
    apartments: { total: number; occupied: number; vacant: number };
    revenue: { total: string };
  };
  orgGrowth: { month: string; new: number; cumulative: number }[];
  revenueByOrg: { id: string; name: string; revenue: string }[];
  recentOrgs: {
    id: string; name: string; isActive: boolean; createdAt: string;
    memberCount: number; buildingCount: number;
  }[];
  recentAuditLogs: {
    id: string; userEmail: string | null; actionType: string;
    tableName: string | null; createdAt: string;
  }[];
  systemHealth: {
    active_users_24h: number;
    failed_logins_24h: number;
    rate_limited_24h: number;
  };
}

const SuperAdminDashboard = () => {
  useRequireAuth('admin');
  const { user, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && isSuperAdmin) {
      api.get<DashboardData>('/super-admin/dashboard')
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user, isSuperAdmin]);

  if (!user || !isSuperAdmin) return null;

  const occupancyData = data ? [
    { name: t('occupied'), value: data.kpis.apartments.occupied },
    { name: t('vacant'), value: data.kpis.apartments.vacant },
  ] : [];

  const occupancyPct = data && data.kpis.apartments.total > 0
    ? Math.round((data.kpis.apartments.occupied / data.kpis.apartments.total) * 100)
    : 0;

  return (
    <div className="container mx-auto px-3 py-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {t('superAdminDashboard')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('welcomeBack')}, {user.name || user.email}
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-xs gap-1">
          <Shield className="h-3 w-3" />
          {t('superAdmin')}
        </Badge>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6"><div className="h-16" /></CardContent>
            </Card>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg bg-violet-50 text-violet-600 shrink-0">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('organizations')}</p>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{data.kpis.organizations.total}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {data.kpis.organizations.active} {t('active')} / {data.kpis.organizations.inactive} {t('inactive')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('totalUsers')}</p>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{data.kpis.users.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg bg-sky-50 text-sky-600 shrink-0">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('totalBuildings')}</p>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{data.kpis.buildings.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <Home className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('apartments')}</p>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">{data.kpis.apartments.total}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {occupancyPct}% {t('occupied')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1">
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{t('systemRevenue')}</p>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5">
                    {formatCurrency(parseFloat(data.kpis.revenue.total))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Org Growth */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('organizationsGrowth')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.orgGrowth.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.orgGrowth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cumulative" name={t('total')} stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="new" name={t('newOrganizations')} stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">{t('noData')}</div>
              )}
            </CardContent>
          </Card>

          {/* Revenue by Org */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('revenueByOrganization')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.revenueByOrg.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.revenueByOrg}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => formatCurrency(parseFloat(value))} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">{t('noData')}</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Occupancy + Recent Orgs */}
      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Occupancy Donut */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('occupancyRate')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.kpis.apartments.total > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={occupancyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {occupancyData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-3xl font-bold">{occupancyPct}%</p>
                      <p className="text-xs text-muted-foreground">{t('occupied')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">{t('noData')}</div>
              )}
            </CardContent>
          </Card>

          {/* Recent Organizations */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{t('recentOrganizations')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/organizations')} className="text-xs gap-1">
                {t('viewAll')} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t('nameLabel')}</TableHead>
                    <TableHead className="text-xs">{t('members')}</TableHead>
                    <TableHead className="text-xs">{t('buildings')}</TableHead>
                    <TableHead className="text-xs">{t('status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrgs.map((org) => (
                    <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/organizations')}>
                      <TableCell className="text-sm font-medium">{org.name}</TableCell>
                      <TableCell className="text-sm tabular-nums">{org.memberCount}</TableCell>
                      <TableCell className="text-sm tabular-nums">{org.buildingCount}</TableCell>
                      <TableCell>
                        <Badge variant={org.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {org.isActive ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Revenue + System Health */}
      {!loading && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Orgs by Revenue */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('topOrgsByRevenue')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.revenueByOrg.filter(o => parseFloat(o.revenue) > 0).slice(0, 5).map((org, i) => (
                  <div key={org.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm font-medium">{org.name}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(parseFloat(org.revenue))}</span>
                  </div>
                ))}
                {data.revenueByOrg.filter(o => parseFloat(o.revenue) > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('noData')}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('systemHealth')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-emerald-50 text-emerald-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{t('activeUsers24h')}</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{data.systemHealth.active_users_24h}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${data.systemHealth.failed_logins_24h > 10 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{t('failedLogins24h')}</span>
                  </div>
                  <span className={`text-lg font-bold tabular-nums ${data.systemHealth.failed_logins_24h > 10 ? 'text-red-600' : ''}`}>
                    {data.systemHealth.failed_logins_24h}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${data.systemHealth.rate_limited_24h > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                      <Shield className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{t('rateLimited24h')}</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{data.systemHealth.rate_limited_24h}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      {!loading && data && data.recentAuditLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentAuditLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded bg-muted">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">
                        <span className="font-medium">{log.userEmail || '—'}</span>
                        {' — '}
                        <span className="text-muted-foreground">{log.actionType}</span>
                        {log.tableName && <span className="text-muted-foreground"> ({log.tableName})</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ms-2">{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/organizations')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-violet-50 text-violet-600">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t('createOrganization')}</p>
              <p className="text-xs text-muted-foreground">{t('createOrgDesc')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/organizations')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t('viewAllOrganizations')}</p>
              <p className="text-xs text-muted-foreground">{t('viewAllOrgsDesc')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/settings')}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-slate-50 text-slate-600">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t('systemSettings')}</p>
              <p className="text-xs text-muted-foreground">{t('systemSettingsDesc')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
