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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Home, Plus, Pencil, Trash2, Eye, XCircle } from 'lucide-react';
import { recalculateBuildingExpenses } from '@/hooks/useExpenseRecalculation';

interface Apartment {
  id: string;
  apartment_number: string;
  building_id: string;
  floor: string | null;
  status: string;
  occupancy_start: string | null;
  subscription_amount: number;
  subscription_status: string;
  credit: number;
  owner_id: string | null;
  beneficiary_id: string | null;
}

interface Building {
  id: string;
  name: string;
  number_of_floors: number | null;
  underground_floors: number | null;
}

interface Settings {
  monthly_fee: number;
}

const Apartments = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [apartmentToTerminate, setApartmentToTerminate] = useState<Apartment | null>(null);
  const [calculatedTerminationCredit, setCalculatedTerminationCredit] = useState(0);
  const [formData, setFormData] = useState({
    apartment_number: '',
    building_id: '',
    floor: '',
    status: 'vacant',
    occupancy_start: '',
    subscription_amount: '',
    subscription_status: 'due',
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchSettings();
      fetchBuildings();
      fetchApartments();
      fetchProfiles();
    }
  }, [user, isAdmin]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('monthly_fee')
      .maybeSingle();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data) {
      setSettings(data);
    }
  };

  const calculateProratedAmount = (occupancyStart: string, monthlyFee: number): number => {
    if (!occupancyStart || !monthlyFee) return monthlyFee;

    // Convert dd/mm/yyyy to Date object
    const parts = occupancyStart.split('/');
    if (parts.length !== 3) return monthlyFee;
    
    const [day, month, year] = parts.map(p => parseInt(p, 10));
    if (isNaN(day) || isNaN(month) || isNaN(year)) return monthlyFee;
    
    const startDate = new Date(year, month - 1, day);
    const dayOfMonth = startDate.getDate();

    // If occupancy starts on the 1st, use full monthly fee
    if (dayOfMonth === 1) return monthlyFee;

    // Calculate prorated amount based on days left in month
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysRemaining = daysInMonth - dayOfMonth + 1;

    const proratedAmount = (monthlyFee / daysInMonth) * daysRemaining;
    
    // Custom rounding: 0.01-0.5 rounds down, 0.51+ rounds up
    const wholePart = Math.floor(proratedAmount);
    const fractionalPart = proratedAmount - wholePart;
    
    if (fractionalPart >= 0.51) {
      return wholePart + 1;
    } else {
      return wholePart;
    }
  };

  useEffect(() => {
    if (formData.occupancy_start && settings?.monthly_fee) {
      const calculatedAmount = calculateProratedAmount(formData.occupancy_start, settings.monthly_fee);
      setFormData(prev => ({ ...prev, subscription_amount: calculatedAmount.toString() }));
    } else if (settings?.monthly_fee && !formData.occupancy_start) {
      setFormData(prev => ({ ...prev, subscription_amount: settings.monthly_fee.toString() }));
    }
  }, [formData.occupancy_start, settings?.monthly_fee]);

  const fetchBuildings = async () => {
    const { data, error } = await supabase
      .from('buildings')
      .select('id, name, number_of_floors, underground_floors')
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

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name')
      .order('name');

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setProfiles(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert dd/mm/yyyy to yyyy-mm-dd for database
    let dbDate = null;
    if (formData.occupancy_start) {
      const parts = formData.occupancy_start.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        dbDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    
    const subscriptionAmount = parseFloat(formData.subscription_amount) || 0;
    
    const apartmentData = {
      apartment_number: formData.apartment_number,
      building_id: formData.building_id,
      floor: formData.floor || null,
      status: formData.status,
      occupancy_start: dbDate,
      subscription_amount: subscriptionAmount,
      subscription_status: formData.subscription_status,
    };

    if (editingApartment) {
      // Check if occupancy is being set and occupancy_start is on the 1st of the month
      const wasVacant = editingApartment.status === 'vacant';
      const isNowOccupied = formData.status === 'occupied';
      const shouldRecalculate = wasVacant && isNowOccupied && dbDate;

      const { error } = await supabase
        .from('apartments')
        .update(apartmentData)
        .eq('id', editingApartment.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Apartment updated successfully' });
        
        // Recalculate building expenses if apartment became occupied
        if (shouldRecalculate) {
          toast({ title: t('recalculatingExpenses'), description: '' });
          const result = await recalculateBuildingExpenses(formData.building_id);
          if (result.success && result.adjustments.length > 0) {
            toast({ title: t('success'), description: t('expensesRecalculated') });
          }
        }
        
        fetchApartments();
        resetForm();
      }
    } else {
      // For new apartments, set initial credit as negative of subscription amount
      const { error, data: newApartment } = await supabase
        .from('apartments')
        .insert([{ ...apartmentData, credit: -subscriptionAmount }])
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Apartment created successfully' });
        
        // Recalculate building expenses if new apartment is occupied from the 1st
        if (formData.status === 'occupied' && dbDate) {
          const result = await recalculateBuildingExpenses(formData.building_id);
          if (result.success && result.adjustments.length > 0) {
            toast({ title: t('success'), description: t('expensesRecalculated') });
          }
        }
        
        fetchApartments();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteApartmentConfirm'))) return;

    const { error } = await supabase
      .from('apartments')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Apartment deleted successfully' });
      fetchApartments();
    }
  };

  const handleEdit = (apartment: Apartment) => {
    setEditingApartment(apartment);
    // Convert yyyy-mm-dd from database to dd/mm/yyyy for display
    let displayDate = '';
    if (apartment.occupancy_start) {
      const parts = apartment.occupancy_start.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        displayDate = `${day}/${month}/${year}`;
      }
    }
    
    // Temporarily disable auto-calculation for editing
    const currentFormData = {
      apartment_number: apartment.apartment_number,
      building_id: apartment.building_id,
      floor: apartment.floor || '',
      status: apartment.status,
      occupancy_start: displayDate,
      subscription_amount: apartment.subscription_amount.toString(),
      subscription_status: apartment.subscription_status,
    };
    setFormData(currentFormData);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      apartment_number: '',
      building_id: '',
      floor: '',
      status: 'vacant',
      occupancy_start: '',
      subscription_amount: '',
      subscription_status: 'due',
    });
    setEditingApartment(null);
    setIsDialogOpen(false);
  };

  const getBuildingName = (buildingId: string) => {
    return buildings.find(b => b.id === buildingId)?.name || t('unknown');
  };

  const getProfileName = (profileId: string | null) => {
    if (!profileId) return '-';
    return profiles.find(p => p.id === profileId)?.name || t('unknown');
  };

  // Helper function to get ordinal suffix for a number
  const getOrdinalSuffix = (num: number): string => {
    const lastTwo = num % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return 'th';
    switch (num % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Helper function to get floor display name
  const getFloorDisplayName = (floorValue: string): string => {
    if (floorValue === 'Ground') return t('groundFloor');
    const num = parseInt(floorValue);
    if (num < 0) return `${t('parkingFloor')} ${num}`;
    
    // For languages that use ordinal suffixes (English)
    if (language === 'en') {
      return `${num}${getOrdinalSuffix(num)} Floor`;
    }
    
    // For Hebrew and Arabic, use translated floor names
    if (num === 1) return t('firstFloor');
    if (num === 2) return t('secondFloor');
    if (num === 3) return t('thirdFloor');
    return t('floorNumber').replace('{num}', floorValue);
  };

  // Get floor options for a building (excludes parking floors for apartment assignment)
  // number_of_floors includes ground floor, so if 4 floors: Ground, 1st, 2nd, 3rd
  const getFloorOptions = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return [];
    
    const floors: { value: string; label: string }[] = [];
    
    // Add ground floor first
    floors.push({ value: 'Ground', label: t('groundFloor') });
    
    // Add above-ground floors (numFloors - 1 because ground floor is included in the count)
    const numFloors = building.number_of_floors || 0;
    for (let i = 1; i < numFloors; i++) {
      floors.push({ value: i.toString(), label: getFloorDisplayName(i.toString()) });
    }
    
    return floors;
  };

  const calculateMonthsOccupied = (occupancyStart: string | null) => {
    if (!occupancyStart) return 0;
    
    const startDate = new Date(occupancyStart);
    const now = new Date();
    
    return (now.getFullYear() - startDate.getFullYear()) * 12 + 
           (now.getMonth() - startDate.getMonth()) + 1;
  };

  const calculateTotalDebt = (apartment: Apartment) => {
    // credit = totalPaid - totalOwed, so debt = -credit when credit is negative
    return Math.max(0, -apartment.credit);
  };

  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [debtDetails, setDebtDetails] = useState<any[]>([]);
  const [apartmentExpenses, setApartmentExpenses] = useState<any[]>([]);
  const [apartmentPayments, setApartmentPayments] = useState<any[]>([]);

  const calculateTerminationCredit = (apartment: Apartment): number => {
    if (!apartment.occupancy_start) return 0;

    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentDay + 1;

    const creditForRemainingDays = (apartment.subscription_amount / daysInMonth) * daysRemaining;
    
    // Custom rounding: 0.01-0.5 rounds down, 0.51+ rounds up
    const wholePart = Math.floor(creditForRemainingDays);
    const fractionalPart = creditForRemainingDays - wholePart;
    
    if (fractionalPart >= 0.51) {
      return wholePart + 1;
    } else {
      return wholePart;
    }
  };

  const handleTerminateOccupancy = async () => {
    if (!apartmentToTerminate) return;

    const creditToAdd = calculatedTerminationCredit;
    const newCredit = apartmentToTerminate.credit + creditToAdd;

    const { error } = await supabase
      .from('apartments')
      .update({
        status: 'vacant',
        occupancy_start: null,
        credit: newCredit
      })
      .eq('id', apartmentToTerminate.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: t('success'), 
        description: t('occupancyTerminated').replace('{credit}', `₪${creditToAdd.toFixed(2)}`)
      });
      fetchApartments();
      setTerminateDialogOpen(false);
      setApartmentToTerminate(null);
    }
  };

  const openTerminateDialog = (apartment: Apartment) => {
    setApartmentToTerminate(apartment);
    const credit = calculateTerminationCredit(apartment);
    setCalculatedTerminationCredit(credit);
    setTerminateDialogOpen(true);
  };

  const showDebtDetails = async (apartment: Apartment) => {
    setSelectedApartment(apartment);
    
    // Fetch apartment expenses
    const { data: expensesData } = await supabase
      .from('apartment_expenses')
      .select('*, expense:expenses(description, expense_date)')
      .eq('apartment_id', apartment.id)
      .order('created_at', { ascending: false });
    
    setApartmentExpenses(expensesData || []);

    // Fetch all payments for this apartment
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .eq('apartment_id', apartment.id)
      .order('month', { ascending: false });
    
    setApartmentPayments(paymentsData || []);
    
    if (!apartment.occupancy_start) {
      setDebtDetails([]);
      setDebtDialogOpen(true);
      return;
    }

    const startDate = new Date(apartment.occupancy_start);
    const monthsOccupied = calculateMonthsOccupied(apartment.occupancy_start);
    
    const details = [];
    for (let i = 0; i < monthsOccupied; i++) {
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthStr = `${String(monthDate.getMonth() + 1).padStart(2, '0')}/${monthDate.getFullYear()}`;
      
      // Find payment for this month
      const payment = paymentsData?.find(p => p.month === monthStr);

      details.push({
        month: monthStr,
        amount_due: apartment.subscription_amount,
        amount_paid: payment && !payment.is_canceled ? payment.amount : 0,
        balance: apartment.subscription_amount - (payment && !payment.is_canceled ? payment.amount : 0),
        payment_id: payment?.id || null,
        is_payment_canceled: payment?.is_canceled || false
      });
    }
    
    setDebtDetails(details);
    setDebtDialogOpen(true);
  };

  const handleWaiveSubscription = async (month: string, amount: number) => {
    if (!selectedApartment) return;

    // Add a credit payment (waiver) for this month
    const { error } = await supabase
      .from('payments')
      .insert({
        apartment_id: selectedApartment.id,
        month: month,
        amount: amount,
        is_canceled: false
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Update apartment credit
    const newCredit = selectedApartment.credit + amount;
    const newStatus = newCredit < 0 ? 'due' : 'paid';
    
    const { error: creditError } = await supabase
      .from('apartments')
      .update({ credit: newCredit, subscription_status: newStatus })
      .eq('id', selectedApartment.id);

    if (creditError) {
      toast({ title: 'Error', description: creditError.message, variant: 'destructive' });
      return;
    }

    toast({ title: t('success'), description: t('subscriptionWaived') });
    
    // Refresh data
    await fetchApartments();
    const updatedApartment = { ...selectedApartment, credit: newCredit };
    await showDebtDetails(updatedApartment);
  };

  const handleCancelPayment = async (paymentId: string, apartmentId: string, paymentAmount: number) => {
    const { error } = await supabase
      .from('payments')
      .update({ is_canceled: true })
      .eq('id', paymentId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Recalculate apartment credit
    const apartment = apartments.find(a => a.id === apartmentId);
    if (apartment) {
      const newCredit = apartment.credit - paymentAmount;
      const newStatus = newCredit < 0 ? 'due' : 'paid';
      
      const { error: creditError } = await supabase
        .from('apartments')
        .update({ credit: newCredit, subscription_status: newStatus })
        .eq('id', apartmentId);

      if (creditError) {
        toast({ title: 'Error', description: creditError.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: t('success'), description: t('paymentCanceled') });
    
    // Refresh data
    await fetchApartments();
    if (selectedApartment) {
      const updatedApartment = { ...selectedApartment, credit: (apartment?.credit || 0) - paymentAmount };
      await showDebtDetails(updatedApartment);
    }
  };

  const handleCancelExpense = async (expenseId: string, apartmentId: string, amount: number) => {
    const { error } = await supabase
      .from('apartment_expenses')
      .update({ is_canceled: true })
      .eq('id', expenseId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Restore credit to apartment
    const apartment = apartments.find(a => a.id === apartmentId);
    if (apartment) {
      const { error: creditError } = await supabase
        .from('apartments')
        .update({ credit: apartment.credit + amount })
        .eq('id', apartmentId);

      if (creditError) {
        toast({ title: 'Error', description: creditError.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: t('success'), description: t('expenseCanceled') });
    
    // Refresh data
    if (selectedApartment) {
      await showDebtDetails(selectedApartment);
    }
    await fetchApartments();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  const filteredBuildings = selectedBuildingFilter === 'all' 
    ? buildings 
    : buildings.filter(b => b.id === selectedBuildingFilter);

  const getApartmentsForBuilding = (buildingId: string) => {
    return apartments.filter(a => a.building_id === buildingId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Home className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('apartments')}</h1>
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addApartment')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingApartment ? t('editApartment') : t('addApartment')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="apartment_number">{t('apartmentNumber')}</Label>
                    <Input
                      id="apartment_number"
                      value={formData.apartment_number}
                      onChange={(e) => setFormData({ ...formData, apartment_number: e.target.value })}
                      required
                    />
                  </div>
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
                    <Label htmlFor="floor">{t('floor')}</Label>
                    <Select 
                      value={formData.floor} 
                      onValueChange={(value) => setFormData({ ...formData, floor: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectFloor')} />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.building_id && getFloorOptions(formData.building_id).map((floor) => (
                          <SelectItem key={floor.value} value={floor.value}>
                            {floor.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">{t('status')}</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vacant">{t('vacant')}</SelectItem>
                        <SelectItem value="occupied">{t('occupied')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={formData.status !== 'occupied' ? 'opacity-50' : ''}>
                    <Label htmlFor="occupancy_start">{t('occupancyStart')}</Label>
                    <Input
                      id="occupancy_start"
                      type="text"
                      placeholder="dd/mm/yyyy"
                      value={formData.status === 'occupied' ? formData.occupancy_start : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d/]/g, '');
                        if (value.length <= 10) {
                          setFormData({ ...formData, occupancy_start: value });
                        }
                      }}
                      disabled={formData.status !== 'occupied'}
                    />
                  </div>
                  <div className={formData.status !== 'occupied' ? 'opacity-50' : ''}>
                    <Label htmlFor="subscription_amount">{t('monthlySubscription')}</Label>
                    <Input
                      id="subscription_amount"
                      type="number"
                      step="0.01"
                      value={formData.status === 'occupied' ? formData.subscription_amount : ''}
                      onChange={(e) => setFormData({ ...formData, subscription_amount: e.target.value })}
                      required={formData.status === 'occupied'}
                      disabled={formData.status !== 'occupied'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('autoCalculated').replace('{fee}', String(settings?.monthly_fee || 0))}
                    </p>
                  </div>
                  <div className={formData.status !== 'occupied' ? 'opacity-50' : ''}>
                    <Label htmlFor="subscription_status">{t('subscriptionStatus')}</Label>
                    <Select 
                      value={formData.status === 'occupied' ? formData.subscription_status : ''} 
                      onValueChange={(value) => setFormData({ ...formData, subscription_status: value })}
                      disabled={formData.status !== 'occupied'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="due">{t('due')}</SelectItem>
                        <SelectItem value="paid">{t('paid')}</SelectItem>
                        <SelectItem value="partial">{t('partial')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingApartment ? t('update') : t('create')}
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

        {filteredBuildings.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">{t('noBuildingsFound')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredBuildings.map((building) => {
              const buildingApartments = getApartmentsForBuilding(building.id);
              
              return (
                <Card key={building.id}>
                  <CardHeader>
                    <CardTitle>{building.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {buildingApartments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">{t('noApartmentsInBuilding')}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">{t('apartmentHash')}</TableHead>
                            <TableHead className="text-right">{t('floor')}</TableHead>
                            <TableHead className="text-right">{t('status')}</TableHead>
                            <TableHead className="text-right">{t('owner')} / {t('beneficiary')}</TableHead>
                            <TableHead className="text-right">{t('monthlySubscription')}</TableHead>
                            <TableHead className="text-right">{t('monthsOccupied')}</TableHead>
                            <TableHead className="text-right">{t('totalDebt')}</TableHead>
                            <TableHead className="text-right">{t('credit')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {buildingApartments.map((apartment) => (
                            <TableRow key={apartment.id}>
                              <TableCell className="font-medium text-right">{apartment.apartment_number}</TableCell>
                              <TableCell className="text-right">
                                {apartment.floor ? getFloorDisplayName(apartment.floor) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`px-2 py-1 rounded text-xs ${apartment.status === 'vacant' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  {t(apartment.status as 'vacant' | 'occupied')}
                                </span>
                              </TableCell>
                              <TableCell className={`text-right ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                                <div className="text-sm">
                                  <div>{t('owner')}: {getProfileName(apartment.owner_id)}</div>
                                  <div className="text-muted-foreground">{t('beneficiary')}: {getProfileName(apartment.beneficiary_id)}</div>
                                </div>
                              </TableCell>
                              <TableCell className={`text-right ${apartment.status !== 'occupied' ? 'text-muted-foreground/50' : ''}`}>
                                {apartment.status === 'occupied' ? `₪${apartment.subscription_amount.toFixed(2)}` : '-'}
                              </TableCell>
                              <TableCell className={`text-right ${apartment.status !== 'occupied' ? 'text-muted-foreground/50' : ''}`}>
                                {apartment.status === 'occupied' ? calculateMonthsOccupied(apartment.occupancy_start) : '-'}
                              </TableCell>
                              <TableCell className={`text-right font-semibold ${calculateTotalDebt(apartment) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ₪{Math.abs(calculateTotalDebt(apartment)).toFixed(2)}
                              </TableCell>
                              <TableCell className={`text-right ${apartment.credit > 0 ? 'text-green-600 font-semibold' : apartment.credit < 0 ? 'text-red-600 font-semibold' : ''}`}>
                                ₪{apartment.credit.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => showDebtDetails(apartment)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  {apartment.status === 'occupied' && apartment.occupancy_start && (isAdmin || isModerator) && (
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => openTerminateDialog(apartment)}
                                      className="text-orange-600 hover:text-orange-700"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => handleEdit(apartment)}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => handleDelete(apartment.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AlertDialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen}>
          <AlertDialogContent className="max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('debtDetails')} - {selectedApartment ? `${t('apt')} ${selectedApartment.apartment_number}` : ''}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-6">
              {/* Payments Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">{t('monthlyPayments')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">{t('monthYear')}</TableHead>
                      <TableHead className="text-right">{t('amount')}</TableHead>
                      <TableHead className="text-right">{t('status')}</TableHead>
                      {(isAdmin || isModerator) && <TableHead className="text-right">{t('actions')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apartmentPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(isAdmin || isModerator) ? 4 : 3} className="text-center text-muted-foreground">
                          {t('noPayments')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      apartmentPayments.map((payment) => (
                        <TableRow key={payment.id} className={payment.is_canceled ? 'opacity-50' : ''}>
                          <TableCell className="text-right font-medium">{payment.month}</TableCell>
                          <TableCell className="text-right text-green-600">₪{payment.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              payment.is_canceled 
                                ? 'bg-gray-100 text-gray-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {payment.is_canceled ? t('canceled') : t('active')}
                            </span>
                          </TableCell>
                          {(isAdmin || isModerator) && (
                            <TableCell className="text-right">
                              {!payment.is_canceled && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleCancelPayment(payment.id, payment.apartment_id, payment.amount)}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  {t('cancel')}
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Debt Summary Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">{t('debtSummary')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">{t('monthYear')}</TableHead>
                      <TableHead className="text-right">{t('amountDue')}</TableHead>
                      <TableHead className="text-right">{t('amountPaid')}</TableHead>
                      <TableHead className="text-right">{t('balance')}</TableHead>
                      {(isAdmin || isModerator) && <TableHead className="text-right">{t('actions')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debtDetails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(isAdmin || isModerator) ? 5 : 4} className="text-center text-muted-foreground">
                          {t('noData')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      debtDetails.map((detail, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-right font-medium">{detail.month}</TableCell>
                          <TableCell className="text-right">₪{detail.amount_due.toFixed(2)}</TableCell>
                          <TableCell className="text-right">₪{detail.amount_paid.toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-semibold ${detail.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₪{Math.abs(detail.balance).toFixed(2)}
                          </TableCell>
                          {(isAdmin || isModerator) && (
                            <TableCell className="text-right">
                              {detail.balance > 0 && !detail.payment_id && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleWaiveSubscription(detail.month, detail.amount_due)}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  {t('waive')}
                                </Button>
                              )}
                              {detail.payment_id && !detail.is_payment_canceled && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleCancelPayment(detail.payment_id, selectedApartment!.id, detail.amount_paid)}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  {t('cancelPayment')}
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {apartmentExpenses.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">{t('buildingExpenses')}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{t('description')}</TableHead>
                        <TableHead className="text-right">{t('date')}</TableHead>
                        <TableHead className="text-right">{t('amount')}</TableHead>
                        <TableHead className="text-right">{t('status')}</TableHead>
                        {(isAdmin || isModerator) && <TableHead className="text-right">{t('actions')}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apartmentExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="text-right">{expense.expense?.description || '-'}</TableCell>
                          <TableCell className="text-right">{expense.created_at ? new Date(expense.created_at).toLocaleDateString() : '-'}</TableCell>
                          <TableCell className="text-right text-red-600 font-medium">₪{expense.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              expense.is_canceled 
                                ? 'bg-gray-100 text-gray-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {expense.is_canceled ? t('canceled') : t('active')}
                            </span>
                          </TableCell>
                          {(isAdmin || isModerator) && (
                            <TableCell className="text-right">
                              {!expense.is_canceled && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleCancelExpense(expense.id, expense.apartment_id, expense.amount)}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  {t('cancel')}
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setDebtDialogOpen(false)}>{t('close')}</Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={terminateDialogOpen} onOpenChange={setTerminateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('terminateOccupancy')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('terminateOccupancyConfirm')
                  .replace('{apartment}', apartmentToTerminate?.apartment_number || '')
                  .replace('{credit}', `₪${calculatedTerminationCredit.toFixed(2)}`)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setTerminateDialogOpen(false);
                setApartmentToTerminate(null);
              }}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleTerminateOccupancy}>
                {t('confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Apartments;
