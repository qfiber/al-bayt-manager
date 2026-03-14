import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import type { ApartmentData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Home, Download, Receipt, Clock, AlertTriangle, CreditCard } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MyApartments = () => {
  useRequireAuth();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { currencySymbol, formatCurrency } = useCurrency();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [apartments, setApartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingApartment, setPayingApartment] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [payGateway, setPayGateway] = useState<'stripe' | 'cardcom' | 'paypal'>('stripe');
  const [payLoading, setPayLoading] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ buildingId: '', category: 'other', description: '' });
  const [issueLoading, setIssueLoading] = useState(false);

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

      // For each apartment, fetch debt details scoped to active period
      const withDetails = await Promise.all(
        data.map(async (item) => {
          try {
            // Fetch with current period scoping (default behavior)
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
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async () => {
    if (!payingApartment || !payAmount || !payMonth) return;
    setPayLoading(true);
    try {
      const result = await api.post('/payments/checkout', {
        apartmentId: payingApartment.id,
        amount: parseFloat(payAmount),
        month: payMonth,
        gateway: payGateway,
      });
      // Redirect to payment page
      window.location.href = result.url;
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setPayLoading(false);
    }
  };

  const handleReportIssue = async () => {
    if (!issueForm.description.trim() || !issueForm.buildingId) return;
    setIssueLoading(true);
    try {
      await api.post('/issues', {
        buildingId: issueForm.buildingId,
        category: issueForm.category,
        description: issueForm.description,
      });
      toast({ title: t('success'), description: t('issueReportedSuccess') });
      setIssueDialogOpen(false);
      setIssueForm({ buildingId: '', category: 'other', description: '' });
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setIssueLoading(false);
    }
  };

  const getTotalPaid = (payments: any[]) => {
    return payments.filter((p: any) => !p.isCanceled).reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Home className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('myApartments')}</h1>
          </div>
          <Button variant="outline" onClick={() => {
            if (apartments.length > 0) {
              setIssueForm(prev => ({ ...prev, buildingId: apartments[0].buildingId }));
            }
            setIssueDialogOpen(true);
          }}>
            <AlertTriangle className="w-4 h-4 me-2" />
            {t('reportIssue')}
          </Button>
        </div>

        {apartments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {t('noApartmentsAssigned')}
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
                      {t('apartment')} {apartment.apartmentNumber}
                    </CardTitle>
                    <CardDescription>
                      {apartment.buildingName} - {apartment.buildingAddress}
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/my-apartments/${apartment.id}/statement/download`)}
                        className="w-fit"
                      >
                        <Download className="w-4 h-4 me-2" />
                        {t('downloadStatement')}
                      </Button>
                      {user?.onlinePaymentsEnabled && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setPayingApartment(apartment);
                            setPayAmount(Math.abs(balance) > 0 ? Math.abs(balance).toFixed(2) : subscriptionAmount.toFixed(2));
                            const now = new Date();
                            setPayMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                            setPayDialogOpen(true);
                          }}
                          className="w-fit"
                        >
                          <CreditCard className="w-4 h-4 me-2" />
                          {t('payNow')}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{t('status')}</p>
                        <p className="font-medium capitalize">{t(apartment.status as 'vacant' | 'occupied')}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{t('occupancyStart')}</p>
                        <p className="font-medium">{apartment.occupancyStart ? formatDate(apartment.occupancyStart) : '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{t('monthlySubscription').replace('{currency}', currencySymbol)}</p>
                        <p className="font-medium">{formatCurrency(subscriptionAmount)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{t('subscriptionStatus')}</p>
                        <p className={`font-medium capitalize ${
                          apartment.subscriptionStatus === 'paid' ? 'text-green-600' :
                          apartment.subscriptionStatus === 'partial' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {apartment.subscriptionStatus}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t('accountStatus')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Badge variant={balance >= 0 ? 'default' : 'destructive'} className="text-sm">
                            {balance >= 0 ? t('inGoodStanding') : t('overdue')}
                          </Badge>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t('credit')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className={`text-2xl font-bold ${
                            balance > 0 ? 'text-green-600' :
                            balance < 0 ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {formatCurrency(balance)}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t('totalAmount')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(getTotalPaid(apartment.payments))}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            {t('payments')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{apartment.payments.length}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {(apartment.payments.length > 0 || apartment.expenses.length > 0) && (
                      <div className="pt-4 border-t">
                        <h3 className="text-lg font-semibold mb-3">{t('paymentHistory')}</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('date')}</TableHead>
                              <TableHead>{t('description')}</TableHead>
                              <TableHead>{t('status')}</TableHead>
                              <TableHead className="text-start">{t('amount')} ({currencySymbol})</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[
                              ...apartment.payments.map((p: any) => ({
                                id: p.id,
                                date: p.createdAt,
                                description: t('paymentForMonth').replace('{month}', p.month),
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
                                    <span className="ms-2 text-xs text-muted-foreground">({t('canceled')})</span>
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
                                    {transaction.type === 'payment' ? t('payment') : transaction.isCanceled ? t('canceled') : t('expense')}
                                  </span>
                                </TableCell>
                                <TableCell className={`text-start font-medium ${
                                  transaction.type === 'payment' ? 'text-green-600' : transaction.isCanceled ? 'text-gray-600' : 'text-red-600'
                                }`}>
                                  {transaction.type === 'payment' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                </TableCell>
                                <TableCell>
                                  {transaction.type === 'payment' && !transaction.isCanceled && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(`/api/my-apartments/${apartment.id}/receipts/${transaction.id}/download`)}
                                      title={t('downloadReceipt')}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  )}
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

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('payNow')} — {t('apartment')} {payingApartment?.apartmentNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('amount')}</Label>
              <Input type="number" step="0.01" min="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>{t('month')}</Label>
              <Input type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} />
            </div>
            <div>
              <Label>{t('paymentGateway')}</Label>
              <Select value={payGateway} onValueChange={(v: any) => setPayGateway(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="cardcom">CardCom</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handlePay} disabled={payLoading} className="w-full">
              {payLoading ? t('loading') : t('proceedToPayment')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportIssue')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('building')}</Label>
              <Select value={issueForm.buildingId} onValueChange={(v) => setIssueForm({...issueForm, buildingId: v})}>
                <SelectTrigger><SelectValue placeholder={t('selectBuilding')} /></SelectTrigger>
                <SelectContent>
                  {[...new Map(apartments.map(a => [a.buildingId, a.buildingName])).entries()].map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('category')}</Label>
              <Select value={issueForm.category} onValueChange={(v) => setIssueForm({...issueForm, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plumbing">{t('plumbing')}</SelectItem>
                  <SelectItem value="electrical">{t('electrical')}</SelectItem>
                  <SelectItem value="elevator">{t('elevator')}</SelectItem>
                  <SelectItem value="water_leak">{t('waterLeak')}</SelectItem>
                  <SelectItem value="cleaning">{t('cleaning')}</SelectItem>
                  <SelectItem value="structural">{t('structural')}</SelectItem>
                  <SelectItem value="safety">{t('safety')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('description')}</Label>
              <Textarea
                value={issueForm.description}
                onChange={(e) => setIssueForm({...issueForm, description: e.target.value})}
                placeholder={t('describeIssue')}
                rows={4}
              />
            </div>
            <Button onClick={handleReportIssue} disabled={issueLoading || !issueForm.description.trim()} className="w-full">
              {issueLoading ? t('loading') : t('submitIssue')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyApartments;
