import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Building2, Home, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface PortfolioBuilding {
  buildingId: string;
  buildingName: string;
  totalApartments: number;
  occupiedApartments: number;
  occupancyRate: number;
  totalDebt: number;
  totalCredit: number;
  netBalance: number;
  paymentsThisMonth: number;
}

interface PortfolioSummary {
  totalBuildings: number;
  totalApartments: number;
  avgOccupancy: number;
  totalDebt: number;
  totalCredit: number;
  buildings: PortfolioBuilding[];
}

interface ExpenseBreakdown {
  buildingName: string;
  [category: string]: string | number;
}

type SortField = 'buildingName' | 'totalApartments' | 'occupiedApartments' | 'occupancyRate' | 'totalDebt' | 'totalCredit' | 'netBalance' | 'paymentsThisMonth';
type SortDirection = 'asc' | 'desc';

const Portfolio = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('buildingName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin && !isModerator) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, isModerator, loading, navigate]);

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchPortfolio();
      fetchExpenseBreakdown();
    }
  }, [user, isAdmin, isModerator]);

  const fetchPortfolio = async () => {
    try {
      const data = await api.get<PortfolioSummary>('/reports/portfolio');
      setPortfolio(data);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchExpenseBreakdown = async () => {
    try {
      const data = await api.get<{ breakdown: ExpenseBreakdown[]; categories: string[] }>('/reports/portfolio/expenses');
      setExpenseBreakdown(data?.breakdown || []);
      setExpenseCategories(data?.categories || []);
    } catch (err: any) {
      // Non-critical, silently handle
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedBuildings = useMemo(() => {
    if (!portfolio?.buildings) return [];
    return [...portfolio.buildings].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [portfolio?.buildings, sortField, sortDirection]);

  const debtChartData = useMemo(() => {
    if (!portfolio?.buildings) return [];
    return [...portfolio.buildings]
      .filter(b => b.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .map(b => ({
        name: b.buildingName,
        debt: b.totalDebt,
      }));
  }, [portfolio?.buildings]);

  const CHART_COLORS = [
    'hsl(var(--primary))',
    'hsl(var(--destructive))',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
  ];

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || (!isAdmin && !isModerator)) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('portfolio')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              {t('backToDashboard')}
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalBuildings')}</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portfolio?.totalBuildings ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalApartments')}</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portfolio?.totalApartments ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('avgOccupancy')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(portfolio?.avgOccupancy ?? 0).toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalDebt')}</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(portfolio?.totalDebt ?? 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalCredit')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(portfolio?.totalCredit ?? 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Building Comparison Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('buildingComparison')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('buildingName')}
                    >
                      {t('buildingName')}{renderSortIndicator('buildingName')}
                    </TableHead>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('totalApartments')}
                    >
                      {t('totalApartments')}{renderSortIndicator('totalApartments')}
                    </TableHead>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('occupiedApartments')}
                    >
                      {t('occupied')}{renderSortIndicator('occupiedApartments')}
                    </TableHead>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('occupancyRate')}
                    >
                      {t('occupancyRate')}{renderSortIndicator('occupancyRate')}
                    </TableHead>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('totalDebt')}
                    >
                      {t('debt')}{renderSortIndicator('totalDebt')}
                    </TableHead>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('totalCredit')}
                    >
                      {t('credit')}{renderSortIndicator('totalCredit')}
                    </TableHead>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('netBalance')}
                    >
                      {t('netBalance')}{renderSortIndicator('netBalance')}
                    </TableHead>
                    <TableHead
                      className="text-start cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort('paymentsThisMonth')}
                    >
                      {t('paymentsThisMonth')}{renderSortIndicator('paymentsThisMonth')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBuildings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        {t('noBuildingData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedBuildings.map((b) => (
                      <TableRow key={b.buildingId}>
                        <TableCell className="font-medium text-start">{b.buildingName}</TableCell>
                        <TableCell className="text-start">{b.totalApartments}</TableCell>
                        <TableCell className="text-start">{b.occupiedApartments}</TableCell>
                        <TableCell className="text-start">{b.occupancyRate.toFixed(1)}%</TableCell>
                        <TableCell className="text-start text-red-600">{formatCurrency(b.totalDebt)}</TableCell>
                        <TableCell className="text-start text-green-600">{formatCurrency(b.totalCredit)}</TableCell>
                        <TableCell className={`text-start font-medium ${b.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(b.netBalance)}
                        </TableCell>
                        <TableCell className="text-start">{formatCurrency(b.paymentsThisMonth)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Debt Ranking Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t('debtRanking')}</CardTitle>
            </CardHeader>
            <CardContent>
              {debtChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(300, debtChartData.length * 50)}>
                  <BarChart data={debtChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value: number) => formatCurrency(value)} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="debt" fill="hsl(var(--destructive))" name={t('debt')} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {t('noDebtData')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Breakdown Stacked Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t('expenseBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              {expenseBreakdown.length > 0 && expenseCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={expenseBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="buildingName" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value: number) => formatCurrency(value)} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    {expenseCategories.map((category, idx) => (
                      <Bar
                        key={category}
                        dataKey={category}
                        stackId="expenses"
                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        name={category}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {t('noExpenseData')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
