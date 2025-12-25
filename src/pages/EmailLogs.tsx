import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, CheckCircle, XCircle, SkipForward, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface EmailLog {
  id: string;
  created_at: string;
  user_id: string | null;
  recipient_email: string;
  template_identifier: string;
  user_preferred_language: string | null;
  language_used: string | null;
  subject_sent: string | null;
  status: 'sent' | 'failed' | 'skipped';
  failure_reason: string | null;
  metadata: any;
}

const EmailLogs = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [templates, setTemplates] = useState<string[]>([]);

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
      fetchLogs();
    }
  }, [user, isAdmin, statusFilter, templateFilter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (templateFilter !== 'all') {
        query = query.eq('template_identifier', templateFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs((data || []) as EmailLog[]);

      // Get unique templates for filter
      const uniqueTemplates = [...new Set(data?.map(l => l.template_identifier) || [])];
      setTemplates(uniqueTemplates);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

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
      case 'ar':
        return t('arabic');
      case 'en':
        return t('english');
      case 'he':
        return t('hebrew');
      default:
        return '-';
    }
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setTemplateFilter('all');
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
            {t('emailLogs')}
          </h1>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            {t('backToDashboard')}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">{t('emailLogsDescription')}</p>
          <Button variant="outline" onClick={fetchLogs}>
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
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
                    <SelectItem key={template} value={template}>
                      {template}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="sm" onClick={resetFilters}>
              {t('resetFilters')}
            </Button>

            <div className="ml-auto text-sm text-muted-foreground">
              {logs.length} {t('entries')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
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
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('noLogsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    <TableCell>{log.recipient_email}</TableCell>
                    <TableCell className="font-mono text-sm">{log.template_identifier}</TableCell>
                    <TableCell>{getLanguageLabel(log.user_preferred_language)}</TableCell>
                    <TableCell>{getLanguageLabel(log.language_used)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.failure_reason || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailLogs;
