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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, Play, Settings2, Clock, Building2, Home, Plus, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface ApartmentRow {
  apartment: {
    id: string;
    apartmentNumber: string;
    buildingId: string;
    cachedBalance: number;
    collectionStageId: string | null;
    debtSince: string | null;
  };
  buildingName: string;
  stageName: string | null;
}

interface CollectionLogEntry {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  buildingName: string;
  stageNumber: number;
  stageName: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface CollectionStage {
  id: string;
  stageNumber: number;
  name: string;
  daysOverdue: number;
  actionType: string;
  templateId: string | null;
  isActive: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
}

const ACTION_TYPES = ['email_reminder', 'formal_notice', 'final_warning', 'custom'] as const;

const DebtCollection = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();

  // Apartments in collection
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [loadingApartments, setLoadingApartments] = useState(false);

  // Collection log
  const [logEntries, setLogEntries] = useState<CollectionLogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  // Stages
  const [stages, setStages] = useState<CollectionStage[]>([]);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<CollectionStage | null>(null);
  const [stageForm, setStageForm] = useState({
    stageNumber: '',
    name: '',
    daysOverdue: '',
    actionType: 'email_reminder' as string,
    templateId: '',
    isActive: true,
  });

  // Email templates for stage config
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

  // Processing state
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchApartments();
      fetchLog();
      fetchStages();
      fetchTemplates();
    }
  }, [user, isAdmin]);

  const fetchApartments = async () => {
    setLoadingApartments(true);
    try {
      const data = await api.get<ApartmentRow[]>('/apartments');
      // Filter to apartments that are in collection or have negative balance
      const inCollection = (data || []).filter(
        row => row.apartment.collectionStageId || row.apartment.cachedBalance < 0
      );
      setApartments(inCollection);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingApartments(false);
    }
  };

  const fetchLog = async () => {
    setLoadingLog(true);
    try {
      const data = await api.get<CollectionLogEntry[]>('/debt-collection/log');
      setLogEntries(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingLog(false);
    }
  };

  const fetchStages = async () => {
    try {
      const data = await api.get<CollectionStage[]>('/debt-collection/stages');
      setStages(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await api.get<EmailTemplate[]>('/email-templates');
      setEmailTemplates(data || []);
    } catch {
      // silently fail
    }
  };

  const handleTriggerCollection = async () => {
    setProcessing(true);
    try {
      const result = await api.post<{ processed: number; actions: number }>('/debt-collection/process');
      toast.success(
        `${t('collectionProcessed')}: ${result.processed} ${t('apartmentsProcessed')}, ${result.actions} ${t('actionsTaken')}`
      );
      fetchApartments();
      fetchLog();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getDaysOverdue = (debtSince: string | null): number => {
    if (!debtSince) return 0;
    const start = new Date(debtSince);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getStageBadge = (stageName: string | null) => {
    if (!stageName) return <Badge variant="secondary">{t('noStage')}</Badge>;
    return <Badge variant="destructive">{stageName}</Badge>;
  };

  const getActionTypeLabel = (actionType: string) => {
    switch (actionType) {
      case 'email_reminder': return t('emailReminder');
      case 'formal_notice': return t('formalNotice');
      case 'final_warning': return t('finalWarning');
      case 'custom': return t('custom');
      default: return actionType;
    }
  };

  // Stage CRUD
  const openStageCreate = () => {
    setEditingStage(null);
    setStageForm({
      stageNumber: String((stages.length > 0 ? Math.max(...stages.map(s => s.stageNumber)) : 0) + 1),
      name: '',
      daysOverdue: '',
      actionType: 'email_reminder',
      templateId: '',
      isActive: true,
    });
    setStageDialogOpen(true);
  };

  const openStageEdit = (stage: CollectionStage) => {
    setEditingStage(stage);
    setStageForm({
      stageNumber: String(stage.stageNumber),
      name: stage.name,
      daysOverdue: String(stage.daysOverdue),
      actionType: stage.actionType,
      templateId: stage.templateId || '',
      isActive: stage.isActive,
    });
    setStageDialogOpen(true);
  };

  const handleStageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageForm.name.trim() || !stageForm.daysOverdue) return;

    try {
      const payload = {
        stageNumber: parseInt(stageForm.stageNumber),
        name: stageForm.name,
        daysOverdue: parseInt(stageForm.daysOverdue),
        actionType: stageForm.actionType,
        templateId: stageForm.templateId || null,
        isActive: stageForm.isActive,
      };

      if (editingStage) {
        await api.put(`/debt-collection/stages/${editingStage.id}`, payload);
        toast.success(t('stageUpdated'));
      } else {
        await api.post('/debt-collection/stages', payload);
        toast.success(t('stageCreated'));
      }

      fetchStages();
      setStageDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStageDelete = async (id: string) => {
    try {
      await api.delete(`/debt-collection/stages/${id}`);
      toast.success(t('stageDeleted'));
      fetchStages();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('debtCollection')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              onClick={handleTriggerCollection}
              disabled={processing}
              className="w-full sm:w-auto"
            >
              <Play className="w-4 h-4 me-2" />
              {processing ? t('loading') : t('triggerCollection')}
            </Button>
          </div>
        </div>

        {/* Apartments in Collection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              {t('apartmentsInCollection')} ({apartments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingApartments ? (
              <p className="text-center text-muted-foreground">{t('loading')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('apartment')}</TableHead>
                      <TableHead className="text-start">{t('building')}</TableHead>
                      <TableHead className="text-start">{t('balance')}</TableHead>
                      <TableHead className="text-start">{t('daysOverdue')}</TableHead>
                      <TableHead className="text-start">{t('collectionStage')}</TableHead>
                      <TableHead className="text-start">{t('debtSince')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apartments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          {t('noApartmentsInCollection')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      apartments.map((row) => (
                        <TableRow key={row.apartment.id}>
                          <TableCell className="text-start font-medium">
                            <div className="flex items-center gap-1">
                              <Home className="w-4 h-4 text-muted-foreground" />
                              {t('apt')} {row.apartment.apartmentNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-start">
                            <div className="flex items-center gap-1">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {row.buildingName}
                            </div>
                          </TableCell>
                          <TableCell className="text-start">
                            <span className={row.apartment.cachedBalance < 0 ? 'text-destructive font-semibold' : 'text-green-600'}>
                              {formatCurrency(row.apartment.cachedBalance)}
                            </span>
                          </TableCell>
                          <TableCell className="text-start">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              {getDaysOverdue(row.apartment.debtSince)} {t('days')}
                            </div>
                          </TableCell>
                          <TableCell className="text-start">
                            {getStageBadge(row.stageName)}
                          </TableCell>
                          <TableCell className="text-start">
                            {row.apartment.debtSince ? formatDate(row.apartment.debtSince) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collection Log */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('collectionLog')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLog ? (
              <p className="text-center text-muted-foreground">{t('loading')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('date')}</TableHead>
                      <TableHead className="text-start">{t('apartment')}</TableHead>
                      <TableHead className="text-start">{t('building')}</TableHead>
                      <TableHead className="text-start">{t('collectionStage')}</TableHead>
                      <TableHead className="text-start">{t('action')}</TableHead>
                      <TableHead className="text-start">{t('details')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          {t('noCollectionLogEntries')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      logEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-start">{formatDate(entry.createdAt)}</TableCell>
                          <TableCell className="text-start">{t('apt')} {entry.apartmentNumber}</TableCell>
                          <TableCell className="text-start">{entry.buildingName}</TableCell>
                          <TableCell className="text-start">
                            <Badge variant="outline">{entry.stageName}</Badge>
                          </TableCell>
                          <TableCell className="text-start">{getActionTypeLabel(entry.action)}</TableCell>
                          <TableCell className="text-start text-sm text-muted-foreground max-w-[200px] truncate">
                            {entry.details || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collection Stages (collapsible) */}
        <Collapsible open={stagesOpen} onOpenChange={setStagesOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full text-start">
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    {t('collectionStages')}
                  </CardTitle>
                  {stagesOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="flex justify-end mb-4">
                  <Button variant="outline" size="sm" onClick={openStageCreate}>
                    <Plus className="w-4 h-4 me-1" />
                    {t('addStage')}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start">#</TableHead>
                        <TableHead className="text-start">{t('stageName')}</TableHead>
                        <TableHead className="text-start">{t('daysOverdue')}</TableHead>
                        <TableHead className="text-start">{t('actionType')}</TableHead>
                        <TableHead className="text-start">{t('active')}</TableHead>
                        <TableHead className="text-start">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stages.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            {t('noStagesConfigured')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        stages
                          .sort((a, b) => a.stageNumber - b.stageNumber)
                          .map((stage) => (
                            <TableRow key={stage.id}>
                              <TableCell className="text-start font-medium">{stage.stageNumber}</TableCell>
                              <TableCell className="text-start">{stage.name}</TableCell>
                              <TableCell className="text-start">{stage.daysOverdue} {t('days')}</TableCell>
                              <TableCell className="text-start">
                                <Badge variant="outline">{getActionTypeLabel(stage.actionType)}</Badge>
                              </TableCell>
                              <TableCell className="text-start">
                                {stage.isActive ? (
                                  <Badge className="bg-green-600 hover:bg-green-700">{t('active')}</Badge>
                                ) : (
                                  <Badge variant="secondary">{t('inactive')}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-start">
                                <div className="flex gap-1">
                                  <Button size="sm" variant="outline" onClick={() => openStageEdit(stage)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="destructive">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>{t('deleteStageConfirm')}</AlertDialogTitle>
                                        <AlertDialogDescription>{t('deleteStageDescription')}</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleStageDelete(stage.id)}>
                                          {t('delete')}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Stage Create/Edit Dialog */}
        <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingStage ? t('editStage') : t('addStage')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleStageSubmit} className="space-y-4">
              <div>
                <Label htmlFor="stageNumber">{t('stageNumber')}</Label>
                <Input
                  id="stageNumber"
                  type="number"
                  min="1"
                  value={stageForm.stageNumber}
                  onChange={e => setStageForm({ ...stageForm, stageNumber: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="stageName">{t('stageName')}</Label>
                <Input
                  id="stageName"
                  value={stageForm.name}
                  onChange={e => setStageForm({ ...stageForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="daysOverdue">{t('daysOverdue')}</Label>
                <Input
                  id="daysOverdue"
                  type="number"
                  min="1"
                  value={stageForm.daysOverdue}
                  onChange={e => setStageForm({ ...stageForm, daysOverdue: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>{t('actionType')}</Label>
                <Select
                  value={stageForm.actionType}
                  onValueChange={value => setStageForm({ ...stageForm, actionType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map(at => (
                      <SelectItem key={at} value={at}>{getActionTypeLabel(at)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('emailTemplate')}</Label>
                <Select
                  value={stageForm.templateId || 'none'}
                  onValueChange={value => setStageForm({ ...stageForm, templateId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('optional')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noTemplate')}</SelectItem>
                    {emailTemplates.map(tmpl => (
                      <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={stageForm.isActive}
                  onCheckedChange={checked => setStageForm({ ...stageForm, isActive: checked })}
                />
                <Label>{t('active')}</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingStage ? t('update') : t('create')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setStageDialogOpen(false)}>
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

export default DebtCollection;
