import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Home } from 'lucide-react';
import { formatDate } from '@/lib/utils';

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
  address: string;
}

interface Payment {
  id: string;
  apartment_id: string;
  amount: number;
  month: string;
  created_at: string;
}

interface ApartmentExpense {
  id: string;
  apartment_id: string;
  expense_id: string;
  amount: number;
  created_at: string;
  is_canceled: boolean;
  expense?: {
    description: string;
    expense_date: string;
  };
}

interface ApartmentWithDetails extends Apartment {
  building: Building | null;
  payments: Payment[];
  apartmentExpenses: ApartmentExpense[];
}

const MyApartments = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [apartments, setApartments] = useState<ApartmentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchMyApartments();
    }
  }, [user]);

  const fetchMyApartments = async () => {
    try {
      setIsLoading(true);
      
      const { data: userApartments, error: assignError } = await supabase
        .from('user_apartments')
        .select('apartment_id')
        .eq('user_id', user?.id);

      if (assignError) throw assignError;

      if (!userApartments || userApartments.length === 0) {
        setApartments([]);
        setIsLoading(false);
        return;
      }

      const apartmentIds = userApartments.map(ua => ua.apartment_id);

      const { data: apartmentsData, error: aptError } = await supabase
        .from('apartments')
        .select('*')
        .in('id', apartmentIds);

      if (aptError) throw aptError;

      const buildingIds = apartmentsData?.map(a => a.building_id) || [];
      const { data: buildingsData, error: buildError } = await supabase
        .from('buildings')
        .select('*')
        .in('id', buildingIds);

      if (buildError) throw buildError;

      const { data: paymentsData, error: payError } = await supabase
        .from('payments')
        .select('*')
        .in('apartment_id', apartmentIds)
        .order('created_at', { ascending: false });

      if (payError) throw payError;

      const { data: apartmentExpensesData, error: expensesError } = await supabase
        .from('apartment_expenses')
        .select('*, expense:expenses(description, expense_date)')
        .in('apartment_id', apartmentIds)
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;

      const apartmentsWithDetails: ApartmentWithDetails[] = (apartmentsData || []).map(apt => ({
        ...apt,
        building: buildingsData?.find(b => b.id === apt.building_id) || null,
        payments: paymentsData?.filter(p => p.apartment_id === apt.id) || [],
        apartmentExpenses: apartmentExpensesData?.filter(ae => ae.apartment_id === apt.id) || [],
      }));

      setApartments(apartmentsWithDetails);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalPaid = (payments: Payment[]) => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  };

  if (loading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <Home className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">My Apartments</h1>
        </div>

        {apartments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                You don't have any apartments assigned to you yet. Please contact your administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {apartments.map((apartment) => (
              <Card key={apartment.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5" />
                    Apartment {apartment.apartment_number}
                  </CardTitle>
                  <CardDescription>
                    {apartment.building?.name} - {apartment.building?.address}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-medium capitalize">{apartment.status}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Occupancy Start</p>
                      <p className="font-medium">{apartment.occupancy_start ? formatDate(apartment.occupancy_start) : 'Not set'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Monthly Subscription</p>
                      <p className="font-medium">₪{apartment.subscription_amount.toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Subscription Status</p>
                      <p className={`font-medium capitalize ${
                        apartment.subscription_status === 'paid' ? 'text-green-600' : 
                        apartment.subscription_status === 'partial' ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {apartment.subscription_status}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total Paid
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                          ₪{getTotalPaid(apartment.payments).toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Credit Balance
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className={`text-2xl font-bold ${
                          apartment.credit > 0 ? 'text-green-600' : 
                          apartment.credit < 0 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          ₪{apartment.credit.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total Payments
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{apartment.payments.length}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {(apartment.payments.length > 0 || apartment.apartmentExpenses.length > 0) && (
                    <div className="pt-4 border-t">
                      <h3 className="text-lg font-semibold mb-3">Transaction History</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount (₪)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            ...apartment.payments.map(p => ({
                              id: p.id,
                              date: p.created_at,
                              description: `Payment for ${p.month}`,
                              type: 'payment',
                              amount: p.amount,
                              is_canceled: false
                            })),
                            ...apartment.apartmentExpenses.map(ae => ({
                              id: ae.id,
                              date: ae.created_at,
                              description: ae.expense?.description || 'Building expense',
                              type: 'expense',
                              amount: ae.amount,
                              is_canceled: ae.is_canceled
                            }))
                          ]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDate(transaction.date)}</TableCell>
                              <TableCell>
                                {transaction.description}
                                {transaction.type === 'expense' && transaction.is_canceled && (
                                  <span className="ml-2 text-xs text-muted-foreground">(Canceled)</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.type === 'payment' 
                                    ? 'bg-green-100 text-green-800' 
                                    : transaction.is_canceled
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.type === 'payment' ? 'Payment' : transaction.is_canceled ? 'Canceled Expense' : 'Expense'}
                                </span>
                              </TableCell>
                              <TableCell className={`text-right font-medium ${
                                transaction.type === 'payment' ? 'text-green-600' : transaction.is_canceled ? 'text-gray-600' : 'text-red-600'
                              }`}>
                                {transaction.type === 'payment' ? '+' : '-'}₪{transaction.amount.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyApartments;