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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Pencil, Trash2, Calendar as CalendarIcon, ArrowLeft, Repeat, Receipt } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseMode, setExpenseMode] = useState<'one-time' | 'recurring' | null>(null);
  const [expenseDate, setExpenseDate] = useState<Date | undefined>();
  const [recurringStartDate, setRecurringStartDate] = useState<Date | undefined>();
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>();
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    building_id: '',
    description: '',
    amount: '',
    category: '',

    apply_to: 'building' as 'building' | 'apartment',
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

    // For recurring expenses, use recurringStartDate as the expense date
    const dateForDb = expenseMode === 'recurring' ? recurringStartDate : expenseDate;
    const dbDate = dateForDb ? format(dateForDb, 'yyyy-MM-dd') : '';

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
        const isRecurring = expenseMode === 'recurring';
        const payload: any = {
          buildingId: formData.building_id,
          description: formData.description,
          amount: parseFloat(formData.amount),
          expenseDate: dbDate,
          category: formData.category || undefined,
          isRecurring,
          recurringType: isRecurring ? 'monthly' : undefined,
          recurringStartDate: isRecurring && recurringStartDate ? format(recurringStartDate, 'yyyy-MM-dd') : undefined,
          recurringEndDate: isRecurring && recurringEndDate ? format(recurringEndDate, 'yyyy-MM-dd') : undefined,
        };

        if (formData.apply_to === 'apartment' && formData.apartment_id) {
          payload.apartmentId = formData.apartment_id;
        }

        await api.post('/expenses', payload);

        if (formData.apply_to === 'apartment' && formData.apartment_id) {
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
    setExpenseMode(expense.isRecurring ? 'recurring' : 'one-time');
    setExpenseDate(new Date(expense.expenseDate + 'T00:00:00'));
    setRecurringStartDate(expense.recurringStartDate ? new Date(expense.recurringStartDate + 'T00:00:00') : undefined);
    setRecurringEndDate(expense.recurringEndDate ? new Date(expense.recurringEndDate + 'T00:00:00') : undefined);
    setFormData({
      building_id: expense.buildingId,
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category || '',
      apply_to: 'building',
      apartment_id: '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      building_id: '',
      description: '',
      amount: '',
      category: '',
  
      apply_to: 'building',
      apartment_id: '',
    });
    setExpenseMode(null);
    setExpenseDate(undefined);
    setRecurringStartDate(undefined);
    setRecurringEndDate(undefined);
    setOpenPopover(null);
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
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('expenses')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Select value={selectedBuildingFilter} onValueChange={setSelectedBuildingFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('filterByBuilding')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allBuildings')}</SelectItem>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditingExpense(null);
                setExpenseMode(null);
                setExpenseDate(undefined);
                setRecurringStartDate(undefined);
                setRecurringEndDate(undefined);
                setOpenPopover(null);
                setFormData({
                  building_id: '',
                  description: '',
                  amount: '',
                  category: '',

                  apply_to: 'building',
                  apartment_id: '',
                });
                setIsDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 me-2" />
              {t('addExpense')}
            </Button>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingExpense
                  ? t('editExpense')
                  : expenseMode
                    ? (expenseMode === 'one-time' ? t('oneTimeExpense') : t('recurringExpense'))
                    : t('addExpense')
                }
              </DialogTitle>
            </DialogHeader>

            {/* Step 1: Type selection (create mode only) */}
            {!editingExpense && !expenseMode ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('expenseType')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setExpenseMode('one-time')}
                    className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-muted hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
                  >
                    <Receipt className="w-8 h-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{t('oneTimeExpense')}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{t('oneTimeExpenseDesc')}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseMode('recurring')}
                    className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-muted hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
                  >
                    <Repeat className="w-8 h-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{t('recurringExpense')}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{t('recurringExpenseDesc')}</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Expense form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingExpense && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExpenseMode(null)} className="gap-1 -mt-2">
                    <ArrowLeft className="w-4 h-4" />
                    {t('back')}
                  </Button>
                )}

                {/* Building */}
                <div>
                  <Label>{t('building')}</Label>
                  <Select
                    value={formData.building_id}
                    onValueChange={(value) => setFormData({ ...formData, building_id: value, apartment_id: '' })}
                  >
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

                {/* Description */}
                <div>
                  <Label htmlFor="description">{t('description')}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                {/* Amount */}
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

                {/* Date Picker (one-time only; recurring uses start date) */}
                {expenseMode !== 'recurring' && (
                  <div>
                    <Label>{t('date')}</Label>
                    <Popover open={openPopover === 'expense-date'} onOpenChange={(open) => setOpenPopover(open ? 'expense-date' : null)}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn("w-full justify-start text-start font-normal", !expenseDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="me-2 h-4 w-4" />
                          {expenseDate ? format(expenseDate, 'dd/MM/yyyy') : t('selectDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={expenseDate}
                          onSelect={(date) => { setExpenseDate(date); setOpenPopover(null); }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Category */}
                <div>
                  <Label htmlFor="category">{t('categoryOptional')}</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder={t('categoryPlaceholder')}
                  />
                </div>

                {/* Recurring fields */}
                {expenseMode === 'recurring' && (
                  <>
                    <div>
                      <Label>{t('recurringStartDate')}</Label>
                      <Popover open={openPopover === 'recurring-start'} onOpenChange={(open) => setOpenPopover(open ? 'recurring-start' : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-start font-normal", !recurringStartDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="me-2 h-4 w-4" />
                            {recurringStartDate ? format(recurringStartDate, 'dd/MM/yyyy') : t('selectDate')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={recurringStartDate}
                            onSelect={(date) => { setRecurringStartDate(date); setOpenPopover(null); }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>{t('recurringEndDateOptional')}</Label>
                      <Popover open={openPopover === 'recurring-end'} onOpenChange={(open) => setOpenPopover(open ? 'recurring-end' : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn("w-full justify-start text-start font-normal", !recurringEndDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="me-2 h-4 w-4" />
                            {recurringEndDate ? format(recurringEndDate, 'dd/MM/yyyy') : t('selectDate')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={recurringEndDate}
                            onSelect={(date) => { setRecurringEndDate(date); setOpenPopover(null); }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('recurringEndDateNote')}
                      </p>
                    </div>
                  </>
                )}

                {/* Apply to (create mode only, after building selected) */}
                {!editingExpense && formData.building_id && (
                  <div className="space-y-3 border-t pt-4">
                    <Label>{t('applyTo')}</Label>
                    <RadioGroup
                      value={formData.apply_to}
                      onValueChange={(value: string) => setFormData({ ...formData, apply_to: value as 'building' | 'apartment', apartment_id: '' })}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="building" id="apply-building" />
                        <Label htmlFor="apply-building" className="cursor-pointer font-normal">
                          {t('entireBuilding')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="apartment" id="apply-apartment" />
                        <Label htmlFor="apply-apartment" className="cursor-pointer font-normal">
                          {t('specificApartment')}
                        </Label>
                      </div>
                    </RadioGroup>

                    {formData.apply_to === 'apartment' && (
                      <div>
                        <Label>{t('selectApartment')}</Label>
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
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>{t('allExpenses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('building')}</TableHead>
                  <TableHead className="text-start">{t('description')}</TableHead>
                  <TableHead className="text-start">{t('category')}</TableHead>
                  <TableHead className="text-start">{t('amount')}</TableHead>
                  <TableHead className="text-start">{t('date')}</TableHead>
                  <TableHead className="text-start">{t('recurring')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const filtered = selectedBuildingFilter === 'all'
                    ? expenseRows
                    : expenseRows.filter(r => r.expense.buildingId === selectedBuildingFilter);
                  return filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {t('noExpensesFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.expense.id}>
                      <TableCell className="font-medium text-start">{row.buildingName || getBuildingName(row.expense.buildingId)}</TableCell>
                      <TableCell className="text-start">{row.expense.description}</TableCell>
                      <TableCell className="text-start">{row.expense.category || '-'}</TableCell>
                      <TableCell className="text-start">₪{Number(row.expense.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-start">{formatDate(row.expense.expenseDate)}</TableCell>
                      <TableCell className="text-start">
                        {row.expense.isRecurring ? (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                            {t(row.expense.recurringType || 'recurring')}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-start">
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
                );
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Expenses;
