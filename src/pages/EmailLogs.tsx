import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { PaginationControls } from '@/components/PaginationControls';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, MessageSquare, CheckCircle, XCircle, SkipForward, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface EmailLog {
  id: string;
  createdAt: string;
  userId: string | null;
  recipientEmail: string;
  templateIdentifier: string;
  userPreferredLanguage: string | null;
  languageUsed: string | null;
  subjectSent: string | null;
  status: 'sent' | 'failed' | 'skipped';
  failureReason: string | null;
  metadata: any;
}

interface SmsLog {
  id: string;
  createdAt: string;
  userId: string | null;
  recipientPhone: string;
  templateIdentifier: string | null;
  languageUsed: string | null;
  messageSent: string | null;
  status: 'sent' | 'failed';
  failureReason: string | null;
}

interface EmailTemplate {
  id: string;
  identifier: string;
  name: string;
}

interface SmsTemplate {
  id: string;
  identifier: string;
  name: string;
}

const PAGE_SIZE = 50;

const EmailLogs = () => {
  useRequireAuth('admin');
  const { user, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();

  // Email logs state
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // SMS logs state
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [isSmsLoading, setIsSmsLoading] = useState(true);
  const [smsStatusFilter, setSmsStatusFilter] = useState<string>('all');
  const [smsTemplateFilter, setSmsTemplateFilter] = useState<string>('all');
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [smsOffset, setSmsOffset] = useState(0);
  const [smsHasMore, setSmsHasMore] = useState(false);

  const isRTL = language === 'ar' || language === 'he';

  // Fetch template lists for filter dropdowns
  useEffect(() => {
    if (user && isAdmin) {
      api.get<EmailTemplate[]>('/email/templates')
        .then((data) => setTemplates(data || []))
        .catch(() => {});
      api.get<SmsTemplate[]>('/email/sms-templates')
        .then((data) => setSmsTemplates(data || []))
        .catch(() => {});
    }
  }, [user, isAdmin]);

  // ─── Email logs fetch ───

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (templateFilter !== 'all') params.set('templateIdentifier', templateFilter);
      params.set('limit', String(PAGE_SIZE + 1));
      params.set('offset', String(offset));

      const queryString = params.toString();
      const path = `/email/logs${queryString ? `?${queryString}` : ''}`;
      const data = await api.get<EmailLog[]>(path);
      const allResults = data || [];

      if (allResults.length > PAGE_SIZE) {
        setHasMore(true);
        setLogs(allResults.slice(0, PAGE_SIZE));
      } else {
        setHasMore(false);
        setLogs(allResults);
      }
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, templateFilter, offset, toast, t]);

  useEffect(() => {
    if (user && isAdmin) fetchLogs();
  }, [user, isAdmin, fetchLogs]);

  useEffect(() => {
    setOffset(0);
  }, [statusFilter, templateFilter]);

  // ─── SMS logs fetch ───

  const fetchSmsLogs = useCallback(async () => {
    setIsSmsLoading(true);
    try {
      const params = new URLSearchParams();
      if (smsStatusFilter !== 'all') params.set('status', smsStatusFilter);
      if (smsTemplateFilter !== 'all') params.set('templateIdentifier', smsTemplateFilter);
      params.set('limit', String(PAGE_SIZE + 1));
      params.set('offset', String(smsOffset));

      const queryString = params.toString();
      const path = `/email/sms-logs${queryString ? `?${queryString}` : ''}`;
      const data = await api.get<SmsLog[]>(path);
      const allResults = data || [];

      if (allResults.length > PAGE_SIZE) {
        setSmsHasMore(true);
        setSmsLogs(allResults.slice(0, PAGE_SIZE));
      } else {
        setSmsHasMore(false);
        setSmsLogs(allResults);
      }
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSmsLoading(false);
    }
  }, [smsStatusFilter, smsTemplateFilter, smsOffset, toast, t]);

  useEffect(() => {
    if (user && isAdmin) fetchSmsLogs();
  }, [user, isAdmin, fetchSmsLogs]);

  useEffect(() => {
    setSmsOffset(0);
  }, [smsStatusFilter, smsTemplateFilter]);

  // ─── Shared helpers ───

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-green-500 gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('sent')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('failed')}
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="secondary" className="gap-1">
            <SkipForward className="h-3 w-3" />
            {t('skipped')}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getLanguageLabel = (lang: string | null) => {
    switch (lang) {
      case 'ar': return t('arabic');
      case 'en': return t('english');
      case 'he': return t('hebrew');
      default: return '-';
    }
  };

  const emailPage = Math.floor(offset / PAGE_SIZE) + 1;
  const smsPage = Math.floor(smsOffset / PAGE_SIZE) + 1;

  if (isLoading && isSmsLoading) {
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
          {t('emailLogs')}
        </h1>
        <p className="text-muted-foreground">{t('emailLogsDescription')}</p>
      </div>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            {t('emailTemplates')}
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('smsLogs')}
          </TabsTrigger>
        </TabsList>

        {/* ═══ Email Logs Tab ═══ */}
        <TabsContent value="email">
          <Card className="mb-4">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('status')}:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all')}</SelectItem>
                      <SelectItem value="sent">{t('sent')}</SelectItem>
                      <SelectItem value="failed">{t('failed')}</SelectItem>
                      <SelectItem value="skipped">{t('skipped')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('template')}:</span>
                  <Select value={templateFilter} onValueChange={setTemplateFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all')}</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.identifier} value={template.identifier}>
                          {template.identifier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setTemplateFilter('all'); }}>
                  {t('resetFilters')}
                </Button>

                <div className="ms-auto flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{logs.length} {t('entries')}</span>
                  <Button variant="outline" size="sm" onClick={fetchLogs}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('timestamp')}</TableHead>
                    <TableHead>{t('recipientEmail')}</TableHead>
                    <TableHead>{t('template')}</TableHead>
                    <TableHead>{t('preferredLanguage')}</TableHead>
                    <TableHead>{t('languageUsed')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('failureReason')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableEmptyRow colSpan={7} message={t('noLogsFound')} className="py-8" />
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell>{log.recipientEmail}</TableCell>
                        <TableCell className="font-mono text-sm">{log.templateIdentifier}</TableCell>
                        <TableCell>{getLanguageLabel(log.userPreferredLanguage)}</TableCell>
                        <TableCell>{getLanguageLabel(log.languageUsed)}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.failureReason || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <PaginationControls page={emailPage} hasPrevious={offset > 0} hasNext={hasMore} onPrevious={() => setOffset((p) => Math.max(0, p - PAGE_SIZE))} onNext={() => setOffset((p) => p + PAGE_SIZE)} />
        </TabsContent>

        {/* ═══ SMS Logs Tab ═══ */}
        <TabsContent value="sms">
          <Card className="mb-4">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('status')}:</span>
                  <Select value={smsStatusFilter} onValueChange={setSmsStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all')}</SelectItem>
                      <SelectItem value="sent">{t('sent')}</SelectItem>
                      <SelectItem value="failed">{t('failed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('template')}:</span>
                  <Select value={smsTemplateFilter} onValueChange={setSmsTemplateFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all')}</SelectItem>
                      {smsTemplates.map((template) => (
                        <SelectItem key={template.identifier} value={template.identifier}>
                          {template.identifier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="ghost" size="sm" onClick={() => { setSmsStatusFilter('all'); setSmsTemplateFilter('all'); }}>
                  {t('resetFilters')}
                </Button>

                <div className="ms-auto flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{smsLogs.length} {t('entries')}</span>
                  <Button variant="outline" size="sm" onClick={fetchSmsLogs}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('timestamp')}</TableHead>
                    <TableHead>{t('phone')}</TableHead>
                    <TableHead>{t('template')}</TableHead>
                    <TableHead>{t('languageUsed')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('smsMessage')}</TableHead>
                    <TableHead>{t('failureReason')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smsLogs.length === 0 ? (
                    <TableEmptyRow colSpan={7} message={t('noLogsFound')} className="py-8" />
                  ) : (
                    smsLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell dir="ltr" className="font-mono text-sm">{log.recipientPhone}</TableCell>
                        <TableCell className="font-mono text-sm">{log.templateIdentifier || '-'}</TableCell>
                        <TableCell>{getLanguageLabel(log.languageUsed)}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate" title={log.messageSent || ''}>
                          {log.messageSent ? log.messageSent.slice(0, 80) + (log.messageSent.length > 80 ? '...' : '') : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.failureReason || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <PaginationControls page={smsPage} hasPrevious={smsOffset > 0} hasNext={smsHasMore} onPrevious={() => setSmsOffset((p) => Math.max(0, p - PAGE_SIZE))} onNext={() => setSmsOffset((p) => p + PAGE_SIZE)} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailLogs;
