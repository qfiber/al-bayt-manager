import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mail, Pencil, Trash2, Plus, Eye } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface EmailTemplateTranslation {
  language: 'ar' | 'en' | 'he';
  subject: string;
  htmlBody: string;
}

interface EmailTemplate {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  createdAt: string;
  translations: EmailTemplateTranslation[];
}

// Internal UI shape for convenient access by language
interface TemplateWithTranslationMap extends Omit<EmailTemplate, 'translations'> {
  translations: {
    ar?: { subject: string; htmlBody: string };
    en?: { subject: string; htmlBody: string };
    he?: { subject: string; htmlBody: string };
  };
}

function toTranslationMap(template: EmailTemplate): TemplateWithTranslationMap {
  const map: TemplateWithTranslationMap['translations'] = {};
  template.translations?.forEach(t => {
    map[t.language] = { subject: t.subject, htmlBody: t.htmlBody };
  });
  return { ...template, translations: map };
}

const EmailTemplates = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<TemplateWithTranslationMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithTranslationMap | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateWithTranslationMap | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState({ subject: '', body: '' });

  const [formData, setFormData] = useState({
    identifier: '',
    name: '',
    description: '',
    ar_subject: '',
    ar_body: '',
    en_subject: '',
    en_body: '',
    he_subject: '',
    he_body: '',
  });

  const isRTL = language === 'ar' || language === 'he';

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchTemplates();
    }
  }, [user, isAdmin]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<EmailTemplate[]>('/email/templates');
      const mapped = (data || []).map(toTranslationMap);
      setTemplates(mapped);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      identifier: '',
      name: '',
      description: '',
      ar_subject: '',
      ar_body: '',
      en_subject: '',
      en_body: '',
      he_subject: '',
      he_body: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (template: TemplateWithTranslationMap) => {
    setEditingTemplate(template);
    setFormData({
      identifier: template.identifier,
      name: template.name,
      description: template.description || '',
      ar_subject: template.translations.ar?.subject || '',
      ar_body: template.translations.ar?.htmlBody || '',
      en_subject: template.translations.en?.subject || '',
      en_body: template.translations.en?.htmlBody || '',
      he_subject: template.translations.he?.subject || '',
      he_body: template.translations.he?.htmlBody || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      let templateId = editingTemplate?.id;

      if (editingTemplate) {
        // Update template
        await api.put(`/email/templates/${editingTemplate.id}`, {
          name: formData.name,
          description: formData.description || null,
        });
      } else {
        // Create template
        const data = await api.post<{ id: string }>('/email/templates', {
          identifier: formData.identifier,
          name: formData.name,
          description: formData.description || null,
        });
        templateId = data.id;
      }

      // Build translations array for languages that have content
      const translations: { language: string; subject: string; htmlBody: string }[] = [];

      if (formData.ar_subject.trim() && formData.ar_body.trim()) {
        translations.push({
          language: 'ar',
          subject: formData.ar_subject,
          htmlBody: formData.ar_body,
        });
      }

      if (formData.en_subject.trim() && formData.en_body.trim()) {
        translations.push({
          language: 'en',
          subject: formData.en_subject,
          htmlBody: formData.en_body,
        });
      }

      if (formData.he_subject.trim() && formData.he_body.trim()) {
        translations.push({
          language: 'he',
          subject: formData.he_subject,
          htmlBody: formData.he_body,
        });
      }

      if (translations.length > 0) {
        await api.put(`/email/templates/${templateId}/translations`, { translations });
      }

      toast({ title: t('success'), description: editingTemplate ? t('updateSuccess') : t('addSuccess') });
      fetchTemplates();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      await api.delete(`/email/templates/${deletingTemplate.id}`);

      toast({ title: t('success'), description: t('deleteSuccess') });
      fetchTemplates();
      setIsDeleteDialogOpen(false);
      setDeletingTemplate(null);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handlePreview = (langKey: 'ar' | 'en' | 'he') => {
    const subjectKey = `${langKey}_subject` as keyof typeof formData;
    const bodyKey = `${langKey}_body` as keyof typeof formData;

    const samplePlaceholders = {
      username: 'محمد أحمد',
      apartment_number: '101',
      building_name: 'برج السلام',
    };

    let subject = formData[subjectKey];
    let body = formData[bodyKey];

    Object.entries(samplePlaceholders).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });

    setPreviewContent({ subject, body });
    setIsPreviewOpen(true);
  };

  const getTranslationBadges = (template: TemplateWithTranslationMap) => {
    const badges = [];
    if (template.translations.ar) badges.push(<Badge key="ar" variant="default" className="bg-green-500">AR</Badge>);
    if (template.translations.en) badges.push(<Badge key="en" variant="default" className="bg-blue-500">EN</Badge>);
    if (template.translations.he) badges.push(<Badge key="he" variant="default" className="bg-purple-500">HE</Badge>);
    if (badges.length === 0) badges.push(<Badge key="none" variant="destructive">{t('disabled')}</Badge>);
    return badges;
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            {t('emailTemplates')}
          </h1>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">{t('emailTemplatesDescription')}</p>
          <Button onClick={handleCreate}>
            <Plus className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('addTemplate')}
          </Button>
        </div>
      </div>

      {/* Placeholders Reference */}
      <Card className="mb-6">
        <CardHeader className="py-4">
          <CardTitle className="text-lg">{t('availablePlaceholders')}</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex flex-wrap gap-2">
            <code className="bg-muted px-2 py-1 rounded text-sm">{'{{username}}'}</code>
            <code className="bg-muted px-2 py-1 rounded text-sm">{'{{apartment_number}}'}</code>
            <code className="bg-muted px-2 py-1 rounded text-sm">{'{{building_name}}'}</code>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('templateIdentifier')}</TableHead>
                <TableHead>{t('templateName')}</TableHead>
                <TableHead>{t('translations')}</TableHead>
                <TableHead className="text-center">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {t('noTemplatesFound')}
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-mono text-sm">{template.identifier}</TableCell>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">{getTranslationBadges(template)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingTemplate(template);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? t('editTemplate') : t('addTemplate')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('templateIdentifier')}</Label>
                <Input
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  placeholder="payment_confirmation"
                  disabled={!!editingTemplate}
                />
              </div>
              <div>
                <Label>{t('templateName')}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Payment Confirmation"
                />
              </div>
            </div>
            <div>
              <Label>{t('description')} ({t('optional')})</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <Tabs defaultValue="ar" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ar">{t('arabic')}</TabsTrigger>
                <TabsTrigger value="en">{t('english')}</TabsTrigger>
                <TabsTrigger value="he">{t('hebrew')}</TabsTrigger>
              </TabsList>

              {['ar', 'en', 'he'].map((lang) => (
                <TabsContent key={lang} value={lang} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>{t('emailSubject')}</Label>
                      {(formData[`${lang}_subject` as keyof typeof formData] || formData[`${lang}_body` as keyof typeof formData]) && (
                        <Button variant="outline" size="sm" onClick={() => handlePreview(lang as 'ar' | 'en' | 'he')}>
                          <Eye className="h-4 w-4 mr-1" />
                          {t('preview')}
                        </Button>
                      )}
                    </div>
                    <Input
                      value={formData[`${lang}_subject` as keyof typeof formData]}
                      onChange={(e) => setFormData({ ...formData, [`${lang}_subject`]: e.target.value })}
                      dir={lang === 'en' ? 'ltr' : 'rtl'}
                    />
                  </div>
                  <div>
                    <Label>{t('emailBody')} (HTML)</Label>
                    <Textarea
                      value={formData[`${lang}_body` as keyof typeof formData]}
                      onChange={(e) => setFormData({ ...formData, [`${lang}_body`]: e.target.value })}
                      rows={10}
                      dir={lang === 'en' ? 'ltr' : 'rtl'}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSave}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('preview')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">{t('emailSubject')}</Label>
              <p className="font-medium">{previewContent.subject}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">{t('emailBody')}</Label>
              <div
                className="border rounded-md p-4 mt-2 bg-white"
                dangerouslySetInnerHTML={{ __html: previewContent.body }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteTemplateConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmailTemplates;
