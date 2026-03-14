import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  maxBuildings: number;
  maxApartmentsPerBuilding: number;
  monthlyPrice: string;
  semiAnnualPrice: string;
  yearlyPrice: string;
  isCustom: boolean;
  isActive: boolean;
  createdAt: string;
}

const SubscriptionPlans = () => {
  useRequireAuth('admin');
  const { user, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    maxBuildings: '1',
    maxApartmentsPerBuilding: '50',
    monthlyPrice: '0',
    semiAnnualPrice: '0',
    yearlyPrice: '0',
    isCustom: false,
    isActive: true,
  });

  useEffect(() => {
    if (user && isSuperAdmin) fetchPlans();
  }, [user, isSuperAdmin]);

  const fetchPlans = async () => {
    try {
      const data = await api.get<SubscriptionPlan[]>('/subscriptions/plans');
      setPlans(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      slug: formData.slug,
      maxBuildings: parseInt(formData.maxBuildings) || 1,
      maxApartmentsPerBuilding: parseInt(formData.maxApartmentsPerBuilding) || 50,
      monthlyPrice: formData.monthlyPrice,
      semiAnnualPrice: formData.semiAnnualPrice,
      yearlyPrice: formData.yearlyPrice,
      isCustom: formData.isCustom,
      isActive: formData.isActive,
    };
    try {
      if (editingPlan) {
        await api.put(`/subscriptions/plans/${editingPlan.id}`, payload);
        toast({ title: t('success'), description: t('planUpdated') });
      } else {
        await api.post('/subscriptions/plans', payload);
        toast({ title: t('success'), description: t('planCreated') });
      }
      fetchPlans();
      resetForm();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await api.delete(`/subscriptions/plans/${id}`);
      toast({ title: t('success'), description: t('planDeleted') });
      fetchPlans();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      maxBuildings: String(plan.maxBuildings),
      maxApartmentsPerBuilding: String(plan.maxApartmentsPerBuilding),
      monthlyPrice: plan.monthlyPrice,
      semiAnnualPrice: plan.semiAnnualPrice,
      yearlyPrice: plan.yearlyPrice,
      isCustom: plan.isCustom,
      isActive: plan.isActive,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      maxBuildings: '1',
      maxApartmentsPerBuilding: '50',
      monthlyPrice: '0',
      semiAnnualPrice: '0',
      yearlyPrice: '0',
      isCustom: false,
      isActive: true,
    });
    setEditingPlan(null);
    setIsDialogOpen(false);
  };

  if (!user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('subscriptionPlans')}</h1>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 me-2" />
            {t('add')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('subscriptionPlans')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t('nameLabel')}</TableHead>
                    <TableHead className="text-start">{t('maxBuildings')}</TableHead>
                    <TableHead className="text-start">{t('maxApartmentsPerBuilding')}</TableHead>
                    <TableHead className="text-start">{t('monthlyPrice')}</TableHead>
                    <TableHead className="text-start">{t('semiAnnualPrice')}</TableHead>
                    <TableHead className="text-start">{t('yearlyPrice')}</TableHead>
                    <TableHead className="text-start">{t('status')}</TableHead>
                    <TableHead className="text-start">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.length === 0 ? (
                    <TableEmptyRow colSpan={8} message={t('noPlansFound')} />
                  ) : (
                    plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium text-start">
                          {plan.name}
                          {plan.isCustom && (
                            <Badge variant="outline" className="ms-2 text-[10px]">{t('customPlan')}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-start tabular-nums">{plan.maxBuildings}</TableCell>
                        <TableCell className="text-start tabular-nums">{plan.maxApartmentsPerBuilding}</TableCell>
                        <TableCell className="text-start tabular-nums">
                          {plan.isCustom ? '-' : formatCurrency(parseFloat(plan.monthlyPrice))}
                        </TableCell>
                        <TableCell className="text-start tabular-nums">
                          {plan.isCustom ? '-' : formatCurrency(parseFloat(plan.semiAnnualPrice))}
                        </TableCell>
                        <TableCell className="text-start tabular-nums">
                          {plan.isCustom ? '-' : formatCurrency(parseFloat(plan.yearlyPrice))}
                        </TableCell>
                        <TableCell className="text-start">
                          <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                            {plan.isActive ? t('active') : t('inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-start">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(plan)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(plan.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlan ? t('edit') : t('add')} — {t('subscriptionPlans')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{t('nameLabel')}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="e.g. starter, pro, enterprise"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('maxBuildings')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maxBuildings}
                    onChange={(e) => setFormData({ ...formData, maxBuildings: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t('maxApartmentsPerBuilding')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maxApartmentsPerBuilding}
                    onChange={(e) => setFormData({ ...formData, maxApartmentsPerBuilding: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('monthlyPrice')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.monthlyPrice}
                    onChange={(e) => setFormData({ ...formData, monthlyPrice: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t('semiAnnualPrice')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.semiAnnualPrice}
                    onChange={(e) => setFormData({ ...formData, semiAnnualPrice: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t('yearlyPrice')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.yearlyPrice}
                    onChange={(e) => setFormData({ ...formData, yearlyPrice: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <Label>{t('customPlan')}</Label>
                  <p className="text-xs text-muted-foreground">Enterprise / custom pricing</p>
                </div>
                <Switch
                  checked={formData.isCustom}
                  onCheckedChange={(checked) => setFormData({ ...formData, isCustom: checked })}
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-3">
                <Label>{t('active')}</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingPlan ? t('update') : t('create')}
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
  );
};

export default SubscriptionPlans;
