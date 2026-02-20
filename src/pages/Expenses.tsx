import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Expense {
  id: string;
  buildingId: string;
  description: string;
  amount: number;
  expenseDate: string;
  category: string | null;
  isRecurring: boolean;
  recurringType: 'monthly' | 'yearly' | null;
  recurringStartDate: string | null;
  recurringEndDate: string | null;
  parentExpenseId: string | null;
}

interface ExpenseRow {
  expense: Expense;
  buildingName: string;
}

interface Building {
  id: string;
  name: string;
}

interface ApartmentOption {
  id: string;
  apartmentNumber: string;
  buildingId: string;
}

const Expenses = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    building_id: '',
    description: '',
    amount: '',
    expense_date: '',
    category: '',
    is_recurring: false,
    recurring_type: '',
    recurring_start_date: '',
    recurring_end_date: '',
    is_single_apartment: false,
    apartment_id: '',
  });

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
      fetchExpenses();
    }
  }, [user, isAdmin, isModerator]);

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
      const data = await api.get<{ apartment: ApartmentOption }[]>('/apartments');
      setApartments((data || []).map(row => row.apartment));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const fetchExpenses = async () => {
    try {
      const data = await api.get<ExpenseRow[]>('/expenses');
      setExpenseRows(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert dd/mm/yyyy to yyyy-mm-dd for the API
    let dbDate = formData.expense_date;
    const parts = formData.expense_date.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      dbDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    if (editingExpense) {
      try {
        await api.put(`/expenses/${editingExpense.id}`, {
          description: formData.description,
          amount: parseFloat(formData.amount),
          expenseDate: dbDate,
          category: formData.category || null,
        });
        toast({ title: 'Success', description: 'Expense updated successfully' });
        fetchExpenses();
        resetForm();
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    } else {
      try {
        const payload: any = {
          buildingId: formData.building_id,
          description: formData.description,
          amount: parseFloat(formData.amount),
          expenseDate: dbDate,
          category: formData.category || undefined,
          isRecurring: formData.is_recurring,
          recurringType: formData.is_recurring ? formData.recurring_type || undefined : undefined,
          recurringStartDate: formData.is_recurring && formData.recurring_start_date ? formData.recurring_start_date : undefined,
          recurringEndDate: formData.is_recurring && formData.recurring_end_date ? formData.recurring_end_date : undefined,
        };

        // If single apartment mode, include apartmentId so the server assigns the expense to that apartment only
        if (formData.is_single_apartment && formData.apartment_id) {
          payload.apartmentId = formData.apartment_id;
        }

        await api.post('/expenses', payload);

        if (formData.is_single_apartment && formData.apartment_id) {
          toast({
            title: t('success'),
            description: t('expenseAppliedToApartment')
          });
        } else {
          toast({
            title: t('success'),
            description: t('expenseCreatedSuccessfully')
          });
        }

        fetchExpenses();
        resetForm();
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteExpenseConfirm'))) return;

    try {
      await api.delete(`/expenses/${id}`);
      toast({ title: 'Success', description: t('expenseDeletedAndRestored') });
      fetchExpenses();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    // Convert yyyy-mm-dd from API to dd/mm/yyyy for display
    let displayDate = expense.expenseDate;
    const parts = expense.expenseDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      displayDate = `${day}/${month}/${year}`;
    }

    setFormData({
      building_id: expense.buildingId,
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: displayDate,
      category: expense.category || '',
      is_recurring: expense.isRecurring,
      recurring_type: expense.recurringType || '',
      recurring_start_date: expense.recurringStartDate || '',
      recurring_end_date: expense.recurringEndDate || '',
      is_single_apartment: false,
      apartment_id: '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      building_id: '',
      description: '',
      amount: '',
      expense_date: '',
      category: '',
      is_recurring: false,
      recurring_type: '',
      recurring_start_date: '',
      recurring_end_date: '',
      is_single_apartment: false,
      apartment_id: '',
    });
    setEditingExpense(null);
    setIsDialogOpen(false);
  };

  const getBuildingName = (buildingId: string) => {
    return buildings.find(b => b.id === buildingId)?.name || t('unknown');
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
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('expenses')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addExpense')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingExpense ? t('editExpense') : t('addExpense')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="building_id">{t('building')}</Label>
                    <Select value={formData.building_id} onValueChange={(value) => setFormData({ ...formData, building_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectBuilding')} />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((building) => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">{t('description')}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">{t('amount')}</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="expense_date">{t('date')}</Label>
                    <Input
                      id="expense_date"
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.expense_date}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d/]/g, '');
                        if (value.length <= 10) {
                          setFormData({ ...formData, expense_date: value });
                        }
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">{t('categoryOptional')}</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder={t('categoryPlaceholder')}
                    />
                  </div>

                  {/* Recurring Expense Options */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_recurring"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="is_recurring" className="cursor-pointer">
                        {t('recurringExpense')}
                      </Label>
                    </div>

                    {formData.is_recurring && (
                      <>
                        <div>
                          <Label htmlFor="recurring_type">{t('recurringType')}</Label>
                          <Select value={formData.recurring_type} onValueChange={(value) => setFormData({ ...formData, recurring_type: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectRecurringType')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">{t('monthly')}</SelectItem>
                              <SelectItem value="yearly">{t('yearly')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="recurring_start_date">{t('recurringStartDate')}</Label>
                          <Input
                            id="recurring_start_date"
                            type="date"
                            value={formData.recurring_start_date}
                            onChange={(e) => setFormData({ ...formData, recurring_start_date: e.target.value })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="recurring_end_date">{t('recurringEndDateOptional')}</Label>
                          <Input
                            id="recurring_end_date"
                            type="date"
                            value={formData.recurring_end_date}
                            onChange={(e) => setFormData({ ...formData, recurring_end_date: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('recurringEndDateNote')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Single Apartment Expense Option */}
                  {!editingExpense && formData.building_id && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is_single_apartment"
                          checked={formData.is_single_apartment}
                          onChange={(e) => setFormData({ ...formData, is_single_apartment: e.target.checked, apartment_id: '' })}
                          className="rounded"
                        />
                        <Label htmlFor="is_single_apartment" className="cursor-pointer">
                          {t('applyToSingleApartment')}
                        </Label>
                      </div>

                      {formData.is_single_apartment && (
                        <div>
                          <Label htmlFor="apartment_id">{t('selectApartment')}</Label>
                          <Select value={formData.apartment_id} onValueChange={(value) => setFormData({ ...formData, apartment_id: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectApartment')} />
                            </SelectTrigger>
                            <SelectContent>
                              {apartments
                                .filter(apt => apt.buildingId === formData.building_id)
                                .map((apt) => (
                                  <SelectItem key={apt.id} value={apt.id}>
                                    {apt.apartmentNumber}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingExpense ? t('update') : t('create')}
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
            <CardTitle>{t('allExpenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t('building')}</TableHead>
                  <TableHead className="text-right">{t('description')}</TableHead>
                  <TableHead className="text-right">{t('category')}</TableHead>
                  <TableHead className="text-right">{t('amount')}</TableHead>
                  <TableHead className="text-right">{t('date')}</TableHead>
                  <TableHead className="text-right">{t('recurring')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {t('noExpensesFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  expenseRows.map((row) => (
                    <TableRow key={row.expense.id}>
                      <TableCell className="font-medium text-right">{row.buildingName || getBuildingName(row.expense.buildingId)}</TableCell>
                      <TableCell className="text-right">{row.expense.description}</TableCell>
                      <TableCell className="text-right">{row.expense.category || '-'}</TableCell>
                      <TableCell className="text-right">₪{Number(row.expense.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatDate(row.expense.expenseDate)}</TableCell>
                      <TableCell className="text-right">
                        {row.expense.isRecurring ? (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            {t(row.expense.recurringType || 'recurring')}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(row.expense)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(row.expense.id)}>
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

export default Expenses;
