import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  action_type: string;
  table_name: string | null;
  record_id: string | null;
  action_details: any;
  ip_address: string | null;
  user_agent: string | null;
}

const AuditLogs = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !isModerator))) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, isModerator, loading, navigate]);

  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchAuditLogs();
    }
  }, [user, isAdmin, isModerator]);

  useEffect(() => {
    applyFilters();
  }, [logs, actionFilter, tableFilter, searchTerm]);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      setLogs(data);
    }
    setIsLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...logs];

    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action_type === actionFilter);
    }

    if (tableFilter !== 'all') {
      filtered = filtered.filter(log => log.table_name === tableFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.user_email?.toLowerCase().includes(search) ||
        log.action_type?.toLowerCase().includes(search) ||
        log.table_name?.toLowerCase().includes(search) ||
        JSON.stringify(log.action_details).toLowerCase().includes(search)
      );
    }

    setFilteredLogs(filtered);
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return 'bg-green-500';
      case 'update':
        return 'bg-yellow-500';
      case 'delete':
        return 'bg-red-500';
      case 'login':
      case 'logout':
      case 'signup':
        return 'bg-blue-500';
      case 'role_change':
      case 'password_change':
        return 'bg-purple-500';
      case 'api_key_created':
      case 'api_key_deleted':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const uniqueActions = Array.from(new Set(logs.map(log => log.action_type)));
  const uniqueTables = Array.from(new Set(logs.map(log => log.table_name).filter(Boolean)));

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  if (!user || (!isAdmin && !isModerator)) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('auditLogs')}</h1>
            <p className="text-muted-foreground mt-1">{t('auditLogsDescription')}</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full sm:w-auto">
            {t('backToDashboard')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t('activityLog')}</span>
              <Badge variant="secondary">{filteredLogs.length} {t('entries')}</Badge>
            </CardTitle>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('filterByAction')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allActions')}</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t('filterByTable')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allTables')}</SelectItem>
                  {uniqueTables.map(table => (
                    <SelectItem key={table} value={table || ''}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setActionFilter('all');
                  setTableFilter('all');
                  setSearchTerm('');
                }}
              >
                <Filter className="mr-2 h-4 w-4" />
                {t('resetFilters')}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className={`whitespace-nowrap ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>{t('timestamp')}</TableHead>
                    <TableHead className={`whitespace-nowrap ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>{t('user')}</TableHead>
                    <TableHead className={`whitespace-nowrap ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>Action Type</TableHead>
                    <TableHead className={`whitespace-nowrap ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>{t('table')}</TableHead>
                    <TableHead className={`whitespace-nowrap ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t('noLogsFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className={`font-mono text-sm ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                          {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell className={language === 'ar' || language === 'he' ? 'text-right' : ''}>
                          <div className="flex flex-col">
                            <span className="font-medium">{log.user_email || t('system')}</span>
                            {log.ip_address && (
                              <span className="text-xs text-muted-foreground">{log.ip_address}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={language === 'ar' || language === 'he' ? 'text-right' : ''}>
                          <Badge className={getActionColor(log.action_type)}>
                            {log.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className={language === 'ar' || language === 'he' ? 'text-right' : ''}>
                          <code className="text-sm">{log.table_name || '-'}</code>
                        </TableCell>
                        <TableCell className={language === 'ar' || language === 'he' ? 'text-right' : ''}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                          >
                            {t('viewDetails')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('auditLogDetails')}</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4 pr-4">
                  <div>
                    <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {t('timestamp')}
                    </h4>
                    <p className={`text-sm font-mono ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {format(new Date(selectedLog.created_at), 'PPpp')}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {t('user')}
                    </h4>
                    <p className={`text-sm ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {selectedLog.user_email || t('system')}
                    </p>
                  </div>

                  <div>
                    <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {t('actions')}
                    </h4>
                    <Badge className={getActionColor(selectedLog.action_type)}>
                      {selectedLog.action_type}
                    </Badge>
                  </div>

                  {selectedLog.table_name && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('table')}
                      </h4>
                      <code className={`text-sm ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.table_name}
                      </code>
                    </div>
                  )}

                  {selectedLog.record_id && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('recordId')}
                      </h4>
                      <code className={`text-sm font-mono ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.record_id}
                      </code>
                    </div>
                  )}

                  {selectedLog.ip_address && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('ipAddress')}
                      </h4>
                      <code className={`text-sm font-mono ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.ip_address}
                      </code>
                    </div>
                  )}

                  {selectedLog.user_agent && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('userAgent')}
                      </h4>
                      <p className={`text-sm text-muted-foreground break-all ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.user_agent}
                      </p>
                    </div>
                  )}

                  {selectedLog.action_details && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('actionDetails')}
                      </h4>
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto text-left" dir="ltr">
                        {JSON.stringify(selectedLog.action_details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AuditLogs;
