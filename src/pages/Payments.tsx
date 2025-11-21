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
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react';

interface Payment {
  id: string;
  apartment_id: string;
  amount: number;
  month: string;
}

interface Apartment {
  id: string;
  apartment_number: string;
  building_id: string;
  subscription_amount: number;
  credit: number;
}

interface Building {
  id: string;
  name: string;
}

const Payments = () => {
  const { user, isAdmin, loading } = useAuth();
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
    month: '',
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
      fetchPayments();
    }
  }, [user, isAdmin]);

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
      setPayments(data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paymentData = {
      apartment_id: formData.apartment_id,
      amount: parseFloat(formData.amount),
      month: formData.month,
    };

    if (editingPayment) {
      const { error } = await supabase
        .from('payments')
        .update(paymentData)
        .eq('id', editingPayment.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Payment updated successfully' });
        await updateApartmentCredit(formData.apartment_id, parseFloat(formData.amount));
        fetchPayments();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('payments')
        .insert([paymentData]);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Payment created successfully' });
        await updateApartmentCredit(formData.apartment_id, parseFloat(formData.amount));
        fetchPayments();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deletePaymentConfirm'))) return;

    // Get payment details before deletion
    const payment = payments.find(p => p.id === id);
    if (!payment) return;

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Recalculate apartment credit and status after deletion
      const { data: remainingPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('apartment_id', payment.apartment_id);

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

        await supabase
          .from('apartments')
          .update({ 
            credit: newCredit,
            subscription_status: newStatus
          })
          .eq('id', payment.apartment_id);
      }

      toast({ title: 'Success', description: 'Payment deleted successfully' });
      fetchPayments();
      fetchApartments();
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      apartment_id: payment.apartment_id,
      amount: payment.amount.toString(),
      month: payment.month,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      apartment_id: '',
      amount: '',
      month: '',
    });
    setEditingPayment(null);
    setIsDialogOpen(false);
  };

  const getApartmentInfo = (apartmentId: string) => {
    const apartment = apartments.find(a => a.id === apartmentId);
    if (!apartment) return t('unknown');
    const building = buildings.find(b => b.id === apartment.building_id);
    return `${building?.name || t('unknown')} - ${t('apt')} ${apartment.apartment_number}`;
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
            <CreditCard className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('payments')}</h1>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('addPayment')}
                </Button>
              </DialogTrigger>
              <DialogContent>
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
                  <div>
                    <Label htmlFor="month">{t('monthFormat')}</Label>
                    <Input
                      id="month"
                      type="text"
                      placeholder="01/2025"
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      required
                    />
                  </div>
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
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium text-right">{getApartmentInfo(payment.apartment_id)}</TableCell>
                      <TableCell className="text-right">₪{payment.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{payment.month}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(payment)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(payment.id)}>
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

export default Payments;
