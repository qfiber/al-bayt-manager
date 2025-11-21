import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building, Plus, Pencil, Trash2, Upload } from 'lucide-react';
import Layout from '@/components/Layout';

interface Building {
  id: string;
  name: string;
  address: string;
  logo_url: string | null;
  created_at: string | null;
}

const Buildings = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '' });
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
    const { data, error } = await supabase
      .from('buildings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBuildings(data || []);
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
    if (!logoFile || !user) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, logoFile);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      if (editingBuilding) {
        const updateData: any = { 
          name: formData.name, 
          address: formData.address
        };
        if (logoUrl) {
          updateData.logo_url = logoUrl;
        }

        const { error } = await supabase
          .from('buildings')
          .update(updateData)
          .eq('id', editingBuilding.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Building updated successfully' });
      } else {
        const insertData: any = { 
          name: formData.name, 
          address: formData.address,
          logo_url: logoUrl
        };

        const { error } = await supabase
          .from('buildings')
          .insert([insertData]);

        if (error) throw error;
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

    const { error } = await supabase
      .from('buildings')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Building deleted successfully' });
      fetchBuildings();
    }
  };

  const handleEdit = (building: Building) => {
    setEditingBuilding(building);
    setFormData({ name: building.name, address: building.address });
    if (building.logo_url) {
      setLogoPreview(building.logo_url);
    }
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', address: '' });
    setLogoFile(null);
    setLogoPreview(null);
    setEditingBuilding(null);
    setIsDialogOpen(false);
  };

  if (loading) {
    return <Layout><div className="container mx-auto p-6 flex items-center justify-center">{t('loading')}</div></Layout>;
  }

  if (!user || !isAdmin) return null;

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('buildings')}</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
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
                  <TableHead className="text-right">{t('logo')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t('noBuildingsFound')}
                    </TableCell>
                  </TableRow>
                ) : (
                  buildings.map((building) => (
                    <TableRow key={building.id}>
                      <TableCell className="font-medium text-right">{building.name}</TableCell>
                      <TableCell className="text-right">{building.address}</TableCell>
                      <TableCell className="text-right">
                        {building.logo_url ? (
                          <img src={building.logo_url} alt={building.name} className="w-10 h-10 object-cover rounded" />
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
    </Layout>
  );
};

export default Buildings;
