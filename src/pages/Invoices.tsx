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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BuildingFilter } from '@/components/BuildingFilter';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface InvoiceRow {
  invoice: {
    id: string;
    invoiceNumber: string;
    apartmentId: string;
    buildingId: string;
    month: string;
    totalAmount: string;
    generatedAt: string;
  };
  apartmentNumber: string;
  buildingName: string;
}

interface ApartmentOption {
  id: string;
  apartmentNumber: string;
  buildingId: string;
}

const Invoices = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  useRequireAuth('admin-or-moderator');
  const { buildings } = useBuildings(!!user);

  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Generate dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [formBuildingId, setFormBuildingId] = useState('');
  const [selectedApartment, setSelectedApartment] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [generating, setGenerating] = useState(false);

  const filteredRows = useMemo(() => {
    const buildingFiltered = selectedBuildingFilter === 'all'
      ? invoiceRows
      : invoiceRows.filter(r => r.invoice.buildingId === selectedBuildingFilter);
    const query = searchQuery.toLowerCase().trim();
    if (!query) return buildingFiltered;
    return buildingFiltered.filter(r =>
      r.invoice.invoiceNumber.toLowerCase().includes(query) ||
      r.apartmentNumber.toLowerCase().includes(query) ||
      r.buildingName.toLowerCase().includes(query)
    );
  }, [invoiceRows, selectedBuildingFilter, searchQuery]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchInvoices();
      fetchApartments();
    }
  }, [user, isAdmin, isModerator]);

  const fetchInvoices = async () => {
    try {
      const data = await api.get<InvoiceRow[]>('/receipts/invoices');
      setInvoiceRows(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchApartments = async () => {
    try {
      const data = await api.get<any[]>('/apartments');
      setApartments(
        (data || []).map((item: any) => ({
          id: item.apartment.id,
          apartmentNumber: item.apartment.apartmentNumber,
          buildingId: item.apartment.buildingId,
        }))
      );
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const filteredApartments = useMemo(() => {
    if (!formBuildingId) return [];
    return apartments.filter(a => a.buildingId === formBuildingId);
  }, [apartments, formBuildingId]);

  const handleDownload = (invoiceId: string) => {
    window.open(`/api/receipts/invoices/${invoiceId}/download`);
  };

  const handleGenerate = async () => {
    if (!selectedApartment || !selectedMonth) return;
    setGenerating(true);
    try {
      await api.post('/receipts/invoices/generate', {
        apartmentId: selectedApartment,
        month: selectedMonth,
      });
      toast({ title: t('success'), description: t('invoiceGenerated') });
      setIsDialogOpen(false);
      setFormBuildingId('');
      setSelectedApartment('');
      setSelectedMonth('');
      fetchInvoices();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const openDialog = () => {
    setFormBuildingId('');
    setSelectedApartment('');
    setSelectedMonth('');
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t('invoiceManagement')}</h1>
        </div>
        <Button onClick={openDialog}>
          <Plus className="h-4 w-4 me-2" />
          {t('generateInvoice')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('allInvoices')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <SearchInput value={searchQuery} onChange={setSearchQuery} />
            <BuildingFilter
              buildings={buildings}
              value={selectedBuildingFilter}
              onChange={(val) => { setSelectedBuildingFilter(val); setCurrentPage(1); }}
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('building')}</TableHead>
                  <TableHead>{t('apartment')}</TableHead>
                  <TableHead>{t('invoiceNumber')}</TableHead>
                  <TableHead>{t('month')}</TableHead>
                  <TableHead>{t('amount')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableEmptyRow colSpan={7} message={t('noInvoicesFound')} />
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow key={row.invoice.id}>
                      <TableCell>{row.buildingName}</TableCell>
                      <TableCell>{row.apartmentNumber}</TableCell>
                      <TableCell>{row.invoice.invoiceNumber}</TableCell>
                      <TableCell>{row.invoice.month}</TableCell>
                      <TableCell>{formatCurrency(Number(row.invoice.totalAmount))}</TableCell>
                      <TableCell>{formatDate(row.invoice.generatedAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(row.invoice.id)}
                          title={t('downloadInvoice')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {/* Generate Invoice Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('generateInvoice')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('building')}</Label>
              <Select
                value={formBuildingId}
                onValueChange={(val) => {
                  setFormBuildingId(val);
                  setSelectedApartment('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectBuilding')} />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('apartment')}</Label>
              <Select
                value={selectedApartment}
                onValueChange={setSelectedApartment}
                disabled={!formBuildingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectApartment')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredApartments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.apartmentNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('month')}</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedApartment || !selectedMonth || generating}
              className="w-full"
            >
              {generating ? t('loading') : t('generateInvoice')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
