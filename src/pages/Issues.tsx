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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Plus, CheckCircle, Wrench, Upload, X, Eye } from 'lucide-react';

interface Building {
  id: string;
  name: string;
  numberOfFloors: number | null;
  undergroundFloors: number | null;
}

interface IssueRow {
  issue: {
    id: string;
    buildingId: string;
    reporterId: string;
    floor: number | null;
    category: string;
    description: string;
    status: string;
    resolvedAt: string | null;
    createdAt: string;
  };
  buildingName: string;
  reporterName: string;
}

interface Attachment {
  fileUrl: string;
  fileType: string;
  originalName?: string;
}

const CATEGORIES = ['plumbing', 'electrical', 'elevator', 'water_leak', 'cleaning', 'structural', 'safety', 'other'] as const;

const Issues = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const { currencySymbol } = useCurrency();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBuilding, setFilterBuilding] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Form state
  const [formBuildingId, setFormBuildingId] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAttachments, setFormAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Detail view dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailIssue, setDetailIssue] = useState<IssueRow | null>(null);
  const [detailAttachments, setDetailAttachments] = useState<Attachment[]>([]);

  // Convert to maintenance dialog
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertIssue, setConvertIssue] = useState<IssueRow | null>(null);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintCost, setMaintCost] = useState('');

  const canManage = isAdmin || isModerator;

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchIssues();
      fetchBuildings();
    }
  }, [user]);

  const fetchIssues = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterBuilding !== 'all') params.set('buildingId', filterBuilding);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      const qs = params.toString();
      const data = await api.get(`/issues${qs ? `?${qs}` : ''}`);
      setIssues(data || []);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const fetchBuildings = async () => {
    try {
      const data = await api.get('/buildings');
      setBuildings(data || []);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    if (user) fetchIssues();
  }, [filterStatus, filterBuilding, filterCategory]);

  const viewIssueDetails = async (row: IssueRow) => {
    setDetailIssue(row);
    setDetailAttachments([]);
    setDetailDialogOpen(true);
    try {
      const data = await api.get<{ issue: any; buildingName: string; reporterName: string; attachments: Attachment[] }>(`/issues/${row.issue.id}`);
      setDetailAttachments(data.attachments || []);
    } catch {
      // silently fail — we still show the issue details without attachments
    }
  };

  const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    // Client-side size check
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: t('error'), description: t('fileTooLarge'), variant: 'destructive' });
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await api.upload<{ url: string; fileType: string; originalName: string }>('/upload/issue-attachment', file);
        setFormAttachments(prev => [...prev, { fileUrl: result.url, fileType: result.fileType, originalName: result.originalName }]);
      }
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setFormAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBuildingId || !formCategory || !formDescription.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post('/issues', {
        buildingId: formBuildingId,
        floor: formFloor ? parseInt(formFloor) : null,
        category: formCategory,
        description: formDescription,
        attachments: formAttachments.length > 0 ? formAttachments : undefined,
      });
      toast({ title: t('success'), description: t('issueReportedSuccess') });
      resetForm();
      fetchIssues();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await api.put(`/issues/${id}/resolve`);
      toast({ title: t('success'), description: t('issueResolvedSuccess') });
      fetchIssues();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleConvertToMaintenance = async () => {
    if (!convertIssue || !maintTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post('/maintenance', {
        buildingId: convertIssue.issue.buildingId,
        issueId: convertIssue.issue.id,
        title: maintTitle,
        description: convertIssue.issue.description,
        estimatedCost: maintCost ? parseFloat(maintCost) : null,
      });
      toast({ title: t('success'), description: t('maintenanceCreatedSuccess') });
      setConvertDialogOpen(false);
      setConvertIssue(null);
      setMaintTitle('');
      setMaintCost('');
      fetchIssues();
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConvertDialog = (row: IssueRow) => {
    setConvertIssue(row);
    setMaintTitle(`${t(row.issue.category as any)}: ${row.issue.description.slice(0, 100)}`);
    setMaintCost('');
    setConvertDialogOpen(true);
  };

  const resetForm = () => {
    setFormBuildingId('');
    setFormFloor('');
    setFormCategory('');
    setFormDescription('');
    setFormAttachments([]);
    setIsDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive">{t('open')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">{t('inProgress')}</Badge>;
      case 'resolved':
        return <Badge className="bg-green-600 hover:bg-green-700">{t('resolved')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    // Convert snake_case to camelCase to match i18n keys (e.g. water_leak → waterLeak)
    const key = category.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as any;
    return t(key) || category;
  };

  const getFloorOptions = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return [];

    const floors: { value: string; label: string }[] = [];
    const underground = building.undergroundFloors || 0;

    for (let i = -underground; i <= (building.numberOfFloors || 1); i++) {
      if (i < 0) floors.push({ value: String(i), label: `${t('parkingFloor')} ${i}` });
      else if (i === 0) floors.push({ value: '0', label: t('groundFloor') });
      else floors.push({ value: String(i), label: `${t('floor')} ${i}` });
    }
    return floors;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('issueReports')}</h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 me-2" />
                {t('reportIssue')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('reportIssue')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                {formBuildingId && (
                  <div>
                    <Label>{t('floor')}</Label>
                    <Select value={formFloor} onValueChange={setFormFloor}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectFloor')} />
                      </SelectTrigger>
                      <SelectContent>
                        {getFloorOptions(formBuildingId).map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>{t('issueCategory')}</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('issueDescription')}</Label>
                  <Textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                <div>
                  <Label>{t('attachments')}</Label>
                  <div className="mt-1">
                    <label className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{uploading ? t('loading') : t('uploadAttachments')}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpg,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  {formAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formAttachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                          <span className="truncate max-w-[120px]">{att.originalName || 'file'}</span>
                          <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isSubmitting || !formBuildingId || !formCategory}>
                    {isSubmitting ? t('loading') : t('create')}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              <SelectItem value="open">{t('open')}</SelectItem>
              <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
              <SelectItem value="resolved">{t('resolved')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBuilding} onValueChange={setFilterBuilding}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allBuildings')}</SelectItem>
              {buildings.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCategories')}</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('issueReports')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t('building')}</TableHead>
                    <TableHead className="text-start">{t('issueCategory')}</TableHead>
                    <TableHead className="text-start">{t('issueDescription')}</TableHead>
                    <TableHead className="text-start">{t('floor')}</TableHead>
                    <TableHead className="text-start">{t('reporter')}</TableHead>
                    <TableHead className="text-start">{t('status')}</TableHead>
                    <TableHead className="text-start">{t('reportedAt')}</TableHead>
                    {canManage && <TableHead className="text-start">{t('actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground">
                        {t('noIssuesFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues.map((row) => (
                      <TableRow key={row.issue.id} className="cursor-pointer hover:bg-muted/50" onClick={() => viewIssueDetails(row)}>
                        <TableCell className="text-start">{row.buildingName}</TableCell>
                        <TableCell className="text-start">{getCategoryLabel(row.issue.category)}</TableCell>
                        <TableCell className="text-start max-w-[200px] truncate">{row.issue.description}</TableCell>
                        <TableCell className="text-start">{row.issue.floor ?? '-'}</TableCell>
                        <TableCell className="text-start">{row.reporterName}</TableCell>
                        <TableCell className="text-start">{getStatusBadge(row.issue.status)}</TableCell>
                        <TableCell className="text-start">{formatDate(row.issue.createdAt)}</TableCell>
                        {canManage && (
                          <TableCell className="text-start" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => viewIssueDetails(row)} title={t('viewDetails')}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {row.issue.status !== 'resolved' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" title={t('resolveIssue')}>
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t('resolveIssue')}</AlertDialogTitle>
                                      <AlertDialogDescription>{t('resolveIssueConfirm')}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleResolve(row.issue.id)}>
                                        {t('resolveIssue')}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {row.issue.status !== 'resolved' && (
                                <Button size="sm" variant="outline" onClick={() => openConvertDialog(row)} title={t('convertToMaintenance')}>
                                  <Wrench className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Issue Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('issueDetails')}</DialogTitle>
            </DialogHeader>
            {detailIssue && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('building')}</span>
                    <p className="font-medium">{detailIssue.buildingName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('floor')}</span>
                    <p className="font-medium">{detailIssue.issue.floor ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('issueCategory')}</span>
                    <p className="font-medium">{getCategoryLabel(detailIssue.issue.category)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('status')}</span>
                    <p>{getStatusBadge(detailIssue.issue.status)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('reporter')}</span>
                    <p className="font-medium">{detailIssue.reporterName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('reportedAt')}</span>
                    <p className="font-medium">{formatDate(detailIssue.issue.createdAt)}</p>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">{t('issueDescription')}</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{detailIssue.issue.description}</p>
                </div>

                {detailAttachments.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">{t('attachments')}</span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {detailAttachments.map((att, i) => (
                        <a key={i} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                          {att.fileType === 'video' ? (
                            <video src={att.fileUrl} controls className="w-full rounded border" />
                          ) : (
                            <img src={att.fileUrl} alt={att.originalName || 'attachment'} className="w-full rounded border object-cover max-h-48" />
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {detailIssue.issue.resolvedAt && (
                  <div>
                    <span className="text-sm text-muted-foreground">{t('resolved')}</span>
                    <p className="text-sm font-medium">{formatDate(detailIssue.issue.resolvedAt)}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Convert to Maintenance Dialog */}
        <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('convertToMaintenance')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('jobTitle')}</Label>
                <Input value={maintTitle} onChange={e => setMaintTitle(e.target.value)} />
              </div>
              <div>
                <Label>{t('estimatedCost')}</Label>
                <div className="relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={maintCost}
                    onChange={e => setMaintCost(e.target.value)}
                    className="ps-7"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('costWillBeSplit')}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConvertToMaintenance} className="flex-1" disabled={isSubmitting || !maintTitle.trim()}>
                  {isSubmitting ? t('loading') : t('create')}
                </Button>
                <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Issues;
