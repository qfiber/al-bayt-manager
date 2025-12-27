import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
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
import { getUnpaidExpensesForApartment, applyPaymentToExpenses } from '@/hooks/useExpenseRecalculation';
import { formatDate } from '@/lib/utils';

interface Payment {
  id: string;
  apartment_id: string;
  amount: number;
  month: string;
  is_canceled: boolean;
}

interface Apartment {
  id: string;
  apartment_number: string;
  building_id: string;
  subscription_amount: number;
  credit: number;
  occupancy_start: string | null;
}

interface Building {
  id: string;
  name: string;
}

interface UnpaidExpense {
  id: string;
  expense_id: string;
  description: string;
  category: string | null;
  expense_date: string;
  amount: number;
  amount_paid: number;
  remaining: number;
  isSubscription?: boolean;
}

interface ExpenseAllocation {
  apartmentExpenseId: string;
  amount: number;
}

const Payments = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
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
    const expenses = await getUnpaidExpensesForApartment(apartmentId);
    setUnpaidExpenses(expenses);
    setAllocations({});
    setLoadingExpenses(false);
  };

  const fetchBuildings = async () => {
    const { data, error } = await supabase
      .from('buildings')
      .select('id, name')
      .order('name');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBuildings(data || []);
    }
  };

  const fetchApartments = async () => {
    const { data, error } = await supabase
      .from('apartments')
      .select('*')
      .order('apartment_number');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setApartments(data || []);
    }
  };

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('month', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setPayments((data as Payment[]) || []);
    }
  };

  const updateApartmentCredit = async (apartmentId: string, paymentAmount: number) => {
    const apartment = apartments.find(a => a.id === apartmentId);
    if (!apartment) return;

    const newCredit = apartment.credit + paymentAmount;
    
    let newStatus = 'due';
    if (newCredit >= 0) {
      newStatus = 'paid';
    } else if (newCredit < 0 && newCredit > apartment.credit) {
      newStatus = 'partial';
    }

    const { error } = await supabase
      .from('apartments')
      .update({ 
        credit: newCredit,
        subscription_status: newStatus
      })
      .eq('id', apartmentId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update apartment credit', variant: 'destructive' });
    } else {
      fetchApartments();
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
    
    const apartment = apartments.find(a => a.id === formData.apartment_id);
    if (!apartment) {
      toast({ title: 'Error', description: 'Apartment not found', variant: 'destructive' });
      return;
    }

    const paymentAmount = parseFloat(formData.amount);
    const totalAllocated = getTotalAllocated();

    // Create the payment first
    const now = new Date();
    const monthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const paymentData = {
      apartment_id: formData.apartment_id,
      amount: paymentAmount,
      month: monthStr,
    };

    const { data: createdPayment, error } = await supabase
      .from('payments')
      .insert([paymentData])
      .select()
      .single();

    if (error || !createdPayment) {
      toast({ title: 'Error', description: error?.message || 'Failed to create payment', variant: 'destructive' });
      return;
    }

    // Apply allocations to expenses
    if (totalAllocated > 0) {
      const allocationsList: ExpenseAllocation[] = Object.entries(allocations)
        .filter(([_, amount]) => amount > 0)
        .map(([apartmentExpenseId, amount]) => ({ apartmentExpenseId, amount }));

      const result = await applyPaymentToExpenses(createdPayment.id, formData.apartment_id, allocationsList);
      
      if (!result.success) {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }

      // Update apartment credit with only the remaining unallocated amount
      if (result.creditRemaining > 0) {
        toast({ 
          title: t('success'), 
          description: `${t('paymentAllocated')}. ${t('creditFromPayment')}: ₪${result.creditRemaining.toFixed(2)}`
        });
      } else {
        toast({ title: t('success'), description: t('paymentAllocated') });
      }
    } else {
      // No allocations - all goes to credit
      await updateApartmentCredit(formData.apartment_id, paymentAmount);
      toast({ title: 'Success', description: `Payment of ₪${paymentAmount.toFixed(2)} added to credit` });
    }

    fetchPayments();
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deletePaymentConfirm'))) return;

    // Get payment details before cancellation
    const payment = payments.find(p => p.id === id);
    if (!payment || payment.is_canceled) return;

    const { error } = await supabase
      .from('payments')
      .update({ is_canceled: true })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Recalculate apartment credit and status after cancellation (only active payments)
      const { data: remainingPayments, error: remainingError } = await supabase
        .from('payments')
        .select('amount')
        .eq('apartment_id', payment.apartment_id)
        .eq('is_canceled', false);

      if (remainingError) {
        toast({ title: 'Error', description: remainingError.message, variant: 'destructive' });
      } else {
        const totalPaid = remainingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const apartment = apartments.find(a => a.id === payment.apartment_id);

        if (apartment) {
          const newCredit = totalPaid - apartment.subscription_amount;
          let newStatus = 'due';

          if (newCredit >= 0) {
            newStatus = 'paid';
          } else if (totalPaid > 0) {
            newStatus = 'partial';
          }

          const { error: updateError } = await supabase
            .from('apartments')
            .update({
              credit: newCredit,
              subscription_status: newStatus,
            })
            .eq('id', payment.apartment_id);

          if (updateError) {
            toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
          }
        }
      }

      toast({ title: t('success'), description: t('paymentCanceled') });
      fetchPayments();
      fetchApartments();
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      apartment_id: payment.apartment_id,
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
    const apartment = apartments.find(a => a.id === apartmentId);
    if (!apartment) return t('unknown');
    const building = buildings.find(b => b.id === apartment.building_id);
    return `${building?.name || t('unknown')} - ${t('apt')} ${apartment.apartment_number}`;
  };

  const getExpensePaymentStatus = (expense: UnpaidExpense) => {
    if (expense.amount_paid === 0) return null;
    if (expense.amount_paid >= expense.amount) return 'paid';
    return 'partial';
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || (!isAdmin && !isModerator)) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
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
                        {apartments.map((apartment) => (
                          <SelectItem key={apartment.id} value={apartment.id}>
                            {getApartmentInfo(apartment.id)}
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
                                    {expense.isSubscription ? t('due') : formatDate(expense.expense_date)} • {t('remainingAmount')}: ₪{expense.remaining.toFixed(2)}
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
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              {t('backToDashboard')}
            </Button>
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
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t('noPaymentsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id} className={payment.is_canceled ? 'opacity-50' : ''}>
                      <TableCell className="font-medium text-right">{getApartmentInfo(payment.apartment_id)}</TableCell>
                      <TableCell className="text-right">₪{payment.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {payment.month}
                        {payment.is_canceled && <Badge variant="destructive" className="mr-2">{t('canceled')}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(payment)} disabled={payment.is_canceled}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(payment.id)} disabled={payment.is_canceled}>
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