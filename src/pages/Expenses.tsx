import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
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
  building_id: string;
  description: string;
  amount: number;
  expense_date: string;
  category: string | null;
  is_recurring: boolean;
  recurring_type: 'monthly' | 'yearly' | null;
  recurring_start_date: string | null;
  recurring_end_date: string | null;
  parent_expense_id: string | null;
}

interface Building {
  id: string;
  name: string;
}

interface ApartmentOption {
  id: string;
  apartment_number: string;
  building_id: string;
}

const Expenses = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
      .select('id, apartment_number, building_id')
      .order('apartment_number');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setApartments((data as ApartmentOption[]) || []);
    }
  };

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setExpenses((data as Expense[]) || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert dd/mm/yyyy to yyyy-mm-dd for database
    let dbDate = formData.expense_date;
    const parts = formData.expense_date.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      dbDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    const expenseData: any = {
      building_id: formData.building_id,
      description: formData.description,
      amount: parseFloat(formData.amount),
      expense_date: dbDate,
      category: formData.category || null,
      is_recurring: formData.is_recurring,
      recurring_type: formData.is_recurring ? formData.recurring_type || null : null,
      recurring_start_date: formData.is_recurring && formData.recurring_start_date ? formData.recurring_start_date : null,
      recurring_end_date: formData.is_recurring && formData.recurring_end_date ? formData.recurring_end_date : null,
    };

    if (editingExpense) {
      const { error } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', editingExpense.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Expense updated successfully' });
        fetchExpenses();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('expenses')
        .insert([expenseData]);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // Get the created expense ID
        const { data: createdExpense, error: fetchError } = await supabase
          .from('expenses')
          .select('id')
          .eq('building_id', formData.building_id)
          .eq('description', formData.description)
          .eq('amount', parseFloat(formData.amount))
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError) {
          toast({ title: 'Error', description: fetchError.message, variant: 'destructive' });
          return;
        }

        // Check if single apartment mode
        if (formData.is_single_apartment && formData.apartment_id) {
          // Apply expense to single apartment
          const { data: targetApartment, error: aptError } = await supabase
            .from('apartments')
            .select('id, credit')
            .eq('id', formData.apartment_id)
            .single();

          if (aptError || !targetApartment) {
            toast({ title: 'Error', description: aptError?.message || 'Apartment not found', variant: 'destructive' });
            return;
          }

          const expenseAmount = parseFloat(formData.amount);

          // Create single apartment_expense record
          const { error: insertError } = await supabase
            .from('apartment_expenses')
            .insert([{
              apartment_id: formData.apartment_id,
              expense_id: createdExpense.id,
              amount: expenseAmount
            }]);

          if (insertError) {
            toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
            return;
          }

          // Update apartment credit
          await supabase
            .from('apartments')
            .update({ credit: targetApartment.credit - expenseAmount })
            .eq('id', formData.apartment_id);

          toast({ 
            title: t('success'), 
            description: t('expenseAppliedToApartment')
          });
        } else {
          // Fetch all apartments for this building to split the expense
          const { data: buildingApartments, error: apartmentsError } = await supabase
            .from('apartments')
            .select('id, credit')
            .eq('building_id', formData.building_id);

          if (!apartmentsError && buildingApartments && buildingApartments.length > 0) {
            // Calculate per-apartment expense
            const totalAmount = parseFloat(formData.amount);
            const perApartmentAmount = totalAmount / buildingApartments.length;

            // Create apartment_expenses records and update credits
            const apartmentExpensesRecords = buildingApartments.map(apt => ({
              apartment_id: apt.id,
              expense_id: createdExpense.id,
              amount: perApartmentAmount
            }));

            const { error: insertError } = await supabase
              .from('apartment_expenses')
              .insert(apartmentExpensesRecords);

            if (insertError) {
              toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
              return;
            }

            // Update each apartment's credit by deducting their share
            for (const apt of buildingApartments) {
              await supabase
                .from('apartments')
                .update({ credit: apt.credit - perApartmentAmount })
                .eq('id', apt.id);
            }

            toast({ 
              title: t('success'), 
              description: `${t('expenseCreatedAndSplit')} ${buildingApartments.length} ${t('apartments')} (₪${perApartmentAmount.toFixed(2)} ${t('perApartment')})` 
            });
          } else {
            toast({ title: t('success'), description: t('expenseCreatedSuccessfully') });
          }
        }
        
        fetchExpenses();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteExpenseConfirm'))) return;

    // First, fetch apartment_expenses to restore credits
    const { data: apartmentExpenses, error: fetchError } = await supabase
      .from('apartment_expenses')
      .select('apartment_id, amount')
      .eq('expense_id', id);

    if (fetchError) {
      toast({ title: 'Error', description: fetchError.message, variant: 'destructive' });
      return;
    }

    // Restore credits to apartments
    if (apartmentExpenses && apartmentExpenses.length > 0) {
      for (const expenseRecord of apartmentExpenses) {
        const { data: apartment } = await supabase
          .from('apartments')
          .select('credit')
          .eq('id', expenseRecord.apartment_id)
          .single();

        if (apartment) {
          await supabase
            .from('apartments')
            .update({ credit: apartment.credit + expenseRecord.amount })
            .eq('id', expenseRecord.apartment_id);
        }
      }
    }

    // Delete the expense (apartment_expenses will cascade delete)
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: t('expenseDeletedAndRestored') });
      fetchExpenses();
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    // Convert yyyy-mm-dd from database to dd/mm/yyyy for display
    let displayDate = expense.expense_date;
    const parts = expense.expense_date.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      displayDate = `${day}/${month}/${year}`;
    }
    
    setFormData({
      building_id: expense.building_id,
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: displayDate,
      category: expense.category || '',
      is_recurring: expense.is_recurring,
      recurring_type: expense.recurring_type || '',
      recurring_start_date: expense.recurring_start_date || '',
      recurring_end_date: expense.recurring_end_date || '',
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
                                .filter(apt => apt.building_id === formData.building_id)
                                .map((apt) => (
                                  <SelectItem key={apt.id} value={apt.id}>
                                    {apt.apartment_number}
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
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              {t('backToDashboard')}
            </Button>
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
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {t('noExpensesFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium text-right">{getBuildingName(expense.building_id)}</TableCell>
                      <TableCell className="text-right">{expense.description}</TableCell>
                      <TableCell className="text-right">{expense.category || '-'}</TableCell>
                      <TableCell className="text-right">₪{expense.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatDate(expense.expense_date)}</TableCell>
                      <TableCell className="text-right">
                        {expense.is_recurring ? (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            {t(expense.recurring_type || 'recurring')}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(expense)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(expense.id)}>
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
