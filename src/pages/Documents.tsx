import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen, Upload, Trash2, FileText, Download, Building2, Home, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Document {
  id: string;
  title: string;
  description: string | null;
  scopeType: 'building' | 'apartment' | 'user';
  scopeId: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}

interface Building {
  id: string;
  name: string;
}

interface ApartmentRow {
  apartment: {
    id: string;
    apartmentNumber: string;
    buildingId: string;
  };
  buildingName: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
}

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return '🖼';
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('xls')) return '📊';
  if (fileType.includes('word') || fileType.includes('doc')) return '📝';
  return '📎';
}

const Documents = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'building' | 'apartment' | 'user'>('building');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [apartments, setApartments] = useState<ApartmentRow[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scopeId: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin && !isModerator) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, isModerator, loading, navigate]);

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchBuildings();
      fetchApartments();
      fetchUsers();
    }
  }, [user, isAdmin, isModerator]);

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchDocuments(activeTab);
    }
  }, [user, isAdmin, isModerator, activeTab]);

  const fetchBuildings = async () => {
    try {
      const data = await api.get<Building[]>('/buildings');
      setBuildings(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchApartments = async () => {
    try {
      const data = await api.get<ApartmentRow[]>('/apartments');
      setApartments(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get<UserItem[]>('/users');
      setUsers(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const fetchDocuments = async (scopeType: string) => {
    try {
      const data = await api.get<Document[]>(`/documents?scopeType=${scopeType}`);
      setDocuments(data || []);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formDataPayload = new FormData();
      formDataPayload.append('file', selectedFile);
      formDataPayload.append('title', formData.title);
      formDataPayload.append('description', formData.description);
      formDataPayload.append('scopeType', activeTab);
      formDataPayload.append('scopeId', formData.scopeId);

      await api.post('/documents', formDataPayload);

      toast({ title: t('success'), description: t('documentUploaded') });
      fetchDocuments(activeTab);
      resetForm();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/documents/${deleteTarget.id}`);
      toast({ title: t('success'), description: t('documentDeleted') });
      fetchDocuments(activeTab);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', scopeId: '' });
    setSelectedFile(null);
    setIsDialogOpen(false);
  };

  const getScopeName = (doc: Document): string => {
    if (doc.scopeType === 'building') {
      return buildings.find(b => b.id === doc.scopeId)?.name || doc.scopeId;
    }
    if (doc.scopeType === 'apartment') {
      const row = apartments.find(a => a.apartment.id === doc.scopeId);
      return row ? `${row.buildingName} - ${row.apartment.apartmentNumber}` : doc.scopeId;
    }
    if (doc.scopeType === 'user') {
      const u = users.find(u => u.id === doc.scopeId);
      return u ? u.name : doc.scopeId;
    }
    return doc.scopeId;
  };

  const renderScopeDropdown = () => {
    if (activeTab === 'building') {
      return (
        <Select value={formData.scopeId} onValueChange={(value) => setFormData({ ...formData, scopeId: value })}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectBuilding')} />
          </SelectTrigger>
          <SelectContent>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (activeTab === 'apartment') {
      return (
        <Select value={formData.scopeId} onValueChange={(value) => setFormData({ ...formData, scopeId: value })}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectApartment')} />
          </SelectTrigger>
          <SelectContent>
            {apartments.map((row) => (
              <SelectItem key={row.apartment.id} value={row.apartment.id}>
                {row.buildingName} - {row.apartment.apartmentNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (activeTab === 'user') {
      return (
        <Select value={formData.scopeId} onValueChange={(value) => setFormData({ ...formData, scopeId: value })}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectUser')} />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || (!isAdmin && !isModerator)) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('documents')}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              {t('backToDashboard')}
            </Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="w-full sm:w-auto">
              <Upload className="w-4 h-4 me-2" />
              {t('uploadDocument')}
            </Button>
          </div>
        </div>

        {/* Upload Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('uploadDocument')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <Label htmlFor="doc-title">{t('documentTitle')}</Label>
                <Input
                  id="doc-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="doc-description">{t('description')}</Label>
                <Textarea
                  id="doc-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('optional')}
                />
              </div>

              <div>
                <Label>{t('documentScope')}</Label>
                {renderScopeDropdown()}
              </div>

              <div>
                <Label htmlFor="doc-file">{t('selectFile')}</Label>
                <Input
                  id="doc-file"
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('acceptedFileTypes')}
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={uploading || !selectedFile}>
                  {uploading ? t('uploading') : t('upload')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteDocumentConfirm')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{t('delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Tabs */}
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'building' | 'apartment' | 'user')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="building" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('buildings')}</span>
                </TabsTrigger>
                <TabsTrigger value="apartment" className="gap-2">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('apartments')}</span>
                </TabsTrigger>
                <TabsTrigger value="user" className="gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('users')}</span>
                </TabsTrigger>
              </TabsList>

              {/* Buildings Documents */}
              <TabsContent value="building">
                {renderDocumentsList()}
              </TabsContent>

              {/* Apartments Documents */}
              <TabsContent value="apartment">
                {renderDocumentsList()}
              </TabsContent>

              {/* Users Documents */}
              <TabsContent value="user">
                {renderDocumentsList()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  function renderDocumentsList() {
    if (documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mb-3 opacity-50" />
          <p>{t('noDocumentsFound')}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {documents.map((doc) => (
          <Card key={doc.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl flex-shrink-0">{getFileIcon(doc.fileType)}</span>
                  <CardTitle className="text-sm font-medium truncate">{doc.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-2">
              {doc.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
              )}
              <div className="text-xs text-muted-foreground space-y-1 mt-auto">
                <div className="flex justify-between">
                  <span>{t('scope')}</span>
                  <span className="font-medium truncate ms-2">{getScopeName(doc)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('fileSize')}</span>
                  <span className="font-medium">{formatFileSize(doc.fileSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('uploadedAt')}</span>
                  <span className="font-medium">{formatDate(doc.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => window.open(doc.fileUrl)}
                >
                  <Download className="w-3 h-3" />
                  {t('download')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteTarget(doc)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
};

export default Documents;
