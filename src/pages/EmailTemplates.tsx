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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, Pencil, Eye, Code } from 'lucide-react';

// ─── Email template types ───

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

interface EmailTemplateWithMap extends Omit<EmailTemplate, 'translations'> {
  translations: {
    ar?: { subject: string; htmlBody: string };
    en?: { subject: string; htmlBody: string };
    he?: { subject: string; htmlBody: string };
  };
}

function toEmailTranslationMap(template: EmailTemplate): EmailTemplateWithMap {
  const map: EmailTemplateWithMap['translations'] = {};
  template.translations?.forEach(t => {
    map[t.language] = { subject: t.subject, htmlBody: t.htmlBody };
  });
  return { ...template, translations: map };
}

// ─── Ntfy template types ───

interface NtfyTemplateTranslation {
  language: 'ar' | 'en' | 'he';
  title: string;
  message: string;
}

interface NtfyTemplate {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  createdAt: string;
  translations: NtfyTemplateTranslation[];
}

interface NtfyTemplateWithMap extends Omit<NtfyTemplate, 'translations'> {
  translations: {
    ar?: { title: string; message: string };
    en?: { title: string; message: string };
    he?: { title: string; message: string };
  };
}

function toNtfyTranslationMap(template: NtfyTemplate): NtfyTemplateWithMap {
  const map: NtfyTemplateWithMap['translations'] = {};
  template.translations?.forEach(t => {
    map[t.language] = { title: t.title, message: t.message };
  });
  return { ...template, translations: map };
}

// ─── Per-template placeholder variables ───

const EMAIL_TEMPLATE_VARIABLES: Record<string, string[]> = {
  new_issue_report: ['category', 'description', 'reporterName', 'floor'],
  issue_resolved: ['category', 'description'],
  payment_reminder: ['apartmentNumber', 'buildingName', 'balance'],
  otp_email_change: ['otp'],
};

const NTFY_TEMPLATE_VARIABLES: Record<string, string[]> = {
  ntfy_new_issue: ['category', 'description', 'reporterName'],
  ntfy_payment_reminder: ['apartmentNumber', 'balance'],
};

const SAMPLE_VARIABLES: Record<string, string> = {
  category: 'plumbing',
  description: 'Water leak in kitchen',
  reporterName: 'Ahmad',
  floor: '3',
  apartmentNumber: '101',
  buildingName: 'Al-Salam Tower',
  balance: '500',
  otp: '123456',
};

// ─── Component ───

const EmailTemplates = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateWithMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplateWithMap | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState({ subject: '', body: '' });
  const [emailFormData, setEmailFormData] = useState({
    name: '',
    description: '',
    ar_subject: '',
    ar_body: '',
    en_subject: '',
    en_body: '',
    he_subject: '',
    he_body: '',
  });

  // Ntfy templates state
  const [ntfyTemplates, setNtfyTemplates] = useState<NtfyTemplateWithMap[]>([]);
  const [isNtfyDialogOpen, setIsNtfyDialogOpen] = useState(false);
  const [editingNtfyTemplate, setEditingNtfyTemplate] = useState<NtfyTemplateWithMap | null>(null);
  const [ntfyFormData, setNtfyFormData] = useState({
    name: '',
    description: '',
    ar_title: '',
    ar_message: '',
    en_title: '',
    en_message: '',
    he_title: '',
    he_message: '',
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
      fetchAll();
    }
  }, [user, isAdmin]);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [emailData, ntfyData] = await Promise.all([
        api.get<EmailTemplate[]>('/email/templates'),
        api.get<NtfyTemplate[]>('/email/ntfy-templates'),
      ]);
      setEmailTemplates((emailData || []).map(toEmailTranslationMap));
      setNtfyTemplates((ntfyData || []).map(toNtfyTranslationMap));
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Email template handlers ───

  const handleEditEmail = (template: EmailTemplateWithMap) => {
    setEditingEmailTemplate(template);
    setEmailFormData({
      name: template.name,
      description: template.description || '',
      ar_subject: template.translations.ar?.subject || '',
      ar_body: template.translations.ar?.htmlBody || '',
      en_subject: template.translations.en?.subject || '',
      en_body: template.translations.en?.htmlBody || '',
      he_subject: template.translations.he?.subject || '',
      he_body: template.translations.he?.htmlBody || '',
    });
    setIsEmailDialogOpen(true);
  };

  const handleSaveEmail = async () => {
    if (!editingEmailTemplate) return;
    try {
      await api.put(`/email/templates/${editingEmailTemplate.id}`, {
        name: emailFormData.name,
        description: emailFormData.description || null,
      });

      const translations: { language: string; subject: string; htmlBody: string }[] = [];
      if (emailFormData.ar_subject.trim() && emailFormData.ar_body.trim()) {
        translations.push({ language: 'ar', subject: emailFormData.ar_subject, htmlBody: emailFormData.ar_body });
      }
      if (emailFormData.en_subject.trim() && emailFormData.en_body.trim()) {
        translations.push({ language: 'en', subject: emailFormData.en_subject, htmlBody: emailFormData.en_body });
      }
      if (emailFormData.he_subject.trim() && emailFormData.he_body.trim()) {
        translations.push({ language: 'he', subject: emailFormData.he_subject, htmlBody: emailFormData.he_body });
      }
      if (translations.length > 0) {
        await api.put(`/email/templates/${editingEmailTemplate.id}/translations`, { translations });
      }

      toast({ title: t('success'), description: t('updateSuccess') });
      fetchAll();
      setIsEmailDialogOpen(false);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handlePreviewEmail = (langKey: 'ar' | 'en' | 'he') => {
    let subject = emailFormData[`${langKey}_subject`];
    let body = emailFormData[`${langKey}_body`];
    Object.entries(SAMPLE_VARIABLES).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
    setPreviewContent({ subject, body });
    setIsPreviewOpen(true);
  };

  // ─── Ntfy template handlers ───

  const handleEditNtfy = (template: NtfyTemplateWithMap) => {
    setEditingNtfyTemplate(template);
    setNtfyFormData({
      name: template.name,
      description: template.description || '',
      ar_title: template.translations.ar?.title || '',
      ar_message: template.translations.ar?.message || '',
      en_title: template.translations.en?.title || '',
      en_message: template.translations.en?.message || '',
      he_title: template.translations.he?.title || '',
      he_message: template.translations.he?.message || '',
    });
    setIsNtfyDialogOpen(true);
  };

  const handleSaveNtfy = async () => {
    if (!editingNtfyTemplate) return;
    try {
      await api.put(`/email/ntfy-templates/${editingNtfyTemplate.id}`, {
        name: ntfyFormData.name,
        description: ntfyFormData.description || null,
      });

      const translations: { language: string; title: string; message: string }[] = [];
      if (ntfyFormData.ar_title.trim() && ntfyFormData.ar_message.trim()) {
        translations.push({ language: 'ar', title: ntfyFormData.ar_title, message: ntfyFormData.ar_message });
      }
      if (ntfyFormData.en_title.trim() && ntfyFormData.en_message.trim()) {
        translations.push({ language: 'en', title: ntfyFormData.en_title, message: ntfyFormData.en_message });
      }
      if (ntfyFormData.he_title.trim() && ntfyFormData.he_message.trim()) {
        translations.push({ language: 'he', title: ntfyFormData.he_title, message: ntfyFormData.he_message });
      }
      if (translations.length > 0) {
        await api.put(`/email/ntfy-templates/${editingNtfyTemplate.id}/translations`, { translations });
      }

      toast({ title: t('success'), description: t('updateSuccess') });
      fetchAll();
      setIsNtfyDialogOpen(false);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  // ─── Shared helpers ───

  const getTranslationBadges = (translations: Record<string, any>) => {
    const badges = [];
    if (translations.ar) badges.push(<Badge key="ar" variant="default" className="bg-green-500">AR</Badge>);
    if (translations.en) badges.push(<Badge key="en" variant="default" className="bg-blue-500">EN</Badge>);
    if (translations.he) badges.push(<Badge key="he" variant="default" className="bg-purple-500">HE</Badge>);
    if (badges.length === 0) badges.push(<Badge key="none" variant="destructive">{t('disabled')}</Badge>);
    return badges;
  };

  const getEmailDisplayName = (identifier: string): string => {
    const map: Record<string, string> = {
      new_issue_report: t('newIssueReportTemplate'),
      issue_resolved: t('issueResolvedTemplate'),
      payment_reminder: t('paymentReminderTemplate'),
      otp_email_change: t('otpEmailChangeTemplate'),
    };
    return map[identifier] || identifier;
  };

  const getNtfyDisplayName = (identifier: string): string => {
    const map: Record<string, string> = {
      ntfy_new_issue: t('ntfyNewIssueTemplate'),
      ntfy_payment_reminder: t('ntfyPaymentReminderTemplate'),
    };
    return map[identifier] || identifier;
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 py-4 sm:p-6 max-w-7xl" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <Bell className="h-8 w-8" />
          {t('notificationTemplates')}
        </h1>
        <p className="text-muted-foreground">{t('notificationTemplatesDescription')}</p>
      </div>

      {/* ═══ Email Templates Section ═══ */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5" />
          {t('emailTemplates')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emailTemplates.map((template) => {
            const variables = EMAIL_TEMPLATE_VARIABLES[template.identifier] || [];
            return (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{getEmailDisplayName(template.identifier)}</CardTitle>
                      <CardDescription className="mt-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{template.identifier}</code>
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleEditEmail(template)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {template.description && (
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  )}
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Code className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{t('templateVariables')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {variables.map((v) => (
                        <code key={v} className="bg-muted px-1.5 py-0.5 rounded text-xs">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('translations')}:</span>
                    <div className="flex gap-1">{getTranslationBadges(template.translations)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ═══ Ntfy Push Templates Section ═══ */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5" />
          {t('ntfyTemplates')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ntfyTemplates.map((template) => {
            const variables = NTFY_TEMPLATE_VARIABLES[template.identifier] || [];
            return (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{getNtfyDisplayName(template.identifier)}</CardTitle>
                      <CardDescription className="mt-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{template.identifier}</code>
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleEditNtfy(template)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {template.description && (
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  )}
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Code className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{t('templateVariables')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {variables.map((v) => (
                        <code key={v} className="bg-muted px-1.5 py-0.5 rounded text-xs">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('translations')}:</span>
                    <div className="flex gap-1">{getTranslationBadges(template.translations)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ═══ Email Edit Dialog ═══ */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('editTemplate')}
              {editingEmailTemplate && (
                <code className="text-sm font-normal bg-muted px-2 py-0.5 rounded ms-2">{editingEmailTemplate.identifier}</code>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('templateName')}</Label>
                <Input
                  value={emailFormData.name}
                  onChange={(e) => setEmailFormData({ ...emailFormData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('description')} ({t('optional')})</Label>
                <Input
                  value={emailFormData.description}
                  onChange={(e) => setEmailFormData({ ...emailFormData, description: e.target.value })}
                />
              </div>
            </div>

            {editingEmailTemplate && EMAIL_TEMPLATE_VARIABLES[editingEmailTemplate.identifier] && (
              <div className="bg-muted/50 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('templateVariables')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EMAIL_TEMPLATE_VARIABLES[editingEmailTemplate.identifier].map((v) => (
                    <code key={v} className="bg-background px-2 py-1 rounded text-sm border">{`{{${v}}}`}</code>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="ar" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ar">{t('arabic')}</TabsTrigger>
                <TabsTrigger value="en">{t('english')}</TabsTrigger>
                <TabsTrigger value="he">{t('hebrew')}</TabsTrigger>
              </TabsList>
              {(['ar', 'en', 'he'] as const).map((lang) => (
                <TabsContent key={lang} value={lang} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>{t('emailSubject')}</Label>
                      {(emailFormData[`${lang}_subject`] || emailFormData[`${lang}_body`]) && (
                        <Button variant="outline" size="sm" onClick={() => handlePreviewEmail(lang)}>
                          <Eye className="h-4 w-4 me-1" />
                          {t('preview')}
                        </Button>
                      )}
                    </div>
                    <Input
                      value={emailFormData[`${lang}_subject`]}
                      onChange={(e) => setEmailFormData({ ...emailFormData, [`${lang}_subject`]: e.target.value })}
                      dir={lang === 'en' ? 'ltr' : 'rtl'}
                    />
                  </div>
                  <div>
                    <Label>{t('emailBody')} (HTML)</Label>
                    <Textarea
                      value={emailFormData[`${lang}_body`]}
                      onChange={(e) => setEmailFormData({ ...emailFormData, [`${lang}_body`]: e.target.value })}
                      rows={10}
                      dir={lang === 'en' ? 'ltr' : 'rtl'}
                      className="font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>{t('cancel')}</Button>
              <Button onClick={handleSaveEmail}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Ntfy Edit Dialog ═══ */}
      <Dialog open={isNtfyDialogOpen} onOpenChange={setIsNtfyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('editTemplate')}
              {editingNtfyTemplate && (
                <code className="text-sm font-normal bg-muted px-2 py-0.5 rounded ms-2">{editingNtfyTemplate.identifier}</code>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('templateName')}</Label>
                <Input
                  value={ntfyFormData.name}
                  onChange={(e) => setNtfyFormData({ ...ntfyFormData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('description')} ({t('optional')})</Label>
                <Input
                  value={ntfyFormData.description}
                  onChange={(e) => setNtfyFormData({ ...ntfyFormData, description: e.target.value })}
                />
              </div>
            </div>

            {editingNtfyTemplate && NTFY_TEMPLATE_VARIABLES[editingNtfyTemplate.identifier] && (
              <div className="bg-muted/50 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('templateVariables')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {NTFY_TEMPLATE_VARIABLES[editingNtfyTemplate.identifier].map((v) => (
                    <code key={v} className="bg-background px-2 py-1 rounded text-sm border">{`{{${v}}}`}</code>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="ar" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ar">{t('arabic')}</TabsTrigger>
                <TabsTrigger value="en">{t('english')}</TabsTrigger>
                <TabsTrigger value="he">{t('hebrew')}</TabsTrigger>
              </TabsList>
              {(['ar', 'en', 'he'] as const).map((lang) => (
                <TabsContent key={lang} value={lang} className="space-y-4">
                  <div>
                    <Label>{t('ntfyTitle')}</Label>
                    <Input
                      value={ntfyFormData[`${lang}_title`]}
                      onChange={(e) => setNtfyFormData({ ...ntfyFormData, [`${lang}_title`]: e.target.value })}
                      dir={lang === 'en' ? 'ltr' : 'rtl'}
                    />
                  </div>
                  <div>
                    <Label>{t('ntfyMessage')}</Label>
                    <Textarea
                      value={ntfyFormData[`${lang}_message`]}
                      onChange={(e) => setNtfyFormData({ ...ntfyFormData, [`${lang}_message`]: e.target.value })}
                      rows={4}
                      dir={lang === 'en' ? 'ltr' : 'rtl'}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsNtfyDialogOpen(false)}>{t('cancel')}</Button>
              <Button onClick={handleSaveNtfy}>{t('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Email Preview Dialog ═══ */}
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
    </div>
  );
};

export default EmailTemplates;
