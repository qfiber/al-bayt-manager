import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useBuildings } from '@/hooks/use-buildings';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { BuildingFilter } from '@/components/BuildingFilter';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Plus, Pencil, Trash2, Calendar, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface InspectionRow {
  inspection: {
    id: string;
    buildingId: string | null;
    apartmentId: string | null;
    title: string;
    description: string | null;
    type: string;
    scheduledAt: string;
    duration: string | null;
    status: string;
    notifyEmail: string;
    notifySms: string;
  };
  buildingName: string | null;
  apartmentNumber: string | null;
}

interface ApartmentOption {
  id: string;
  apartmentNumber: string;
  buildingId: string;
}

const Inspections = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  useRequireAuth('admin-or-moderator');
  const { buildings } = useBuildings(!!user);

  const [inspectionRows, setInspectionRows] = useState<InspectionRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<InspectionRow['inspection'] | null>(null);
  const [scope, setScope] = useState<'building' | 'apartment'>('building');
  const [formData, setFormData] = useState({
    building_id: '',
    apartment_id: '',
    title: '',
    description: '',
    type: 'inspection',
    scheduled_at: '',
    duration: '60',
    notify_email: true,
    notify_sms: true,
    status: 'scheduled',
  });

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchApartments();
      fetchInspections();
    }
  }, [user, isAdmin, isModerator]);

  const fetchApartments = async () => {
    try {
      const data = await api.get<any[]>('/apartments');
      setApartments((data || []).map((item: any) => ({
        id: item.apartment.id,
        apartmentNumber: item.apartment.apartmentNumber,
        buildingId: item.apartment.buildingId,
      })));
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchInspections = async () => {
    try {
      const data = await api.get<InspectionRow[]>('/inspections');
      setInspectionRows(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      buildingId: formData.building_id || null,
      apartmentId: scope === 'apartment' ? formData.apartment_id : null,
      title: formData.title,
      description: formData.description || null,
      type: formData.type,
      scheduledAt: formData.scheduled_at,
      duration: formData.duration ? parseInt(formData.duration) : 60,
      notifyEmail: formData.notify_email,
      notifySms: formData.notify_sms,
    };

    if (editingInspection) {
      payload.status = formData.status;
      try {
        await api.put(`/inspections/${editingInspection.id}`, payload);
        toast({ title: t('success'), description: t('inspectionUpdated') });
        fetchInspections();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    } else {
      try {
        await api.post('/inspections', payload);
        toast({ title: t('success'), description: t('inspectionCreated') });
        fetchInspections();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirmation'))) return;
    try {
      await api.delete(`/inspections/${id}`);
      toast({ title: t('success'), description: t('inspectionDeleted') });
      fetchInspections();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (row: InspectionRow) => {
    const insp = row.inspection;
    setEditingInspection(insp);
    setScope(insp.apartmentId ? 'apartment' : 'building');

    // Format scheduledAt for datetime-local input
    let scheduledAtLocal = '';
    if (insp.scheduledAt) {
      const d = new Date(insp.scheduledAt);
      const pad = (n: number) => n.toString().padStart(2, '0');
      scheduledAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    setFormData({
      building_id: insp.buildingId || '',
      apartment_id: insp.apartmentId || '',
      title: insp.title,
      description: insp.description || '',
      type: insp.type,
      scheduled_at: scheduledAtLocal,
      duration: insp.duration || '60',
      notify_email: insp.notifyEmail === 'true' || insp.notifyEmail === true as any,
      notify_sms: insp.notifySms === 'true' || insp.notifySms === true as any,
      status: insp.status,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      building_id: '',
      apartment_id: '',
      title: '',
      description: '',
      type: 'inspection',
      scheduled_at: '',
      duration: '60',
      notify_email: true,
      notify_sms: true,
      status: 'scheduled',
    });
    setScope('building');
    setEditingInspection(null);
    setIsDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{t('statusScheduled')}</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t('statusCompleted')}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{t('statusCancelled')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'inspection':
        return t('typeInspection');
      case 'maintenance':
        return t('typeMaintenance');
      case 'visit':
        return t('typeVisit');
      default:
        return type;
    }
  };

  const filteredRows = useMemo(() => {
    let rows = selectedBuildingFilter === 'all'
      ? inspectionRows
      : inspectionRows.filter(r => r.inspection.buildingId === selectedBuildingFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(r =>
        r.inspection.title.toLowerCase().includes(q) ||
        (r.buildingName || '').toLowerCase().includes(q) ||
        (r.apartmentNumber || '').toLowerCase().includes(q)
      );
    }

    return rows;
  }, [inspectionRows, selectedBuildingFilter, searchQuery]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  const filteredApartments = useMemo(() => {
    if (!formData.building_id) return [];
    return apartments.filter(apt => apt.buildingId === formData.building_id);
  }, [apartments, formData.building_id]);

  if (!user || (!isAdmin && !isModerator)) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('inspections')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }} />
            <BuildingFilter buildings={buildings} value={selectedBuildingFilter} onChange={(v) => { setSelectedBuildingFilter(v); setCurrentPage(1); }} />
            <Button
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 me-2" />
              {t('scheduleInspection')}
            </Button>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInspection ? t('editInspection') : t('scheduleInspection')}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Scope */}
              <div>
                <Label>{t('scope') || 'Scope'}</Label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === 'building'}
                      onChange={() => { setScope('building'); setFormData({ ...formData, apartment_id: '' }); }}
                      className="accent-primary"
                    />
                    {t('entireBuilding')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === 'apartment'}
                      onChange={() => setScope('apartment')}
                      className="accent-primary"
                    />
                    {t('specificApartment')}
                  </label>
                </div>
              </div>

              {/* Building */}
              <div>
                <Label>{t('building')}</Label>
                <Select
                  value={formData.building_id}
                  onValueChange={(value) => setFormData({ ...formData, building_id: value, apartment_id: '' })}
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

              {/* Apartment (only if apartment scope) */}
              {scope === 'apartment' && (
                <div>
                  <Label>{t('apartment')}</Label>
                  <Select
                    value={formData.apartment_id}
                    onValueChange={(value) => setFormData({ ...formData, apartment_id: value })}
                    disabled={!formData.building_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectApartment')} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredApartments.map((apt) => (
                        <SelectItem key={apt.id} value={apt.id}>
                          {apt.apartmentNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Title */}
              <div>
                <Label htmlFor="title">{t('title')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Type */}
              <div>
                <Label>{t('inspectionType')}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspection">{t('typeInspection')}</SelectItem>
                    <SelectItem value="maintenance">{t('typeMaintenance')}</SelectItem>
                    <SelectItem value="visit">{t('typeVisit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scheduled Date + Time */}
              <div>
                <Label htmlFor="scheduled_at">{t('scheduledAt')}</Label>
                <Input
                  id="scheduled_at"
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <Label htmlFor="duration">{t('durationMinutes')}</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>

              {/* Notify Email */}
              <div className="flex items-center justify-between">
                <Label htmlFor="notify_email">{t('notifyByEmail')}</Label>
                <Switch
                  id="notify_email"
                  checked={formData.notify_email}
                  onCheckedChange={(checked) => setFormData({ ...formData, notify_email: checked })}
                />
              </div>

              {/* Notify SMS */}
              <div className="flex items-center justify-between">
                <Label htmlFor="notify_sms">{t('notifyBySms')}</Label>
                <Switch
                  id="notify_sms"
                  checked={formData.notify_sms}
                  onCheckedChange={(checked) => setFormData({ ...formData, notify_sms: checked })}
                />
              </div>

              {/* Status (edit only) */}
              {editingInspection && (
                <div>
                  <Label>{t('status')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">{t('statusScheduled')}</SelectItem>
                      <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
                      <SelectItem value="cancelled">{t('statusCancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingInspection ? t('update') : t('create')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>{t('allInspections')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('building')}</TableHead>
                  <TableHead className="text-start">{t('apartment')}</TableHead>
                  <TableHead className="text-start">{t('inspectionType')}</TableHead>
                  <TableHead className="text-start">{t('title')}</TableHead>
                  <TableHead className="text-start">{t('scheduledAt')}</TableHead>
                  <TableHead className="text-start">{t('durationMinutes')}</TableHead>
                  <TableHead className="text-start">{t('status')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableEmptyRow colSpan={8} message={t('noInspectionsFound')} />
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow key={row.inspection.id}>
                      <TableCell className="font-medium text-start">{row.buildingName || '-'}</TableCell>
                      <TableCell className="text-start">{row.apartmentNumber || t('entireBuilding')}</TableCell>
                      <TableCell className="text-start">{getTypeBadge(row.inspection.type)}</TableCell>
                      <TableCell className="text-start">{row.inspection.title}</TableCell>
                      <TableCell className="text-start">
                        {row.inspection.scheduledAt
                          ? new Date(row.inspection.scheduledAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-start">{row.inspection.duration || '60'}</TableCell>
                      <TableCell className="text-start">{getStatusBadge(row.inspection.status)}</TableCell>
                      <TableCell className="text-start">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            title={t('downloadCalendar')}
                            onClick={() => window.open(`/api/inspections/${row.inspection.id}/calendar`)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(row.inspection.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls
              page={currentPage}
              hasPrevious={currentPage > 1}
              hasNext={currentPage < totalPages}
              onPrevious={() => setCurrentPage(p => p - 1)}
              onNext={() => setCurrentPage(p => p + 1)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Inspections;
