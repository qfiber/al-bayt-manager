import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FileText, DollarSign, TrendingUp, RotateCcw } from 'lucide-react';

interface BuildingStats {
  buildingId: string;
  buildingName: string;
  totalApartments: number;
  occupiedApartments: number;
  totalDebt: string;
  totalCredit: string;
}

interface MonthlyData {
  month: string;
  payments: number;
  expenses: number;
}

const Reports = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState<{ category: string; amount: number }[]>([]);
  const [buildingStats, setBuildingStats] = useState<BuildingStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchReportsData();
    }
  }, [user, startDate, endDate]);

  const buildQuery = (base: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const fetchReportsData = async () => {
    try {
      const [summary, buildings, trends, categories] = await Promise.all([
        api.get(buildQuery('/reports/summary')),
        api.get('/reports/buildings'),
        api.get('/reports/monthly-trends'),
        api.get(buildQuery('/reports/expenses-by-category')),
      ]);

      setTotalRevenue(parseFloat(summary.payments.totalPayments));
      setTotalExpenses(parseFloat(summary.expenses.totalExpenses));
      setBuildingStats(buildings);
      setExpensesByCategory(categories.map((c: any) => ({
        category: c.category || 'Uncategorized',
        amount: parseFloat(c.total),
      })));

      // Merge payment and expense trends by month
      const monthMap = new Map<string, { payments: number; expenses: number }>();
      trends.payments?.forEach((p: any) => {
        const existing = monthMap.get(p.month) || { payments: 0, expenses: 0 };
        monthMap.set(p.month, { ...existing, payments: parseFloat(p.total) });
      });
      trends.expenses?.forEach((e: any) => {
        const existing = monthMap.get(e.month) || { payments: 0, expenses: 0 };
        monthMap.set(e.month, { ...existing, expenses: parseFloat(e.total) });
      });
      setMonthlyData(
        Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({ month, payments: data.payments, expenses: data.expenses })),
      );
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user) return null;

  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('reports')}</h1>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('dateRange')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="text-sm text-muted-foreground mb-1 block">{t('startDate')}</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1 w-full">
                <label className="text-sm text-muted-foreground mb-1 block">{t('endDate')}</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {(startDate || endDate) && (
                <Button variant="outline" size="sm" onClick={handleResetFilters} className="gap-1">
                  <RotateCcw className="h-4 w-4" />
                  {t('resetFilters')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalRevenue')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₪{totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{t('fromAllPayments')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('totalExpenses')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₪{totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{t('allCategories')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('netIncome')}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₪{netIncome.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">{t('revenueMinusExpenses')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Building Financial Reports */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">{t('buildingFinancialReports')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildingStats.map((building) => {
              const debt = parseFloat(building.totalDebt);
              const credit = parseFloat(building.totalCredit);
              return (
                <Card key={building.buildingId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{building.buildingName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('occupancy')}</span>
                      <span className="font-medium">{building.occupiedApartments}/{building.totalApartments}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('totalOverpayment')}</span>
                      <span className="font-medium text-green-600">₪{credit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('outstandingDebt')}</span>
                      <span className="font-medium text-red-600">₪{debt.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <span className="text-sm font-semibold">{t('netBalance')}</span>
                      <span className={`font-bold ${credit - debt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₪{(credit - debt).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('combinedExpensesByCategory')}</CardTitle>
            </CardHeader>
            <CardContent>
              {expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={expensesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `₪${value.toFixed(2)}`} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {t('noExpenseData')}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('buildingOccupancy')}</CardTitle>
            </CardHeader>
            <CardContent>
              {buildingStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={buildingStats.map(b => ({
                    buildingName: b.buildingName,
                    occupied: b.occupiedApartments,
                    vacant: b.totalApartments - b.occupiedApartments,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="buildingName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="occupied" fill="hsl(var(--primary))" name={t('occupied')} />
                    <Bar dataKey="vacant" fill="hsl(var(--muted))" name={t('vacant')} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {t('noBuildingData')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('monthlyRevenueVsExpenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `₪${value.toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="payments" stroke="hsl(var(--primary))" name={t('revenue')} strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" name={t('expenses')} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t('noTrendData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
