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
import { BuildingFilter } from '@/components/BuildingFilter';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';

interface HandbookRow {
  entry: {
    id: string;
    buildingId: string | null;
    title: string;
    content: string;
    category: string;
    displayOrder: number;
  };
  buildingName: string | null;
}

const CATEGORIES = ['general', 'rules', 'emergency', 'maintenance', 'community'] as const;

const BuildingHandbook = () => {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  useRequireAuth('admin');
  const { buildings } = useBuildings(!!user);

  const [rows, setRows] = useState<HandbookRow[]>([]);
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HandbookRow['entry'] | null>(null);
  const [formData, setFormData] = useState({
    buildingId: '',
    title: '',
    content: '',
    category: 'general',
    displayOrder: '0',
  });

  useEffect(() => {
    if (user && isAdmin) {
      fetchEntries();
    }
  }, [user, isAdmin]);

  const fetchEntries = async () => {
    try {
      const data = await api.get<HandbookRow[]>('/handbook');
      setRows(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      buildingId: formData.buildingId || null,
      title: formData.title,
      content: formData.content,
      category: formData.category,
      displayOrder: parseInt(formData.displayOrder) || 0,
    };

    if (editingEntry) {
      try {
        await api.put(`/handbook/${editingEntry.id}`, payload);
        toast({ title: t('success'), description: t('entryUpdated') });
        fetchEntries();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    } else {
      try {
        await api.post('/handbook', payload);
        toast({ title: t('success'), description: t('entryCreated') });
        fetchEntries();
        resetForm();
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirmation'))) return;
    try {
      await api.delete(`/handbook/${id}`);
      toast({ title: t('success'), description: t('entryDeleted') });
      fetchEntries();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (row: HandbookRow) => {
    setEditingEntry(row.entry);
    setFormData({
      buildingId: row.entry.buildingId || '',
      title: row.entry.title,
      content: row.entry.content,
      category: row.entry.category,
      displayOrder: String(row.entry.displayOrder),
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      buildingId: '',
      title: '',
      content: '',
      category: 'general',
      displayOrder: '0',
    });
    setEditingEntry(null);
    setIsDialogOpen(false);
  };

  const filteredRows = useMemo(() => {
    let result = selectedBuildingFilter === 'all'
      ? rows
      : rows.filter(r => r.entry.buildingId === selectedBuildingFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(r =>
        r.entry.title.toLowerCase().includes(q) ||
        r.entry.category.toLowerCase().includes(q) ||
        (r.buildingName || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [rows, selectedBuildingFilter, searchQuery]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('buildingHandbook')}</h1>
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
              {t('addEntry')}
            </Button>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? t('editEntry') : t('addEntry')}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Building (optional) */}
              <div>
                <Label>{t('building')}</Label>
                <Select
                  value={formData.buildingId}
                  onValueChange={(value) => setFormData({ ...formData, buildingId: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('allBuildings')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('allBuildings')}</SelectItem>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="handbook_title">{t('title')}</Label>
                <Input
                  id="handbook_title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              {/* Content */}
              <div>
                <Label htmlFor="handbook_content">{t('content')}</Label>
                <Textarea
                  id="handbook_content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={5}
                  required
                />
              </div>

              {/* Category */}
              <div>
                <Label>{t('category')}</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Display Order */}
              <div>
                <Label htmlFor="display_order">{t('displayOrder')}</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingEntry ? t('update') : t('create')}
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
            <CardTitle>{t('buildingHandbook')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('building')}</TableHead>
                  <TableHead className="text-start">{t('title')}</TableHead>
                  <TableHead className="text-start">{t('category')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableEmptyRow colSpan={4} message={t('noHandbookEntries')} />
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow key={row.entry.id}>
                      <TableCell className="font-medium text-start">{row.buildingName || t('allBuildings')}</TableCell>
                      <TableCell className="text-start">{row.entry.title}</TableCell>
                      <TableCell className="text-start capitalize">{row.entry.category}</TableCell>
                      <TableCell className="text-start">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(row.entry.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

export default BuildingHandbook;
