import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useBuildings } from '@/hooks/use-buildings';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Plus, Pencil, Trash2 } from 'lucide-react';

interface JobRow {
  job: {
    id: string;
    buildingId: string;
    issueId: string | null;
    title: string;
    description: string | null;
    estimatedCost: string | null;
    status: string;
    expenseId: string | null;
    createdBy: string;
    createdAt: string;
  };
  buildingName: string;
}

const MaintenanceJobs = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const { t } = useLanguage();
  const { currencySymbol, formatCurrency } = useCurrency();
  useRequireAuth('admin-or-moderator');
  const { buildings } = useBuildings(!!user);
  const { toast } = useToast();

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(row =>
      row.job.title.toLowerCase().includes(q) ||
      row.buildingName.toLowerCase().includes(q) ||
      (row.job.description && row.job.description.toLowerCase().includes(q)) ||
      row.job.status.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formBuildingId, setFormBuildingId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStatus, setFormStatus] = useState('pending');

  const canManage = isAdmin || isModerator;

  useEffect(() => {
    if (user && canManage) {
      fetchJobs();
    }
  }, [user, canManage]);

  const fetchJobs = async () => {
    try {
      const data = await api.get('/maintenance');
      setJobs(data || []);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingJob) {
        await api.put(`/maintenance/${editingJob.job.id}`, {
          title: formTitle,
          description: formDescription || undefined,
          status: formStatus,
        });
        toast({ title: t('success'), description: t('maintenanceUpdatedSuccess') });
      } else {
        await api.post('/maintenance', {
          buildingId: formBuildingId,
          title: formTitle,
          description: formDescription || undefined,
          estimatedCost: formCost ? parseFloat(formCost) : null,
        });
        toast({ title: t('success'), description: t('maintenanceCreatedSuccess') });
      }
      resetForm();
      fetchJobs();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (row: JobRow) => {
    setEditingJob(row);
    setFormBuildingId(row.job.buildingId);
    setFormTitle(row.job.title);
    setFormDescription(row.job.description || '');
    setFormCost(row.job.estimatedCost || '');
    setFormStatus(row.job.status);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/maintenance/${id}`);
      toast({ title: t('success'), description: t('maintenanceDeletedSuccess') });
      fetchJobs();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormBuildingId('');
    setFormTitle('');
    setFormDescription('');
    setFormCost('');
    setFormStatus('pending');
    setEditingJob(null);
    setIsDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{t('pending')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950">{t('inProgress')}</Badge>;
      case 'completed':
        return <Badge className="bg-green-600 hover:bg-green-700">{t('completed')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (!user || !canManage) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('maintenanceJobs')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <SearchInput value={search} onChange={handleSearch} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 me-2" />
                  {t('addMaintenanceJob')}
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingJob ? t('editMaintenanceJob') : t('addMaintenanceJob')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingJob && (
                  <div>
                    <Label>{t('building')}</Label>
                    <Select value={formBuildingId} onValueChange={setFormBuildingId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectBuilding')} />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>{t('jobTitle')}</Label>
                  <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} required />
                </div>

                <div>
                  <Label>{t('description')}</Label>
                  <Textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {!editingJob && (
                  <div>
                    <Label>{t('estimatedCost')}</Label>
                    <div className="relative">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formCost}
                        onChange={e => setFormCost(e.target.value)}
                        className="ps-7"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t('costWillBeSplit')}</p>
                  </div>
                )}

                {editingJob && (
                  <div>
                    <Label>{t('status')}</Label>
                    <Select value={formStatus} onValueChange={setFormStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">{t('pending')}</SelectItem>
                        <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                        <SelectItem value="completed">{t('completed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isSubmitting || (!editingJob && !formBuildingId)}>
                    {isSubmitting ? t('loading') : editingJob ? t('update') : t('create')}
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
            <CardTitle>{t('maintenanceJobs')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t('building')}</TableHead>
                    <TableHead className="text-start">{t('jobTitle')}</TableHead>
                    <TableHead className="text-start">{t('estimatedCost')}</TableHead>
                    <TableHead className="text-start">{t('status')}</TableHead>
                    <TableHead className="text-start">{t('date')}</TableHead>
                    <TableHead className="text-start">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableEmptyRow colSpan={6} message={t('noMaintenanceJobs')} />
                  ) : (
                    paginated.map((row) => (
                      <TableRow key={row.job.id}>
                        <TableCell className="text-start">{row.buildingName}</TableCell>
                        <TableCell className="text-start max-w-[200px] truncate">{row.job.title}</TableCell>
                        <TableCell className="text-start">
                          {row.job.estimatedCost ? formatCurrency(parseFloat(row.job.estimatedCost)) : '-'}
                        </TableCell>
                        <TableCell className="text-start">{getStatusBadge(row.job.status)}</TableCell>
                        <TableCell className="text-start">{formatDate(row.job.createdAt)}</TableCell>
                        <TableCell className="text-start">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t('deleteMaintenanceJob')}</AlertDialogTitle>
                                    <AlertDialogDescription>{t('deleteMaintenanceJobConfirm')}</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(row.job.id)}>
                                      {t('delete')}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              page={safePage}
              hasPrevious={safePage > 1}
              hasNext={safePage < totalPages}
              onPrevious={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MaintenanceJobs;
