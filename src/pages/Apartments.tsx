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
import { useToast } from '@/hooks/use-toast';
import { Home, Plus, Pencil, Trash2 } from 'lucide-react';

interface Apartment {
  id: string;
  apartment_number: string;
  building_id: string;
  status: string;
  occupancy_start: string | null;
  subscription_amount: number;
  subscription_status: string;
  credit: number;
}

interface Building {
  id: string;
  name: string;
}

interface Settings {
  monthly_fee: number;
}

const Apartments = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [formData, setFormData] = useState({
    apartment_number: '',
    building_id: '',
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

    const startDate = new Date(occupancyStart);
    const dayOfMonth = startDate.getDate();

    // If occupancy starts on the 1st, use full monthly fee
    if (dayOfMonth === 1) return monthlyFee;

    // Calculate prorated amount based on days left in month
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const apartmentData = {
      apartment_number: formData.apartment_number,
      building_id: formData.building_id,
      status: formData.status,
      occupancy_start: formData.occupancy_start || null,
      subscription_amount: parseFloat(formData.subscription_amount) || 0,
      subscription_status: formData.subscription_status,
      credit: 0,
    };

    if (editingApartment) {
      const { error } = await supabase
        .from('apartments')
        .update(apartmentData)
        .eq('id', editingApartment.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Apartment updated successfully' });
        fetchApartments();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('apartments')
        .insert([apartmentData]);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Apartment created successfully' });
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
    // Temporarily disable auto-calculation for editing
    const currentFormData = {
      apartment_number: apartment.apartment_number,
      building_id: apartment.building_id,
      status: apartment.status,
      occupancy_start: apartment.occupancy_start || '',
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Home className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('apartments')}</h1>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
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
                  <div>
                    <Label htmlFor="occupancy_start">{t('occupancyStart')}</Label>
                    <Input
                      id="occupancy_start"
                      type="date"
                      value={formData.occupancy_start}
                      onChange={(e) => setFormData({ ...formData, occupancy_start: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="subscription_amount">{t('monthlySubscription')}</Label>
                    <Input
                      id="subscription_amount"
                      type="number"
                      step="0.01"
                      value={formData.subscription_amount}
                      onChange={(e) => setFormData({ ...formData, subscription_amount: e.target.value })}
                      required
                      disabled={!editingApartment}
                    />
                    {!editingApartment && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('autoCalculated').replace('{fee}', String(settings?.monthly_fee || 0))}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="subscription_status">{t('subscriptionStatus')}</Label>
                    <Select value={formData.subscription_status} onValueChange={(value) => setFormData({ ...formData, subscription_status: value })}>
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

        <Card>
          <CardHeader>
            <CardTitle>{t('allApartments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t('apartmentHash')}</TableHead>
                  <TableHead className="text-right">{t('building')}</TableHead>
                  <TableHead className="text-right">{t('status')}</TableHead>
                  <TableHead className="text-right">{t('monthlySubscription')}</TableHead>
                  <TableHead className="text-right">{t('subscriptionStatus')}</TableHead>
                  <TableHead className="text-right">{t('credit')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {t('noApartmentsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  apartments.map((apartment) => (
                    <TableRow key={apartment.id}>
                      <TableCell className="font-medium text-right">{apartment.apartment_number}</TableCell>
                      <TableCell className="text-right">{getBuildingName(apartment.building_id)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`px-2 py-1 rounded text-xs ${apartment.status === 'vacant' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {t(apartment.status as 'vacant' | 'occupied')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">₪{apartment.subscription_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`px-2 py-1 rounded text-xs ${
                          apartment.subscription_status === 'paid' ? 'bg-green-100 text-green-800' : 
                          apartment.subscription_status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {t(apartment.subscription_status as 'paid' | 'due' | 'partial')}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right ${apartment.credit > 0 ? 'text-green-600 font-semibold' : apartment.credit < 0 ? 'text-red-600 font-semibold' : ''}`}>
                        ₪{apartment.credit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(apartment)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(apartment.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

export default Apartments;
