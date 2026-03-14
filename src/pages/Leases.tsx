import { useEffect, useMemo, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BuildingFilter } from '@/components/BuildingFilter';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '@/lib/csv-export';
import { ScrollText, Plus, Pencil, Trash2, Calendar as CalendarIcon, Download } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LeaseRow {
  lease: {
    id: string;
    apartmentId: string;
    tenantName: string;
    tenantEmail: string | null;
    tenantPhone: string | null;
    startDate: string;
    endDate: string | null;
    monthlyRent: string;
    securityDeposit: string | null;
    terms: string | null;
    status: string;
  };
  apartmentNumber: string;
  buildingName: string;
  buildingId: string;
}

interface ApartmentOption {
  id: string;
  apartmentNumber: string;
  buildingId: string;
}

const Leases = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  useRequireAuth('admin-or-moderator');
  const { buildings } = useBuildings(!!user);

  const [leaseRows, setLeaseRows] = useState<LeaseRow[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<LeaseRow['lease'] | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    building_id: '',
    apartment_id: '',
    tenant_name: '',
    tenant_email: '',
    tenant_phone: '',
    monthly_rent: '',
    security_deposit: '',
    terms: '',
    status: 'active',
  });

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchApartments();
      fetchLeases();
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

  const fetchLeases = async () => {
    try {
      const data = await api.get<LeaseRow[]>('/leases');
      setLeaseRows(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      apartmentId: formData.apartment_id,
      tenantName: formData.tenant_name,
      tenantEmail: formData.tenant_email || null,
      tenantPhone: formData.tenant_phone || null,
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
      monthlyRent: parseFloat(formData.monthly_rent),
      securityDeposit: formData.security_deposit ? parseFloat(formData.security_deposit) : null,
      terms: formData.terms || null,
    };

    if (editingLease) {
      payload.status = formData.status;
      try {
        await api.put(`/leases/${editingLease.id}`, payload);
        toast({ title: t('success'), description: t('leaseUpdated') });
        fetchLeases();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    } else {
      try {
        await api.post('/leases', payload);
        toast({ title: t('success'), description: t('leaseCreated') });
        fetchLeases();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirmation'))) return;
    try {
      await api.delete(`/leases/${id}`);
      toast({ title: t('success'), description: t('leaseDeleted') });
      fetchLeases();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (row: LeaseRow) => {
    const lease = row.lease;
    setEditingLease(lease);
    setStartDate(new Date(lease.startDate + 'T00:00:00'));
    setEndDate(lease.endDate ? new Date(lease.endDate + 'T00:00:00') : undefined);
    setFormData({
      building_id: row.buildingId,
      apartment_id: lease.apartmentId,
      tenant_name: lease.tenantName,
      tenant_email: lease.tenantEmail || '',
      tenant_phone: lease.tenantPhone || '',
      monthly_rent: lease.monthlyRent,
      security_deposit: lease.securityDeposit || '',
      terms: lease.terms || '',
      status: lease.status,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      building_id: '',
      apartment_id: '',
      tenant_name: '',
      tenant_email: '',
      tenant_phone: '',
      monthly_rent: '',
      security_deposit: '',
      terms: '',
      status: 'active',
    });
    setStartDate(undefined);
    setEndDate(undefined);
    setOpenPopover(null);
    setEditingLease(null);
    setIsDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t('leaseActive')}</Badge>;
      case 'expired':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('leaseExpired')}</Badge>;
      case 'terminated':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{t('leaseTerminated')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredRows = useMemo(() => {
    let rows = selectedBuildingFilter === 'all'
      ? leaseRows
      : leaseRows.filter(r => r.buildingId === selectedBuildingFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(r =>
        r.lease.tenantName.toLowerCase().includes(q) ||
        r.apartmentNumber.toLowerCase().includes(q) ||
        r.buildingName.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [leaseRows, selectedBuildingFilter, searchQuery]);

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
            <ScrollText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('leaseManagement')}</h1>
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
              {t('addLease')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const rows = filteredRows.map(r => [
                  r.buildingName,
                  r.apartmentNumber,
                  r.lease.tenantName,
                  formatDate(r.lease.startDate),
                  r.lease.endDate ? formatDate(r.lease.endDate) : t('openEnded'),
                  String(r.lease.monthlyRent),
                  r.lease.status,
                ]);
                downloadCsv('leases.csv', ['Building', 'Apartment', 'Tenant', 'Start Date', 'End Date', 'Monthly Rent', 'Status'], rows);
              }}
              className="w-full sm:w-auto"
            >
              <Download className="w-4 h-4 me-2" />
              {t('exportCsv')}
            </Button>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingLease ? t('editLease') : t('addLease')}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              {/* Apartment */}
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

              {/* Tenant Name */}
              <div>
                <Label htmlFor="tenant_name">{t('tenantName')}</Label>
                <Input
                  id="tenant_name"
                  value={formData.tenant_name}
                  onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                  required
                />
              </div>

              {/* Tenant Email */}
              <div>
                <Label htmlFor="tenant_email">{t('tenantEmail')}</Label>
                <Input
                  id="tenant_email"
                  type="email"
                  value={formData.tenant_email}
                  onChange={(e) => setFormData({ ...formData, tenant_email: e.target.value })}
                />
              </div>

              {/* Tenant Phone */}
              <div>
                <Label htmlFor="tenant_phone">{t('tenantPhone')}</Label>
                <Input
                  id="tenant_phone"
                  type="tel"
                  value={formData.tenant_phone}
                  onChange={(e) => setFormData({ ...formData, tenant_phone: e.target.value })}
                />
              </div>

              {/* Start Date */}
              <div>
                <Label>{t('startDate')}</Label>
                <Popover open={openPopover === 'start-date'} onOpenChange={(open) => setOpenPopover(open ? 'start-date' : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start text-start font-normal", !startDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd/MM/yyyy') : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => { setStartDate(date); setOpenPopover(null); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div>
                <Label>{t('endDate')}</Label>
                <Popover open={openPopover === 'end-date'} onOpenChange={(open) => setOpenPopover(open ? 'end-date' : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("w-full justify-start text-start font-normal", !endDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd/MM/yyyy') : t('openEnded')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => { setEndDate(date); setOpenPopover(null); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {endDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-xs"
                    onClick={() => setEndDate(undefined)}
                  >
                    {t('openEnded')}
                  </Button>
                )}
              </div>

              {/* Monthly Rent */}
              <div>
                <Label htmlFor="monthly_rent">{t('monthlyRent')}</Label>
                <Input
                  id="monthly_rent"
                  type="number"
                  step="0.01"
                  value={formData.monthly_rent}
                  onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })}
                  required
                />
              </div>

              {/* Security Deposit */}
              <div>
                <Label htmlFor="security_deposit">{t('securityDeposit')}</Label>
                <Input
                  id="security_deposit"
                  type="number"
                  step="0.01"
                  value={formData.security_deposit}
                  onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                />
              </div>

              {/* Terms/Notes */}
              <div>
                <Label htmlFor="terms">{t('leaseTerms')}</Label>
                <Textarea
                  id="terms"
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Status (edit only) */}
              {editingLease && (
                <div>
                  <Label>{t('leaseStatus')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('leaseActive')}</SelectItem>
                      <SelectItem value="expired">{t('leaseExpired')}</SelectItem>
                      <SelectItem value="terminated">{t('leaseTerminated')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingLease ? t('update') : t('create')}
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
            <CardTitle>{t('allLeases')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('building')}</TableHead>
                  <TableHead className="text-start">{t('apartment')}</TableHead>
                  <TableHead className="text-start">{t('tenantName')}</TableHead>
                  <TableHead className="text-start">{t('startDate')}</TableHead>
                  <TableHead className="text-start">{t('endDate')}</TableHead>
                  <TableHead className="text-start">{t('monthlyRent')}</TableHead>
                  <TableHead className="text-start">{t('status')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableEmptyRow colSpan={8} message={t('noLeasesFound')} />
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow key={row.lease.id}>
                      <TableCell className="font-medium text-start">{row.buildingName}</TableCell>
                      <TableCell className="text-start">{row.apartmentNumber}</TableCell>
                      <TableCell className="text-start">{row.lease.tenantName}</TableCell>
                      <TableCell className="text-start">{formatDate(row.lease.startDate)}</TableCell>
                      <TableCell className="text-start">
                        {row.lease.endDate ? formatDate(row.lease.endDate) : t('openEnded')}
                      </TableCell>
                      <TableCell className="text-start">{formatCurrency(Number(row.lease.monthlyRent))}</TableCell>
                      <TableCell className="text-start">{getStatusBadge(row.lease.status)}</TableCell>
                      <TableCell className="text-start">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(row.lease.id)}>
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

export default Leases;
