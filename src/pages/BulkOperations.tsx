import { useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Layers, CreditCard, FileText, Bell } from 'lucide-react';

interface Building {
  id: string;
  name: string;
}

interface Apartment {
  id: string;
  apartmentNumber: string;
  buildingId: string;
  subscriptionAmount: number;
  cachedBalance: number;
}

interface ApartmentRow {
  apartment: Apartment;
  buildingName: string;
  ownerName: string;
}

interface BulkResult {
  createdCount: number;
  failedCount: number;
  errors: string[];
}

const BulkOperations = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();

  const [buildings, setBuildings] = useState<Building[]>([]);

  // --- Batch Payments state ---
  const [paymentBuildingId, setPaymentBuildingId] = useState('');
  const [paymentApartments, setPaymentApartments] = useState<ApartmentRow[]>([]);
  const [paymentSelectedIds, setPaymentSelectedIds] = useState<Set<string>>(new Set());
  const [paymentMonth, setPaymentMonth] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentUseSubscription, setPaymentUseSubscription] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<BulkResult | null>(null);

  // --- Batch Invoices state ---
  const [invoiceSelectedBuildingIds, setInvoiceSelectedBuildingIds] = useState<Set<string>>(new Set());
  const [invoiceMonth, setInvoiceMonth] = useState('');
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<BulkResult | null>(null);

  // --- Batch Reminders state ---
  const [reminderBuildingId, setReminderBuildingId] = useState('');
  const [reminderApartments, setReminderApartments] = useState<ApartmentRow[]>([]);
  const [reminderSelectedIds, setReminderSelectedIds] = useState<Set<string>>(new Set());
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderResult, setReminderResult] = useState<BulkResult | null>(null);

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
    }
  }, [user, isAdmin, isModerator]);

  // Fetch apartments for batch payments when building changes
  useEffect(() => {
    if (paymentBuildingId) {
      fetchApartmentsForPayment(paymentBuildingId);
    } else {
      setPaymentApartments([]);
      setPaymentSelectedIds(new Set());
    }
  }, [paymentBuildingId]);

  // Fetch apartments with debt for batch reminders when building changes
  useEffect(() => {
    if (reminderBuildingId) {
      fetchApartmentsForReminder(reminderBuildingId);
    } else {
      setReminderApartments([]);
      setReminderSelectedIds(new Set());
    }
  }, [reminderBuildingId]);

  const fetchBuildings = async () => {
    try {
      const data = await api.get<Building[]>('/buildings');
      setBuildings(data || []);
    } catch (err: any) {
      toast.error(err.message || t('error'));
    }
  };

  const fetchApartmentsForPayment = async (buildingId: string) => {
    try {
      const data = await api.get<ApartmentRow[]>(`/apartments?buildingId=${buildingId}`);
      setPaymentApartments(data || []);
      setPaymentSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || t('error'));
      setPaymentApartments([]);
    }
  };

  const fetchApartmentsForReminder = async (buildingId: string) => {
    try {
      const data = await api.get<ApartmentRow[]>(`/apartments?buildingId=${buildingId}`);
      // Filter to only apartments with debt (cachedBalance < 0)
      const withDebt = (data || []).filter((row) => row.apartment.cachedBalance < 0);
      setReminderApartments(withDebt);
      setReminderSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || t('error'));
      setReminderApartments([]);
    }
  };

  // --- Selection helpers ---
  const toggleSelection = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setter(next);
  };

  const selectAll = (items: { apartment: { id: string } }[], setter: (s: Set<string>) => void) => {
    setter(new Set(items.map((item) => item.apartment.id)));
  };

  const deselectAll = (setter: (s: Set<string>) => void) => {
    setter(new Set());
  };

  // --- Batch Payments ---
  const handleBatchPayments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentSelectedIds.size === 0 || !paymentMonth) return;

    setPaymentLoading(true);
    setPaymentResult(null);
    try {
      const result = await api.post<BulkResult>('/bulk/payments', {
        apartmentIds: Array.from(paymentSelectedIds),
        month: paymentMonth,
        amount: paymentUseSubscription ? undefined : parseFloat(paymentAmount),
        useSubscription: paymentUseSubscription,
      });
      setPaymentResult(result);
      toast.success(t('batchPaymentsCompleted'));
    } catch (err: any) {
      toast.error(err.message || t('error'));
    } finally {
      setPaymentLoading(false);
    }
  };

  // --- Batch Invoices ---
  const handleBatchInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceSelectedBuildingIds.size === 0 || !invoiceMonth) return;

    setInvoiceLoading(true);
    setInvoiceResult(null);
    try {
      const result = await api.post<BulkResult>('/bulk/invoices', {
        buildingIds: Array.from(invoiceSelectedBuildingIds),
        month: invoiceMonth,
      });
      setInvoiceResult(result);
      toast.success(t('batchInvoicesCompleted'));
    } catch (err: any) {
      toast.error(err.message || t('error'));
    } finally {
      setInvoiceLoading(false);
    }
  };

  // --- Batch Reminders ---
  const handleBatchReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reminderSelectedIds.size === 0) return;

    setReminderLoading(true);
    setReminderResult(null);
    try {
      const result = await api.post<BulkResult>('/bulk/reminders', {
        apartmentIds: Array.from(reminderSelectedIds),
      });
      setReminderResult(result);
      toast.success(t('batchRemindersCompleted'));
    } catch (err: any) {
      toast.error(err.message || t('error'));
    } finally {
      setReminderLoading(false);
    }
  };

  // --- Toggle building for invoice multi-select ---
  const toggleInvoiceBuilding = (buildingId: string) => {
    const next = new Set(invoiceSelectedBuildingIds);
    if (next.has(buildingId)) {
      next.delete(buildingId);
    } else {
      next.add(buildingId);
    }
    setInvoiceSelectedBuildingIds(next);
  };

  const renderResultBadge = (result: BulkResult | null) => {
    if (!result) return null;
    return (
      <div className="mt-4 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="default">
            {t('created')}: {result.createdCount}
          </Badge>
          {result.failedCount > 0 && (
            <Badge variant="destructive">
              {t('failed')}: {result.failedCount}
            </Badge>
          )}
        </div>
        {result.errors.length > 0 && (
          <div className="mt-2 p-3 bg-destructive/10 rounded-md">
            <p className="text-sm font-medium text-destructive mb-1">{t('errorDetails')}:</p>
            <ul className="text-sm text-destructive space-y-1">
              {result.errors.map((error, idx) => (
                <li key={idx}>- {error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
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
            <Layers className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('bulkOperations')}</h1>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            {t('backToDashboard')}
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="batch-payments">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="batch-payments" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('batchPayments')}</span>
                </TabsTrigger>
                <TabsTrigger value="batch-invoices" className="gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('batchInvoices')}</span>
                </TabsTrigger>
                <TabsTrigger value="batch-reminders" className="gap-2">
                  <Bell className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('batchReminders')}</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Batch Payments */}
              <TabsContent value="batch-payments">
                <form onSubmit={handleBatchPayments} className="space-y-4 mt-4">
                  <div>
                    <Label>{t('building')}</Label>
                    <Select
                      value={paymentBuildingId}
                      onValueChange={(value) => {
                        setPaymentBuildingId(value);
                        setPaymentResult(null);
                      }}
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

                  {paymentBuildingId && paymentApartments.length > 0 && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>{t('selectApartments')}</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => selectAll(paymentApartments, setPaymentSelectedIds)}
                            >
                              {t('selectAll')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => deselectAll(setPaymentSelectedIds)}
                            >
                              {t('deselectAll')}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
                          {paymentApartments.map((row) => (
                            <label
                              key={row.apartment.id}
                              className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={paymentSelectedIds.has(row.apartment.id)}
                                onCheckedChange={() =>
                                  toggleSelection(paymentSelectedIds, row.apartment.id, setPaymentSelectedIds)
                                }
                              />
                              <span className="text-sm">
                                {t('apt')} {row.apartment.apartmentNumber}
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {paymentSelectedIds.size} / {paymentApartments.length} {t('selected')}
                        </p>
                      </div>

                      <div>
                        <Label>{t('month')}</Label>
                        <Input
                          type="month"
                          value={paymentMonth}
                          onChange={(e) => setPaymentMonth(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={paymentUseSubscription}
                            onCheckedChange={(checked) => setPaymentUseSubscription(checked === true)}
                          />
                          <span className="text-sm">{t('useSubscriptionAmount')}</span>
                        </label>

                        {!paymentUseSubscription && (
                          <div>
                            <Label>{t('amount')}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              required={!paymentUseSubscription}
                              placeholder="0.00"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {paymentBuildingId && paymentApartments.length === 0 && (
                    <p className="text-muted-foreground text-sm">{t('noApartmentsFound')}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={paymentLoading || paymentSelectedIds.size === 0 || !paymentMonth}
                    className="w-full"
                  >
                    {paymentLoading ? t('loading') : t('submitBatchPayments')}
                  </Button>

                  {renderResultBadge(paymentResult)}
                </form>
              </TabsContent>

              {/* Tab 2: Batch Invoices */}
              <TabsContent value="batch-invoices">
                <form onSubmit={handleBatchInvoices} className="space-y-4 mt-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>{t('selectBuildings')}</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setInvoiceSelectedBuildingIds(new Set(buildings.map((b) => b.id)))}
                        >
                          {t('selectAll')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setInvoiceSelectedBuildingIds(new Set())}
                        >
                          {t('deselectAll')}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border rounded-md p-3">
                      {buildings.map((building) => (
                        <label
                          key={building.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={invoiceSelectedBuildingIds.has(building.id)}
                            onCheckedChange={() => toggleInvoiceBuilding(building.id)}
                          />
                          <span className="text-sm">{building.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {invoiceSelectedBuildingIds.size} / {buildings.length} {t('selected')}
                    </p>
                  </div>

                  <div>
                    <Label>{t('month')}</Label>
                    <Input
                      type="month"
                      value={invoiceMonth}
                      onChange={(e) => setInvoiceMonth(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={invoiceLoading || invoiceSelectedBuildingIds.size === 0 || !invoiceMonth}
                    className="w-full"
                  >
                    {invoiceLoading ? t('loading') : t('submitBatchInvoices')}
                  </Button>

                  {renderResultBadge(invoiceResult)}
                </form>
              </TabsContent>

              {/* Tab 3: Batch Reminders */}
              <TabsContent value="batch-reminders">
                <form onSubmit={handleBatchReminders} className="space-y-4 mt-4">
                  <div>
                    <Label>{t('building')}</Label>
                    <Select
                      value={reminderBuildingId}
                      onValueChange={(value) => {
                        setReminderBuildingId(value);
                        setReminderResult(null);
                      }}
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

                  {reminderBuildingId && reminderApartments.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>{t('apartmentsWithDebt')}</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => selectAll(reminderApartments, setReminderSelectedIds)}
                          >
                            {t('selectAll')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => deselectAll(setReminderSelectedIds)}
                          >
                            {t('deselectAll')}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-3">
                        {reminderApartments.map((row) => (
                          <label
                            key={row.apartment.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={reminderSelectedIds.has(row.apartment.id)}
                                onCheckedChange={() =>
                                  toggleSelection(reminderSelectedIds, row.apartment.id, setReminderSelectedIds)
                                }
                              />
                              <span className="text-sm">
                                {t('apt')} {row.apartment.apartmentNumber}
                              </span>
                              {row.ownerName && (
                                <span className="text-xs text-muted-foreground">({row.ownerName})</span>
                              )}
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {formatCurrency(row.apartment.cachedBalance)}
                            </Badge>
                          </label>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {reminderSelectedIds.size} / {reminderApartments.length} {t('selected')}
                      </p>
                    </div>
                  )}

                  {reminderBuildingId && reminderApartments.length === 0 && (
                    <p className="text-muted-foreground text-sm">{t('noApartmentsWithDebt')}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={reminderLoading || reminderSelectedIds.size === 0}
                    className="w-full"
                  >
                    {reminderLoading ? t('loading') : t('submitBatchReminders')}
                  </Button>

                  {renderResultBadge(reminderResult)}
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BulkOperations;
