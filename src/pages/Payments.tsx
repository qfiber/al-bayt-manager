import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Payment {
  id: string;
  apartmentId: string;
  amount: number;
  month: string;
  isCanceled: boolean;
}

interface PaymentRow {
  payment: Payment;
  apartmentNumber: string;
  buildingName: string;
  buildingId: string;
}

interface Apartment {
  id: string;
  apartmentNumber: string;
  buildingId: string;
  subscriptionAmount: number;
  credit: number;
  occupancyStart: string | null;
}

interface ApartmentRow {
  apartment: Apartment;
  buildingName: string;
  ownerName: string;
  beneficiaryName: string;
}

interface Building {
  id: string;
  name: string;
}

interface UnpaidExpense {
  id: string;
  expenseId: string;
  description: string;
  category: string | null;
  expenseDate: string;
  amount: number;
  amountPaid: number;
  remaining: number;
  isSubscription?: boolean;
  isCanceled: boolean;
}

interface ExpenseAllocation {
  apartmentExpenseId: string;
  amountAllocated: number;
}

const Payments = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [apartmentRows, setApartmentRows] = useState<ApartmentRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    apartment_id: '',
    amount: '',
  });

  // Expense allocation state
  const [unpaidExpenses, setUnpaidExpenses] = useState<UnpaidExpense[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin && !isModerator) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, isModerator, loading, navigate]);

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchBuildings();
      fetchApartments();
      fetchPayments();
    }
  }, [user, isAdmin, isModerator]);

  // Fetch unpaid expenses when apartment changes
  useEffect(() => {
    if (formData.apartment_id) {
      loadUnpaidExpenses(formData.apartment_id);
    } else {
      setUnpaidExpenses([]);
      setAllocations({});
    }
  }, [formData.apartment_id]);

  const loadUnpaidExpenses = async (apartmentId: string) => {
    setLoadingExpenses(true);
    try {
      const expenses = await api.get<UnpaidExpense[]>(`/apartment-expenses/${apartmentId}`);
      setUnpaidExpenses(expenses);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setUnpaidExpenses([]);
    }
    setAllocations({});
    setLoadingExpenses(false);
  };

  const fetchBuildings = async () => {
    try {
      const data = await api.get<Building[]>('/buildings');
      setBuildings(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const fetchApartments = async () => {
    try {
      const data = await api.get<ApartmentRow[]>('/apartments');
      setApartmentRows(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const fetchPayments = async () => {
    try {
      const data = await api.get<PaymentRow[]>('/payments');
      setPaymentRows(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const getTotalAllocated = () => {
    return Object.values(allocations).reduce((sum, amount) => sum + (amount || 0), 0);
  };

  const getRemainingToAllocate = () => {
    const paymentAmount = parseFloat(formData.amount) || 0;
    return paymentAmount - getTotalAllocated();
  };

  const handleAllocationChange = (expenseId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    const expense = unpaidExpenses.find(e => e.id === expenseId);
    if (!expense) return;

    // Cap at the remaining amount for this expense
    const maxAmount = expense.remaining;
    const cappedAmount = Math.min(amount, maxAmount);

    setAllocations(prev => ({
      ...prev,
      [expenseId]: cappedAmount
    }));
  };

  const handlePayFullAmount = (expenseId: string) => {
    const expense = unpaidExpenses.find(e => e.id === expenseId);
    if (!expense) return;

    const remaining = getRemainingToAllocate() + (allocations[expenseId] || 0);
    const amountToPay = Math.min(expense.remaining, remaining);

    setAllocations(prev => ({
      ...prev,
      [expenseId]: amountToPay
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const apartmentRow = apartmentRows.find(a => a.apartment.id === formData.apartment_id);
    if (!apartmentRow) {
      toast({ title: 'Error', description: 'Apartment not found', variant: 'destructive' });
      return;
    }

    const paymentAmount = parseFloat(formData.amount);
    const totalAllocated = getTotalAllocated();

    // Build allocations list if any
    const allocationsList: ExpenseAllocation[] | undefined = totalAllocated > 0
      ? Object.entries(allocations)
          .filter(([_, amount]) => amount > 0)
          .map(([apartmentExpenseId, amount]) => ({ apartmentExpenseId, amountAllocated: amount }))
      : undefined;

    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      await api.post('/payments', {
        apartmentId: formData.apartment_id,
        month: monthStr,
        amount: paymentAmount,
        allocations: allocationsList,
      });

      if (totalAllocated > 0) {
        toast({ title: t('success'), description: t('paymentAllocated') });
      } else {
        toast({ title: t('success'), description: `Payment of ₪${paymentAmount.toFixed(2)} recorded` });
      }

      fetchPayments();
      fetchApartments();
      resetForm();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deletePaymentConfirm'))) return;

    // Get payment details before cancellation
    const row = paymentRows.find(r => r.payment.id === id);
    if (!row || row.payment.isCanceled) return;

    try {
      await api.post(`/payments/${id}/cancel`);
      toast({ title: t('success'), description: t('paymentCanceled') });
      fetchPayments();
      fetchApartments();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      apartment_id: payment.apartmentId,
      amount: payment.amount.toString(),
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      apartment_id: '',
      amount: '',
    });
    setEditingPayment(null);
    setAllocations({});
    setUnpaidExpenses([]);
    setIsDialogOpen(false);
  };

  const getApartmentInfo = (apartmentId: string) => {
    const row = apartmentRows.find(a => a.apartment.id === apartmentId);
    if (!row) return t('unknown');
    const building = buildings.find(b => b.id === row.apartment.buildingId);
    return `${building?.name || row.buildingName || t('unknown')} - ${t('apt')} ${row.apartment.apartmentNumber}`;
  };

  const getExpensePaymentStatus = (expense: UnpaidExpense) => {
    if (expense.amountPaid === 0) return null;
    if (expense.amountPaid >= expense.amount) return 'paid';
    return 'partial';
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
            <CreditCard className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('payments')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addPayment')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingPayment ? t('editPayment') : t('addPayment')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="apartment_id">{t('apartment')}</Label>
                    <Select value={formData.apartment_id} onValueChange={(value) => setFormData({ ...formData, apartment_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectApartmentPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {apartmentRows.map((row) => (
                          <SelectItem key={row.apartment.id} value={row.apartment.id}>
                            {getApartmentInfo(row.apartment.id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">{t('amountLabel')}</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  {/* Expense Allocation Section */}
                  {formData.apartment_id && !editingPayment && (
                    <div className="border-t pt-4">
                      <Label className="text-base font-semibold">{t('selectExpenses')}</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        {t('remainingAmount')}: ₪{getRemainingToAllocate().toFixed(2)}
                      </p>

                      {loadingExpenses ? (
                        <p className="text-muted-foreground">{t('loading')}</p>
                      ) : unpaidExpenses.length === 0 ? (
                        <p className="text-muted-foreground">{t('noUnpaidExpenses')}</p>
                      ) : (
                        <div className="space-y-3">
                          {unpaidExpenses.map((expense) => {
                            const status = getExpensePaymentStatus(expense);
                            return (
                              <div key={expense.id} className={`flex items-center gap-3 p-3 border rounded-lg ${expense.isSubscription ? 'bg-primary/5 border-primary/20' : ''}`}>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {expense.isSubscription ? t('monthlySubscription').replace(' (₪)', '') : expense.description}
                                    </span>
                                    {expense.isSubscription ? (
                                      <Badge variant="default" className="text-xs">{t('subscriptionStatus')}</Badge>
                                    ) : expense.category && (
                                      <Badge variant="outline" className="text-xs">{expense.category}</Badge>
                                    )}
                                    {status === 'partial' && (
                                      <Badge variant="secondary" className="text-xs">{t('partiallyPaid')}</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {expense.isSubscription ? t('due') : formatDate(expense.expenseDate)} • {t('remainingAmount')}: ₪{expense.remaining.toFixed(2)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={expense.remaining}
                                    value={allocations[expense.id] || ''}
                                    onChange={(e) => handleAllocationChange(expense.id, e.target.value)}
                                    className="w-24"
                                    placeholder="₪0"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePayFullAmount(expense.id)}
                                  >
                                    {t('paid')}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {getRemainingToAllocate() > 0 && unpaidExpenses.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-3">
                          {t('creditFromPayment')}: ₪{getRemainingToAllocate().toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingPayment ? t('update') : t('create')}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('allPayments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t('apartment')}</TableHead>
                  <TableHead className="text-right">{t('amountLabel')}</TableHead>
                  <TableHead className="text-right">{t('month')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t('noPaymentsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  paymentRows.map((row) => (
                    <TableRow key={row.payment.id} className={row.payment.isCanceled ? 'opacity-50' : ''}>
                      <TableCell className="font-medium text-right">
                        {row.buildingName} - {t('apt')} {row.apartmentNumber}
                      </TableCell>
                      <TableCell className="text-right">₪{row.payment.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {row.payment.month}
                        {row.payment.isCanceled && <Badge variant="destructive" className="mr-2">{t('canceled')}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(row.payment)} disabled={row.payment.isCanceled}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(row.payment.id)} disabled={row.payment.isCanceled}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payments;
