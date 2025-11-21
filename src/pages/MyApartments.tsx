import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Home, DollarSign, Calendar, Building, MapPin } from 'lucide-react';

interface Apartment {
  id: string;
  apartment_number: string;
  building_id: string;
  status: string;
  occupancy_start: string | null;
  occupancy_end: string | null;
}

interface Building {
  id: string;
  name: string;
  address: string;
  logo_url: string | null;
}

interface Payment {
  id: string;
  apartment_id: string;
  amount: number;
  month: string;
  status: string;
}

interface ApartmentWithDetails extends Apartment {
  building?: Building;
  payments?: Payment[];
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
    setIsLoading(true);

    try {
      // Fetch user's apartment assignments
      const { data: userApartments, error: assignmentError } = await supabase
        .from('user_apartments')
        .select('apartment_id')
        .eq('user_id', user?.id);

      if (assignmentError) throw assignmentError;

      if (!userApartments || userApartments.length === 0) {
        setApartments([]);
        setIsLoading(false);
        return;
      }

      const apartmentIds = userApartments.map(ua => ua.apartment_id);

      // Fetch apartment details
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')
        .in('id', apartmentIds);

      if (apartmentsError) throw apartmentsError;

      // Fetch buildings
      const buildingIds = [...new Set(apartmentsData?.map(a => a.building_id) || [])];
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('*')
        .in('id', buildingIds);

      if (buildingsError) throw buildingsError;

      // Fetch payments for these apartments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('apartment_id', apartmentIds)
        .order('month', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Combine all data
      const apartmentsWithDetails: ApartmentWithDetails[] = apartmentsData?.map(apartment => ({
        ...apartment,
        building: buildingsData?.find(b => b.id === apartment.building_id),
        payments: paymentsData?.filter(p => p.apartment_id === apartment.id) || [],
      })) || [];

      setApartments(apartmentsWithDetails);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalPaid = (payments: Payment[] = []) => {
    return payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  };

  const getTotalUnpaid = (payments: Payment[] = []) => {
    return payments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0);
  };

  if (loading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Home className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">My Apartments</h1>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>

        {apartments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Home className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Apartments Assigned</h2>
              <p className="text-muted-foreground text-center">
                You don't have any apartments assigned to you yet. Please contact the administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {apartments.map((apartment) => (
              <Card key={apartment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Home className="w-5 h-5" />
                        Apartment {apartment.apartment_number}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        {apartment.building && (
                          <>
                            <span className="flex items-center gap-1">
                              <Building className="w-4 h-4" />
                              {apartment.building.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {apartment.building.address}
                            </span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant={apartment.status === 'occupied' ? 'default' : 'secondary'}>
                      {apartment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Occupancy Details */}
                  {(apartment.occupancy_start || apartment.occupancy_end) && (
                    <div className="flex gap-6">
                      {apartment.occupancy_start && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Start Date</p>
                            <p className="text-sm font-medium">{apartment.occupancy_start}</p>
                          </div>
                        </div>
                      )}
                      {apartment.occupancy_end && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">End Date</p>
                            <p className="text-sm font-medium">{apartment.occupancy_end}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-muted-foreground">Total Paid</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        ${getTotalPaid(apartment.payments).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-muted-foreground">Total Unpaid</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600">
                        ${getTotalUnpaid(apartment.payments).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Total Payments</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {apartment.payments?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Payment History */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Payment History</h3>
                    {apartment.payments && apartment.payments.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Due Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {apartment.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">
                                {new Date(payment.month).toLocaleDateString('en-US', {
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </TableCell>
                              <TableCell>${payment.amount.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    payment.status === 'paid'
                                      ? 'default'
                                      : payment.status === 'overdue'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                >
                                  {payment.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{payment.month}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No payment records found
                      </div>
                    )}
                  </div>
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
