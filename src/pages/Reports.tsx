import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FileText, DollarSign, TrendingUp, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaymentStats {
  total: number;
  paid: number;
}

interface ExpenseByCategory {
  category: string;
  amount: number;
}

interface BuildingStats {
  buildingName: string;
  totalApartments: number;
  occupied: number;
  vacant: number;
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

  const [paymentStats, setPaymentStats] = useState<PaymentStats>({ total: 0, paid: 0 });
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategory[]>([]);
  const [buildingStats, setBuildingStats] = useState<BuildingStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted))', 'hsl(var(--accent))'];

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchReportsData();
    }
  }, [user]);

  const fetchReportsData = async () => {
    try {
      await Promise.all([
        fetchPaymentStats(),
        fetchExpensesByCategory(),
        fetchBuildingStats(),
        fetchMonthlyTrends(),
      ]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const fetchPaymentStats = async () => {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('amount');

    if (error) throw error;

    const stats = payments?.reduce(
      (acc, payment) => {
        acc.total += payment.amount;
        acc.paid += payment.amount;
        return acc;
      },
      { total: 0, paid: 0 }
    ) || { total: 0, paid: 0 };

    setPaymentStats(stats);
    setTotalRevenue(stats.paid);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Financial Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Summary section
    doc.setFontSize(14);
    doc.text('Summary', 14, 45);
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Amount (₪)']],
      body: [
        ['Total Revenue', `₪${totalRevenue.toFixed(2)}`],
        ['Total Expenses', `₪${totalExpenses.toFixed(2)}`],
        ['Net Income', `₪${(totalRevenue - totalExpenses).toFixed(2)}`],
      ],
    });
    
    // Expenses by category
    if (expensesByCategory.length > 0) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Expenses by Category', 14, 22);
      autoTable(doc, {
        startY: 28,
        head: [['Category', 'Amount (₪)']],
        body: expensesByCategory.map(exp => [exp.category, `₪${exp.amount.toFixed(2)}`]),
      });
    }
    
    // Building occupancy
    if (buildingStats.length > 0) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Building Occupancy', 14, 22);
      autoTable(doc, {
        startY: 28,
        head: [['Building', 'Total', 'Occupied', 'Vacant']],
        body: buildingStats.map(b => [
          b.buildingName,
          b.totalApartments.toString(),
          b.occupied.toString(),
          b.vacant.toString(),
        ]),
      });
    }
    
    doc.save('financial-report.pdf');
  };

  const fetchExpensesByCategory = async () => {
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('category, amount');

    if (error) throw error;

    const categoryMap = new Map<string, number>();
    let total = 0;

    expenses?.forEach(expense => {
      const category = expense.category || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + expense.amount);
      total += expense.amount;
    });

    const categoryData = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    }));

    setExpensesByCategory(categoryData);
    setTotalExpenses(total);
  };

  const fetchBuildingStats = async () => {
    const { data: buildings, error: buildingError } = await supabase
      .from('buildings')
      .select('id, name');

    if (buildingError) throw buildingError;

    const stats = await Promise.all(
      (buildings || []).map(async (building) => {
        const { data: apartments } = await supabase
          .from('apartments')
          .select('status')
          .eq('building_id', building.id);

        const total = apartments?.length || 0;
        const occupied = apartments?.filter(a => a.status === 'occupied').length || 0;
        const vacant = total - occupied;

        return {
          buildingName: building.name,
          totalApartments: total,
          occupied,
          vacant,
        };
      })
    );

    setBuildingStats(stats);
  };

  const fetchMonthlyTrends = async () => {
    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('month, amount')
      .order('month', { ascending: true })
      .limit(6);

    const { data: expenses, error: expenseError } = await supabase
      .from('expenses')
      .select('expense_date, amount')
      .order('expense_date', { ascending: true })
      .limit(6);

    if (paymentError || expenseError) throw paymentError || expenseError;

    const monthMap = new Map<string, { payments: number; expenses: number }>();

    payments?.forEach(payment => {
      const month = payment.month;
      const existing = monthMap.get(month) || { payments: 0, expenses: 0 };
      monthMap.set(month, { ...existing, payments: existing.payments + payment.amount });
    });

    expenses?.forEach(expense => {
      const month = new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const existing = monthMap.get(month) || { payments: 0, expenses: 0 };
      monthMap.set(month, { ...existing, expenses: existing.expenses + expense.amount });
    });

    const trends = Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      payments: Number(data.payments.toFixed(2)),
      expenses: Number(data.expenses.toFixed(2)),
    }));

    setMonthlyData(trends);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user) return null;

  const netIncome = totalRevenue - totalExpenses;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('reports')}</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToPDF}>
              <Download className="w-4 h-4 mr-2" />
              Export to PDF
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₪{totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From all payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₪{totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Income</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₪{netIncome.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Expenses by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
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
                  No expense data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Building Occupancy Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Building Occupancy</CardTitle>
            </CardHeader>
            <CardContent>
              {buildingStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={buildingStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="buildingName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="occupied" fill="hsl(var(--primary))" name="Occupied" />
                    <Bar dataKey="vacant" fill="hsl(var(--muted))" name="Vacant" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No building data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Trends */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Monthly Revenue vs Expenses</CardTitle>
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
                  <Line type="monotone" dataKey="payments" stroke="hsl(var(--primary))" name="Revenue" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" name="Expenses" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;