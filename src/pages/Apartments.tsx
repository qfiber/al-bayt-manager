import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Home, Plus, Pencil, Trash2, Eye, XCircle, Calendar as CalendarIcon, Eraser, Package, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Apartment {
  id: string;
  apartmentNumber: string;
  buildingId: string;
  floor: number | null;
  status: string;
  occupancyStart: string | null;
  subscriptionAmount: string;
  subscriptionStatus: string;
  cachedBalance: string;
  ownerId: string | null;
  beneficiaryId: string | null;
  apartmentType: string;
  parentApartmentId: string | null;
}

interface ApartmentListItem {
  apartment: Apartment;
  buildingName: string;
  ownerName: string | null;
  beneficiaryName: string | null;
}

interface Building {
  id: string;
  name: string;
  numberOfFloors: number | null;
  undergroundFloors: number | null;
  monthlyFee: string | null;
}

interface User {
  id: string;
  name: string;
}

const Apartments = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t, language } = useLanguage();
  const { currencySymbol, formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [apartmentItems, setApartmentItems] = useState<ApartmentListItem[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [apartmentToTerminate, setApartmentToTerminate] = useState<Apartment | null>(null);
  const [calculatedTerminationCredit, setCalculatedTerminationCredit] = useState(0);
  const [occupancyDate, setOccupancyDate] = useState<Date | undefined>();
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    apartment_number: '',
    building_id: '',
    floor: '',
    status: 'vacant',
    subscription_amount: '',
    subscription_status: 'inactive',
    apartment_type: 'regular' as 'regular' | 'storage' | 'parking',
    parent_apartment_id: '',
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
      fetchBuildings();
      fetchApartments();
      fetchProfiles();
    }
  }, [user, isAdmin]);

  const calculateProratedAmount = (startDate: Date, monthlyFee: number): number => {
    if (!monthlyFee) return monthlyFee;

    const dayOfMonth = startDate.getDate();

    // If occupancy starts on the 1st, use full monthly fee
    if (dayOfMonth === 1) return monthlyFee;

    // Calculate prorated amount based on days left in month
    const year = startDate.getFullYear();
    const month = startDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysRemaining = daysInMonth - dayOfMonth + 1;

    const proratedAmount = (monthlyFee / daysInMonth) * daysRemaining;
    return Math.round(proratedAmount * 100) / 100;
  };

  useEffect(() => {
    const selectedBuilding = buildings.find(b => b.id === formData.building_id);
    const buildingFee = parseFloat(selectedBuilding?.monthlyFee || '0');
    if (occupancyDate && buildingFee) {
      const calculatedAmount = calculateProratedAmount(occupancyDate, buildingFee);
      setFormData(prev => ({ ...prev, subscription_amount: calculatedAmount.toString() }));
    } else if (buildingFee && !occupancyDate) {
      setFormData(prev => ({ ...prev, subscription_amount: buildingFee.toString() }));
    }
  }, [occupancyDate, formData.building_id, buildings]);

  const fetchBuildings = async () => {
    try {
      const data = await api.get<Building[]>('/buildings');
      setBuildings(data);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchApartments = async () => {
    try {
      const data = await api.get<ApartmentListItem[]>('/apartments');
      setApartmentItems(data);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchProfiles = async () => {
    try {
      const data = await api.get<User[]>('/users');
      setProfiles(data.map(u => ({ id: u.id, name: u.name })));
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dbDate = occupancyDate ? format(occupancyDate, 'yyyy-MM-dd') : null;

    const subscriptionAmount = parseFloat(formData.subscription_amount) || 0;

    const apartmentData: Record<string, any> = {
      apartmentNumber: formData.apartment_number,
      buildingId: formData.building_id,
      floor: formData.floor ? (formData.floor === 'Ground' ? 0 : parseInt(formData.floor)) : undefined,
      status: formData.status,
      occupancyStart: dbDate,
      subscriptionAmount: subscriptionAmount.toString(),
      subscriptionStatus: formData.subscription_status,
      apartmentType: formData.apartment_type,
      parentApartmentId: formData.apartment_type !== 'regular' ? formData.parent_apartment_id || null : null,
    };

    if (editingApartment) {
      try {
        await api.put(`/apartments/${editingApartment.id}`, apartmentData);
        toast({ title: t('success'), description: t('apartmentUpdatedSuccess') });
        fetchApartments();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    } else {
      try {
        await api.post('/apartments', apartmentData);
        toast({ title: t('success'), description: t('apartmentCreatedSuccess') });
        fetchApartments();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteApartmentConfirm'))) return;

    try {
      await api.delete(`/apartments/${id}`);
      toast({ title: t('success'), description: t('apartmentDeletedSuccess') });
      fetchApartments();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (apartment: Apartment) => {
    setEditingApartment(apartment);
    setOccupancyDate(apartment.occupancyStart ? new Date(apartment.occupancyStart) : undefined);
    setFormData({
      apartment_number: apartment.apartmentNumber,
      building_id: apartment.buildingId,
      floor: apartment.floor != null ? (apartment.floor === 0 ? 'Ground' : apartment.floor.toString()) : '',
      status: apartment.status,
      subscription_amount: apartment.subscriptionAmount,
      subscription_status: apartment.subscriptionStatus,
      apartment_type: (apartment.apartmentType || 'regular') as 'regular' | 'storage' | 'parking',
      parent_apartment_id: apartment.parentApartmentId || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      apartment_number: '',
      building_id: '',
      floor: '',
      status: 'vacant',
      subscription_amount: '',
      subscription_status: 'inactive',
      apartment_type: 'regular',
      parent_apartment_id: '',
    });
    setOccupancyDate(undefined);
    setOpenPopover(null);
    setEditingApartment(null);
    setIsDialogOpen(false);
  };

  const getBuildingName = (buildingId: string) => {
    const item = apartmentItems.find(a => a.apartment.buildingId === buildingId);
    if (item) return item.buildingName;
    return buildings.find(b => b.id === buildingId)?.name || t('unknown');
  };

  const getOwnerName = (apartmentId: string) => {
    const item = apartmentItems.find(a => a.apartment.id === apartmentId);
    return item?.ownerName || '-';
  };

  const getBeneficiaryName = (apartmentId: string) => {
    const item = apartmentItems.find(a => a.apartment.id === apartmentId);
    return item?.beneficiaryName || '-';
  };

  const getParentApartmentNumber = (parentId: string | null) => {
    if (!parentId) return null;
    const item = apartmentItems.find(a => a.apartment.id === parentId);
    return item?.apartment.apartmentNumber || null;
  };

  // Get regular occupied apartments in the same building (for parent dropdown)
  const getRegularApartmentsForBuilding = (buildingId: string) => {
    return apartmentItems
      .filter(a => a.apartment.buildingId === buildingId && a.apartment.apartmentType === 'regular')
      .map(a => a.apartment);
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

  // Get floor options for a building
  // numberOfFloors includes ground floor, so if 4 floors: Ground, 1st, 2nd, 3rd
  // includeUnderground: adds underground floors (-1, -2, etc.) for storage/parking
  const getFloorOptions = (buildingId: string, includeUnderground: boolean = false) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return [];

    const floors: { value: string; label: string }[] = [];

    // Add underground floors if requested (for storage/parking)
    if (includeUnderground) {
      const undergroundCount = building.undergroundFloors || 0;
      for (let i = -undergroundCount; i <= -1; i++) {
        floors.push({ value: i.toString(), label: getFloorDisplayName(i.toString()) });
      }
    }

    // Add ground floor
    floors.push({ value: 'Ground', label: t('groundFloor') });

    // Add above-ground floors (numFloors - 1 because ground floor is included in the count)
    const numFloors = building.numberOfFloors || 0;
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
    // cachedBalance: negative = debt, positive = overpayment
    const balance = parseFloat(apartment.cachedBalance);
    return Math.max(0, -balance);
  };

  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);
  const [apartmentToWriteOff, setApartmentToWriteOff] = useState<Apartment | null>(null);

  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [debtDetails, setDebtDetails] = useState<any[]>([]);
  const [apartmentExpenses, setApartmentExpenses] = useState<any[]>([]);
  const [apartmentPayments, setApartmentPayments] = useState<any[]>([]);
  const [occupancyPeriods, setOccupancyPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('current');

  const calculateTerminationCredit = (apartment: Apartment): number => {
    if (!apartment.occupancyStart) return 0;

    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentDay + 1;

    const subscriptionAmount = parseFloat(apartment.subscriptionAmount);
    const creditForRemainingDays = (subscriptionAmount / daysInMonth) * daysRemaining;
    return Math.round(creditForRemainingDays * 100) / 100;
  };

  const handleTerminateOccupancy = async () => {
    if (!apartmentToTerminate) return;

    try {
      await api.post(`/apartments/${apartmentToTerminate.id}/terminate`);
      toast({
        title: t('success'),
        description: t('occupancyTerminated').replace('{credit}', formatCurrency(calculatedTerminationCredit))
      });
      fetchApartments();
      setTerminateDialogOpen(false);
      setApartmentToTerminate(null);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const openTerminateDialog = (apartment: Apartment) => {
    setApartmentToTerminate(apartment);
    const credit = calculateTerminationCredit(apartment);
    setCalculatedTerminationCredit(credit);
    setTerminateDialogOpen(true);
  };

  const showDebtDetails = async (apartment: Apartment, periodId: string = 'current') => {
    setSelectedApartment(apartment);

    try {
      // Fetch periods for admin period selector
      try {
        const periods = await api.get<any[]>(`/apartments/${apartment.id}/periods`);
        setOccupancyPeriods(periods || []);
      } catch {
        setOccupancyPeriods([]);
      }

      const periodParam = periodId === 'current' ? '' : `?periodId=${periodId}`;
      const data = await api.get<{
        apartment: Apartment;
        balance: number;
        expenses: any[];
        payments: any[];
        ledger: any[];
        periodId: string | null;
        subscriptionAllocations: Record<string, number>;
      }>(`/apartments/${apartment.id}/debt-details${periodParam}`);

      setApartmentExpenses(data.expenses || []);
      setApartmentPayments(data.payments || []);
      setSelectedPeriodId(periodId);

      const subAllocations = data.subscriptionAllocations || {};

      // Build debt rows from subscription ledger entries, one per source per month
      // Description format: "Monthly subscription YYYY-MM" or "Storage S-1 subscription YYYY-MM"
      const subscriptionEntries = (data.ledger || []).filter(
        (e: any) => e.referenceType === 'subscription' && e.entryType === 'debit'
      );

      // Group by source+month so apartment and storage subscriptions are separate rows
      const rowMap = new Map<string, { month: string; label: string; amountDue: number; amountPaid: number; sortKey: string }>();
      for (const entry of subscriptionEntries) {
        const desc = entry.description || '';
        const match = desc.match(/(\d{4})-(\d{2})$/);
        if (!match) continue;

        const monthStr = `${match[2]}/${match[1]}`; // MM/YYYY
        const sortKey = `${match[1]}-${match[2]}`; // YYYY-MM for sorting

        // Extract source label from the part before "subscription YYYY-MM"
        const prefixMatch = desc.match(/^(.+?)\s+subscription\s+/i);
        const sourceLabel = prefixMatch ? prefixMatch[1].trim() : t('monthlySubscription').replace(/ \(.*?\)/, '');

        const key = `${monthStr}|${sourceLabel}`;
        const existing = rowMap.get(key);
        const allocated = subAllocations[entry.id] || 0;

        if (existing) {
          existing.amountDue += parseFloat(entry.amount);
          existing.amountPaid += allocated;
        } else {
          rowMap.set(key, {
            month: monthStr,
            label: sourceLabel,
            amountDue: parseFloat(entry.amount),
            amountPaid: allocated,
            sortKey,
          });
        }
      }

      // Sort: chronologically by month, then by label
      const details = [...rowMap.values()]
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.label.localeCompare(b.label))
        .map(row => ({
          month: row.month,
          label: row.label,
          amount_due: row.amountDue,
          amount_paid: row.amountPaid,
          balance: Math.round((row.amountDue - row.amountPaid) * 100) / 100,
          payment_id: null as string | null,
          is_payment_canceled: false,
        }));

      setDebtDetails(details);
      setDebtDialogOpen(true);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handlePeriodChange = (periodId: string) => {
    if (selectedApartment) {
      showDebtDetails(selectedApartment, periodId);
    }
  };

  const handleWaiveSubscription = async (month: string, amount: number) => {
    if (!selectedApartment) return;

    try {
      // Create a payment (waiver) for this month via the payments API
      await api.post('/payments', {
        apartmentId: selectedApartment.id,
        month: month,
        amount: amount,
      });

      toast({ title: t('success'), description: t('subscriptionWaived') });

      // Refresh data
      await fetchApartments();
      // Re-fetch debt details with updated apartment data
      const updatedItems = await api.get<ApartmentListItem[]>('/apartments');
      const updatedItem = updatedItems.find(a => a.apartment.id === selectedApartment.id);
      if (updatedItem) {
        await showDebtDetails(updatedItem.apartment);
      }
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleCancelPayment = async (paymentId: string, apartmentId: string, _paymentAmount: number) => {
    try {
      await api.post(`/payments/${paymentId}/cancel`);

      toast({ title: t('success'), description: t('paymentCanceled') });

      // Refresh data
      await fetchApartments();
      if (selectedApartment) {
        // Re-fetch debt details with updated apartment data
        const updatedItems = await api.get<ApartmentListItem[]>('/apartments');
        const updatedItem = updatedItems.find(a => a.apartment.id === apartmentId);
        if (updatedItem) {
          await showDebtDetails(updatedItem.apartment);
        }
      }
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleCancelExpense = async (expenseId: string, apartmentId: string, _amount: number) => {
    try {
      await api.post(`/apartment-expenses/${expenseId}/cancel`);

      toast({ title: t('success'), description: t('expenseCanceled') });

      // Refresh data
      await fetchApartments();
      if (selectedApartment) {
        // Re-fetch debt details with updated apartment data
        const updatedItems = await api.get<ApartmentListItem[]>('/apartments');
        const updatedItem = updatedItems.find(a => a.apartment.id === apartmentId);
        if (updatedItem) {
          await showDebtDetails(updatedItem.apartment);
        }
      }
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const openWriteOffDialog = (apartment: Apartment) => {
    setApartmentToWriteOff(apartment);
    setWriteOffDialogOpen(true);
  };

  const handleWriteOffBalance = async () => {
    if (!apartmentToWriteOff) return;

    try {
      await api.post(`/apartments/${apartmentToWriteOff.id}/write-off-balance`);
      toast({ title: t('success'), description: t('balanceWrittenOff') });
      fetchApartments();
      setWriteOffDialogOpen(false);
      setApartmentToWriteOff(null);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  const filteredBuildings = selectedBuildingFilter === 'all'
    ? buildings
    : buildings.filter(b => b.id === selectedBuildingFilter);

  const getApartmentsForBuilding = (buildingId: string) => {
    // Return only regular apartments + orphan storage/parking (no parent set)
    return apartmentItems
      .filter(a => a.apartment.buildingId === buildingId && !a.apartment.parentApartmentId)
      .map(a => a.apartment);
  };

  const getChildApartments = (parentId: string) => {
    return apartmentItems
      .filter(a => a.apartment.parentApartmentId === parentId)
      .map(a => a.apartment);
  };

  const selectedBuildingForForm = buildings.find(b => b.id === formData.building_id);
  const monthlyFee = parseFloat(selectedBuildingForForm?.monthlyFee || '0');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
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
                  <Plus className="w-4 h-4 me-2" />
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
                    <Label>{t('apartmentType')}</Label>
                    <Select
                      value={formData.apartment_type}
                      onValueChange={(value: 'regular' | 'storage' | 'parking') => setFormData({ ...formData, apartment_type: value, parent_apartment_id: value === 'regular' ? '' : formData.parent_apartment_id })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">{t('regular')}</SelectItem>
                        <SelectItem value="storage">{t('storageRoom')}</SelectItem>
                        <SelectItem value="parking">{t('parkingSpot')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.apartment_type !== 'regular' && (
                    <div>
                      <Label>{t('parentApartment')}</Label>
                      <Select
                        value={formData.parent_apartment_id}
                        onValueChange={(value) => setFormData({ ...formData, parent_apartment_id: value })}
                        disabled={!formData.building_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectParentApartment')} />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.building_id && getRegularApartmentsForBuilding(formData.building_id).map((apt) => (
                            <SelectItem key={apt.id} value={apt.id}>
                              {t('apt')} {apt.apartmentNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                        {formData.building_id && getFloorOptions(formData.building_id, formData.apartment_type !== 'regular').map((floor) => (
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
                    <Label>{t('occupancyStart')}</Label>
                    <Popover open={openPopover === 'occupancy-start'} onOpenChange={(open) => setOpenPopover(open ? 'occupancy-start' : null)}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={formData.status !== 'occupied'}
                          className={cn("w-full justify-start text-start font-normal", !occupancyDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="me-2 h-4 w-4" />
                          {formData.status === 'occupied' && occupancyDate
                            ? format(occupancyDate, 'dd/MM/yyyy')
                            : t('selectDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={occupancyDate}
                          onSelect={(date) => { setOccupancyDate(date); setOpenPopover(null); }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className={formData.status !== 'occupied' ? 'opacity-50' : ''}>
                    <Label htmlFor="subscription_amount">{t('monthlySubscription').replace('{currency}', currencySymbol)}</Label>
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
                      {t('autoCalculated').replace('{currency}', currencySymbol).replace('{fee}', String(monthlyFee))}
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
                        <SelectItem value="active">{t('active')}</SelectItem>
                        <SelectItem value="inactive">{t('inactive')}</SelectItem>
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
                      <Table className="min-w-[900px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-start">{t('apartmentHash')}</TableHead>
                            <TableHead className="text-start">{t('floor')}</TableHead>
                            <TableHead className="text-start">{t('status')}</TableHead>
                            <TableHead className="text-start">{t('owner')} / {t('beneficiary')}</TableHead>
                            <TableHead className="text-start">{t('monthlySubscription').replace('{currency}', currencySymbol)}</TableHead>
                            <TableHead className="text-start">{t('monthsOccupied')}</TableHead>
                            <TableHead className="text-start">{t('totalDebt')}</TableHead>
                            <TableHead className="text-start">{t('credit').replace('{currency}', currencySymbol)}</TableHead>
                            <TableHead className="text-start">{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {buildingApartments.map((apartment) => {
                            const balance = parseFloat(apartment.cachedBalance);
                            const subscriptionAmount = parseFloat(apartment.subscriptionAmount);
                            const children = getChildApartments(apartment.id);
                            return (
                              <React.Fragment key={apartment.id}>
                              <TableRow>
                                <TableCell className="font-medium text-start">
                                  <div className="flex items-center gap-2">
                                    {apartment.apartmentNumber}
                                    {apartment.apartmentType === 'storage' && (
                                      <Badge variant="secondary" className="text-xs gap-1">
                                        <Package className="w-3 h-3" />
                                        {t('storageRoom')}
                                      </Badge>
                                    )}
                                    {apartment.apartmentType === 'parking' && (
                                      <Badge variant="secondary" className="text-xs gap-1">
                                        <Car className="w-3 h-3" />
                                        {t('parkingSpot')}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-start">
                                  {apartment.floor != null ? getFloorDisplayName(apartment.floor === 0 ? 'Ground' : apartment.floor.toString()) : '-'}
                                </TableCell>
                                <TableCell className="text-start">
                                  <span className={`px-2 py-1 rounded text-xs ${apartment.status === 'vacant' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {t(apartment.status as 'vacant' | 'occupied')}
                                  </span>
                                </TableCell>
                                <TableCell className={`text-start ${language === 'ar' || language === 'he' ? 'text-start' : ''}`}>
                                  <div className="text-sm">
                                    <div>{t('owner')}: {getOwnerName(apartment.id)}</div>
                                    <div className="text-muted-foreground">{t('beneficiary')}: {getBeneficiaryName(apartment.id)}</div>
                                  </div>
                                </TableCell>
                                <TableCell className={`text-start ${apartment.status !== 'occupied' ? 'text-muted-foreground/50' : ''}`}>
                                  {apartment.status === 'occupied' ? formatCurrency(subscriptionAmount) : '-'}
                                </TableCell>
                                <TableCell className={`text-start ${apartment.status !== 'occupied' ? 'text-muted-foreground/50' : ''}`}>
                                  {apartment.status === 'occupied' ? calculateMonthsOccupied(apartment.occupancyStart) : '-'}
                                </TableCell>
                                <TableCell className={`text-start font-semibold ${calculateTotalDebt(apartment) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {formatCurrency(Math.abs(calculateTotalDebt(apartment)))}
                                </TableCell>
                                <TableCell className={`text-start ${balance > 0 ? 'text-green-600 font-semibold' : balance < 0 ? 'text-red-600 font-semibold' : ''}`}>
                                  {formatCurrency(balance)}
                                </TableCell>
                                <TableCell className="text-start">
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => showDebtDetails(apartment)}>
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    {apartment.status === 'occupied' && apartment.occupancyStart && (isAdmin || isModerator) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openTerminateDialog(apartment)}
                                        className="text-orange-600 hover:text-orange-700"
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {parseFloat(apartment.cachedBalance) !== 0 && isAdmin && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openWriteOffDialog(apartment)}
                                        title={t('writeOffBalance')}
                                        className="text-purple-600 hover:text-purple-700"
                                      >
                                        <Eraser className="w-4 h-4" />
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
                              {/* Child sub-rows (storage rooms / parking lots) */}
                              {children.map((child) => {
                                const childSub = parseFloat(child.subscriptionAmount);
                                return (
                                  <TableRow key={child.id} className="bg-muted/30">
                                    <TableCell className="text-start ps-8">
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <span className="text-xs opacity-60">└</span>
                                        {child.apartmentType === 'storage' ? (
                                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                        ) : (
                                          <Car className="w-3.5 h-3.5 text-muted-foreground" />
                                        )}
                                        <span className="text-sm font-medium text-foreground">{child.apartmentNumber}</span>
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                          {child.apartmentType === 'storage' ? t('storageRoom') : t('parkingSpot')}
                                        </Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-start text-sm text-muted-foreground">
                                      {child.floor != null ? getFloorDisplayName(child.floor === 0 ? 'Ground' : child.floor.toString()) : '-'}
                                    </TableCell>
                                    <TableCell className="text-start">
                                      <span className={`px-2 py-1 rounded text-xs ${child.status === 'vacant' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {t(child.status as 'vacant' | 'occupied')}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-start text-sm text-muted-foreground">-</TableCell>
                                    <TableCell className={`text-start text-sm ${child.status !== 'occupied' ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                      {child.status === 'occupied' ? formatCurrency(childSub) : '-'}
                                    </TableCell>
                                    <TableCell className="text-start text-sm text-muted-foreground">-</TableCell>
                                    <TableCell className="text-start text-sm text-muted-foreground">-</TableCell>
                                    <TableCell className="text-start text-sm text-muted-foreground">-</TableCell>
                                    <TableCell className="text-start">
                                      <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleEdit(child)}>
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleDelete(child.id)}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              </React.Fragment>
                            );
                          })}
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
                {t('debtDetails')} - {selectedApartment ? `${t('apt')} ${selectedApartment.apartmentNumber}` : ''}
              </AlertDialogTitle>
            </AlertDialogHeader>

            {/* Period Selector */}
            {occupancyPeriods.length > 0 && (
              <div className="flex items-center gap-3 pb-2 border-b">
                <span className="text-sm font-medium text-muted-foreground">{t('occupancyPeriods')}:</span>
                <Select value={selectedPeriodId} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">{t('currentPeriod')}</SelectItem>
                    <SelectItem value="all">{t('allTime')}</SelectItem>
                    {occupancyPeriods
                      .filter((p: any) => p.status === 'closed')
                      .map((period: any) => (
                        <SelectItem key={period.id} value={period.id}>
                          {period.tenantName || t('periodTenant')} ({new Date(period.startDate).toLocaleDateString()} - {period.endDate ? new Date(period.endDate).toLocaleDateString() : '...'})
                          {period.closingBalance != null && ` — ${formatCurrency(parseFloat(period.closingBalance))}`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto space-y-6">
              {/* Payments Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">{t('monthlyPayments')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('monthYear')}</TableHead>
                      <TableHead className="text-start">{t('amount')}</TableHead>
                      <TableHead className="text-start">{t('status')}</TableHead>
                      {(isAdmin || isModerator) && <TableHead className="text-start">{t('actions')}</TableHead>}
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
                        <TableRow key={payment.id} className={payment.isCanceled ? 'opacity-50' : ''}>
                          <TableCell className="text-start font-medium">{payment.month}</TableCell>
                          <TableCell className="text-start text-green-600">{formatCurrency(parseFloat(payment.amount))}</TableCell>
                          <TableCell className="text-start">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              payment.isCanceled
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {payment.isCanceled ? t('canceled') : t('active')}
                            </span>
                          </TableCell>
                          {(isAdmin || isModerator) && (
                            <TableCell className="text-start">
                              {!payment.isCanceled && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelPayment(payment.id, payment.apartmentId, parseFloat(payment.amount))}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 me-1" />
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
                      <TableHead className="text-start">{t('monthYear')}</TableHead>
                      <TableHead className="text-start">{t('amountDue')}</TableHead>
                      <TableHead className="text-start">{t('amountPaid')}</TableHead>
                      <TableHead className="text-start">{t('balance')}</TableHead>
                      {(isAdmin || isModerator) && <TableHead className="text-start">{t('actions')}</TableHead>}
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
                          <TableCell className="text-start">
                            <div className="font-medium">{detail.month}</div>
                            {detail.label && (
                              <div className="text-xs text-muted-foreground">{detail.label}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-start">{formatCurrency(detail.amount_due)}</TableCell>
                          <TableCell className="text-start">{formatCurrency(detail.amount_paid)}</TableCell>
                          <TableCell className={`text-start font-semibold ${detail.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(Math.abs(detail.balance))}
                          </TableCell>
                          {(isAdmin || isModerator) && (
                            <TableCell className="text-start">
                              {detail.balance > 0 && !detail.payment_id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleWaiveSubscription(detail.month, detail.amount_due)}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 me-1" />
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
                                  <XCircle className="w-4 h-4 me-1" />
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
                        <TableHead className="text-start">{t('description')}</TableHead>
                        <TableHead className="text-start">{t('date')}</TableHead>
                        <TableHead className="text-start">{t('amount')}</TableHead>
                        <TableHead className="text-start">{t('status')}</TableHead>
                        {(isAdmin || isModerator) && <TableHead className="text-start">{t('actions')}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apartmentExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="text-start">{expense.description || '-'}</TableCell>
                          <TableCell className="text-start">{expense.expenseDate || (expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : '-')}</TableCell>
                          <TableCell className="text-start text-red-600 font-medium">{formatCurrency(parseFloat(expense.amount))}</TableCell>
                          <TableCell className="text-start">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              expense.isCanceled
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {expense.isCanceled ? t('canceled') : t('active')}
                            </span>
                          </TableCell>
                          {(isAdmin || isModerator) && (
                            <TableCell className="text-start">
                              {!expense.isCanceled && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelExpense(expense.id, expense.apartmentId, parseFloat(expense.amount))}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <XCircle className="w-4 h-4 me-1" />
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
                  .replace('{apartment}', apartmentToTerminate?.apartmentNumber || '')
                  .replace('{credit}', formatCurrency(calculatedTerminationCredit))}
                {' '}
                {t('periodClosedNote')}
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

        <AlertDialog open={writeOffDialogOpen} onOpenChange={setWriteOffDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('writeOffBalance')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('writeOffBalanceConfirm')
                  .replace('{currency}', currencySymbol)
                  .replace('{apartment}', apartmentToWriteOff?.apartmentNumber || '')
                  .replace('{balance}', Math.abs(parseFloat(apartmentToWriteOff?.cachedBalance || '0')).toFixed(2))}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setWriteOffDialogOpen(false);
                setApartmentToWriteOff(null);
              }}>
                {t('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleWriteOffBalance}>
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
