import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building, Plus, Pencil, Trash2, Upload } from 'lucide-react';

interface BuildingData {
  id: string;
  name: string;
  address: string;
  numberOfFloors: number | null;
  undergroundFloors: number | null;
  logoUrl: string | null;
  createdAt: string | null;
}

const Buildings = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingData | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', numberOfFloors: '', undergroundFloors: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
    }
  }, [user, isAdmin]);

  const fetchBuildings = async () => {
    try {
      const data = await api.get('/buildings');
      setBuildings(data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    const result = await api.upload('/upload/logo', logoFile);
    return result.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const payload: any = {
        name: formData.name,
        address: formData.address,
        numberOfFloors: formData.numberOfFloors ? parseInt(formData.numberOfFloors) : undefined,
        undergroundFloors: formData.undergroundFloors ? parseInt(formData.undergroundFloors) : 0,
      };
      if (logoUrl) payload.logoUrl = logoUrl;

      if (editingBuilding) {
        await api.put(`/buildings/${editingBuilding.id}`, payload);
        toast({ title: 'Success', description: 'Building updated successfully' });
      } else {
        await api.post('/buildings', payload);
        toast({ title: 'Success', description: 'Building created successfully' });
      }

      fetchBuildings();
      resetForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteBuildingConfirm'))) return;

    try {
      await api.delete(`/buildings/${id}`);
      toast({ title: 'Success', description: 'Building deleted successfully' });
      fetchBuildings();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (building: BuildingData) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address,
      numberOfFloors: building.numberOfFloors?.toString() || '',
      undergroundFloors: building.undergroundFloors?.toString() || '',
    });
    if (building.logoUrl) {
      setLogoPreview(building.logoUrl);
    }
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', numberOfFloors: '', undergroundFloors: '' });
    setLogoFile(null);
    setLogoPreview(null);
    setEditingBuilding(null);
    setIsDialogOpen(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('buildings')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
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
                    <Label htmlFor="logo">{t('logoOptional')}</Label>
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                    />
                    {logoPreview && (
                      <div className="mt-2">
                        <img src={logoPreview} alt={t('logoPreview')} className="w-20 h-20 object-cover rounded" />
                      </div>
                    )}
                  </div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{t('nameLabel')}</TableHead>
                  <TableHead className="text-right">{t('address')}</TableHead>
                  <TableHead className="text-right">{t('numberOfFloors')}</TableHead>
                  <TableHead className="text-right">{t('logo')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('noBuildingsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  buildings.map((building) => (
                    <TableRow key={building.id}>
                      <TableCell className="font-medium text-right">{building.name}</TableCell>
                      <TableCell className="text-right">{building.address}</TableCell>
                      <TableCell className="text-right">
                        {building.numberOfFloors || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {building.logoUrl ? (
                          <img src={building.logoUrl} alt={building.name} className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <span className="text-muted-foreground">{t('noLogo')}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Buildings;
