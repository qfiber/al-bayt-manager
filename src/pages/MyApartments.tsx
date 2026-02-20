import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Home } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ApartmentData {
  apartment: {
    id: string;
    apartmentNumber: string;
    status: string;
    occupancyStart: string | null;
    subscriptionAmount: string;
    subscriptionStatus: string;
    cachedBalance: string;
    buildingId: string;
  };
  buildingName: string;
  buildingAddress: string;
}

const MyApartments = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [apartments, setApartments] = useState<any[]>([]);
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
      const data: ApartmentData[] = await api.get('/my-apartments');

      if (!data || data.length === 0) {
        setApartments([]);
        setIsLoading(false);
        return;
      }

      // For each apartment, fetch debt details (includes payments, expenses, ledger)
      const withDetails = await Promise.all(
        data.map(async (item) => {
          try {
            const details = await api.get(`/apartments/${item.apartment.id}/debt-details`);
            return {
              ...item.apartment,
              buildingName: item.buildingName,
              buildingAddress: item.buildingAddress,
              payments: details.payments || [],
              expenses: details.expenses || [],
              ledger: details.ledger || [],
              balance: details.balance,
            };
          } catch {
            return {
              ...item.apartment,
              buildingName: item.buildingName,
              buildingAddress: item.buildingAddress,
              payments: [],
              expenses: [],
              ledger: [],
              balance: parseFloat(item.apartment.cachedBalance),
            };
          }
        }),
      );

      setApartments(withDetails);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalPaid = (payments: any[]) => {
    return payments.filter((p: any) => !p.isCanceled).reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
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
            {apartments.map((apartment) => {
              const balance = typeof apartment.balance === 'number' ? apartment.balance : parseFloat(apartment.cachedBalance);
              const subscriptionAmount = parseFloat(apartment.subscriptionAmount || '0');

              return (
                <Card key={apartment.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      Apartment {apartment.apartmentNumber}
                    </CardTitle>
                    <CardDescription>
                      {apartment.buildingName} - {apartment.buildingAddress}
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
                        <p className="font-medium">{apartment.occupancyStart ? formatDate(apartment.occupancyStart) : 'Not set'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Monthly Subscription</p>
                        <p className="font-medium">₪{subscriptionAmount.toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Subscription Status</p>
                        <p className={`font-medium capitalize ${
                          apartment.subscriptionStatus === 'paid' ? 'text-green-600' :
                          apartment.subscriptionStatus === 'partial' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {apartment.subscriptionStatus}
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
                            balance > 0 ? 'text-green-600' :
                            balance < 0 ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            ₪{balance.toFixed(2)}
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

                    {(apartment.payments.length > 0 || apartment.expenses.length > 0) && (
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
                              ...apartment.payments.map((p: any) => ({
                                id: p.id,
                                date: p.createdAt,
                                description: `Payment for ${p.month}`,
                                type: 'payment',
                                amount: parseFloat(p.amount),
                                isCanceled: p.isCanceled,
                              })),
                              ...apartment.expenses.map((ae: any) => ({
                                id: ae.id,
                                date: ae.createdAt,
                                description: ae.expenseDescription || 'Building expense',
                                type: 'expense',
                                amount: parseFloat(ae.amount),
                                isCanceled: ae.isCanceled,
                              })),
                            ]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>{formatDate(transaction.date)}</TableCell>
                                <TableCell>
                                  {transaction.description}
                                  {transaction.isCanceled && (
                                    <span className="ml-2 text-xs text-muted-foreground">(Canceled)</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    transaction.type === 'payment'
                                      ? 'bg-green-100 text-green-800'
                                      : transaction.isCanceled
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.type === 'payment' ? 'Payment' : transaction.isCanceled ? 'Canceled Expense' : 'Expense'}
                                  </span>
                                </TableCell>
                                <TableCell className={`text-right font-medium ${
                                  transaction.type === 'payment' ? 'text-green-600' : transaction.isCanceled ? 'text-gray-600' : 'text-red-600'
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyApartments;
