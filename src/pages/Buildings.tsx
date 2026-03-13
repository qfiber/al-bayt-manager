import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { usePaginatedSearch } from '@/hooks/use-paginated-search';
import { Building, Plus, Pencil, Trash2, Copy } from 'lucide-react';

interface BuildingData {
  id: string;
  name: string;
  address: string;
  numberOfFloors: number | null;
  undergroundFloors: number | null;
  monthlyFee: string | null;
  createdAt: string | null;
}

const Buildings = () => {
  useRequireAuth('admin');

  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { currencySymbol, formatCurrency } = useCurrency();
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingData | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', numberOfFloors: '', undergroundFloors: '', monthlyFee: '', ntfyTopicUrl: '' });
  const [generateApartments, setGenerateApartments] = useState(false);
  const [uniformMode, setUniformMode] = useState(true);
  const [uniformCount, setUniformCount] = useState('');
  const [perFloorCounts, setPerFloorCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && isAdmin) {
      fetchBuildings();
    }
  }, [user, isAdmin]);

  const fetchBuildings = async () => {
    try {
      const data = await api.get('/buildings');
      setBuildings(data || []);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: any = {
        name: formData.name,
        address: formData.address,
        numberOfFloors: formData.numberOfFloors ? parseInt(formData.numberOfFloors) : undefined,
        undergroundFloors: formData.undergroundFloors ? parseInt(formData.undergroundFloors) : 0,
        monthlyFee: formData.monthlyFee || '0',
        ntfyTopicUrl: formData.ntfyTopicUrl || null,
      };

      if (!editingBuilding && generateApartments && formData.numberOfFloors) {
        payload.generateApartments = true;
        if (uniformMode) {
          payload.uniformApartmentsPerFloor = parseInt(uniformCount) || 0;
        } else {
          const mapped: Record<string, number> = {};
          for (const [key, val] of Object.entries(perFloorCounts)) {
            mapped[key] = parseInt(val) || 0;
          }
          payload.apartmentsPerFloor = mapped;
        }
      }

      if (editingBuilding) {
        await api.put(`/buildings/${editingBuilding.id}`, payload);
        toast({ title: t('success'), description: t('buildingUpdatedSuccess') });
      } else {
        await api.post('/buildings', payload);
        toast({ title: t('success'), description: t('buildingCreatedSuccess') });
      }

      fetchBuildings();
      resetForm();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteBuildingConfirm'))) return;

    try {
      await api.delete(`/buildings/${id}`);
      toast({ title: t('success'), description: t('buildingDeletedSuccess') });
      fetchBuildings();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (building: BuildingData) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address,
      numberOfFloors: building.numberOfFloors?.toString() || '',
      undergroundFloors: building.undergroundFloors?.toString() || '',
      monthlyFee: building.monthlyFee || '',
      ntfyTopicUrl: (building as any).ntfyTopicUrl || '',
    });
    setIsDialogOpen(true);
  };

  const handleClone = async (id: string) => {
    try {
      await api.post(`/buildings/${id}/clone`);
      toast({ title: t('success'), description: t('buildingClonedSuccess') });
      fetchBuildings();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', numberOfFloors: '', undergroundFloors: '', monthlyFee: '', ntfyTopicUrl: '' });
    setEditingBuilding(null);
    setIsDialogOpen(false);
    setGenerateApartments(false);
    setUniformMode(true);
    setUniformCount('');
    setPerFloorCounts({});
  };

  const { search, setSearch, paginated, page, hasPrevious, hasNext, onPrevious, onNext } = usePaginatedSearch({
    items: buildings,
    searchFields: ['name', 'address'] as (keyof BuildingData)[],
  });

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('buildings')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <SearchInput value={search} onChange={setSearch} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 me-2" />
                  {t('addBuilding')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingBuilding ? t('editBuilding') : t('addBuilding')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">{t('buildingName')}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">{t('address')}</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="numberOfFloors">{t('numberOfFloors')}</Label>
                    <Input
                      id="numberOfFloors"
                      type="number"
                      min="1"
                      value={formData.numberOfFloors}
                      onChange={(e) => setFormData({ ...formData, numberOfFloors: e.target.value })}
                      placeholder={t('optional')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="undergroundFloors">{t('undergroundFloors')}</Label>
                    <Input
                      id="undergroundFloors"
                      type="number"
                      min="0"
                      value={formData.undergroundFloors}
                      onChange={(e) => setFormData({ ...formData, undergroundFloors: e.target.value })}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('undergroundFloorsHelp')}</p>
                  </div>
                  <div>
                    <Label htmlFor="monthlyFee">{t('buildingMonthlyFee')}</Label>
                    <div className="relative">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                      <Input
                        id="monthlyFee"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monthlyFee}
                        onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                        className="ps-7"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="ntfyTopicUrl">{t('ntfyTopicUrl')}</Label>
                    <Input
                      id="ntfyTopicUrl"
                      value={formData.ntfyTopicUrl}
                      onChange={(e) => setFormData({ ...formData, ntfyTopicUrl: e.target.value })}
                      placeholder="building-topic-name"
                    />
                  </div>
                  {!editingBuilding && formData.numberOfFloors && (
                    <div className="space-y-3 border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="generateApartments">{t('autoGenerateApartments')}</Label>
                        <Switch
                          id="generateApartments"
                          checked={generateApartments}
                          onCheckedChange={setGenerateApartments}
                        />
                      </div>
                      {generateApartments && (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={uniformMode ? 'default' : 'outline'}
                              onClick={() => setUniformMode(true)}
                            >
                              {t('sameForAllFloors')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={!uniformMode ? 'default' : 'outline'}
                              onClick={() => setUniformMode(false)}
                            >
                              {t('customPerFloor')}
                            </Button>
                          </div>
                          {uniformMode ? (
                            <div>
                              <Label htmlFor="uniformCount">{t('apartmentsPerFloor')}</Label>
                              <Input
                                id="uniformCount"
                                type="number"
                                min="1"
                                max="100"
                                value={uniformCount}
                                onChange={(e) => setUniformCount(e.target.value)}
                                placeholder="4"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {Array.from({ length: parseInt(formData.numberOfFloors) || 0 }, (_, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <Label className="min-w-[80px] text-sm">
                                    {i === 0 ? t('groundFloor') : `${t('floor')} ${i}`}
                                  </Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={perFloorCounts[String(i)] || ''}
                                    onChange={(e) => setPerFloorCounts(prev => ({ ...prev, [String(i)]: e.target.value }))}
                                    placeholder="0"
                                    className="w-20"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">{t('autoGenerateApartmentsHelp')}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingBuilding ? t('update') : t('create')}
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

        <Card>
          <CardHeader>
            <CardTitle>{t('allBuildings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('nameLabel')}</TableHead>
                  <TableHead className="text-start">{t('address')}</TableHead>
                  <TableHead className="text-start">{t('numberOfFloors')}</TableHead>
                  <TableHead className="text-start">{t('buildingMonthlyFee')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableEmptyRow colSpan={5} message={t('noBuildingsFound')} />
                ) : (
                  paginated.map((building) => (
                    <TableRow key={building.id}>
                      <TableCell className="font-medium text-start">{building.name}</TableCell>
                      <TableCell className="text-start">{building.address}</TableCell>
                      <TableCell className="text-start">
                        {building.numberOfFloors || '-'}
                      </TableCell>
                      <TableCell className="text-start">
                        {formatCurrency(parseFloat(building.monthlyFee || '0'))}
                      </TableCell>
                      <TableCell className="text-start">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleClone(building.id)} title={t('cloneBuilding')}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(building)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(building.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls page={page} hasPrevious={hasPrevious} hasNext={hasNext} onPrevious={onPrevious} onNext={onNext} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Buildings;
