import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
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
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  actionType: string;
  tableName: string | null;
  recordId: string | null;
  actionDetails: any;
  ipAddress: string | null;
  userAgent: string | null;
}

const ACTION_TYPES = [
  'login',
  'logout',
  'signup',
  'create',
  'update',
  'delete',
  'role_change',
  'password_change',
  'api_key_created',
  'api_key_deleted',
] as const;

const PAGE_SIZE = 50;

const AuditLogs = () => {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Server-side filters
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Client-side filters
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!loading && (!user || (!isAdmin && !isModerator))) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, isModerator, loading, navigate]);

  const fetchAuditLogs = useCallback(async (currentPage: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== 'all') params.set('actionType', actionFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(currentPage * PAGE_SIZE));

      const queryString = params.toString();
      const path = `/audit-logs${queryString ? `?${queryString}` : ''}`;
      const data = await api.get<AuditLog[]>(path);
      const results = data || [];
      setLogs(results);
      setHasMore(results.length === PAGE_SIZE);
    } catch {
      setLogs([]);
      setHasMore(false);
    }
    setIsLoading(false);
  }, [actionFilter, startDate, endDate]);

  // Fetch when server-side filters or page change
  useEffect(() => {
    if (user && (isAdmin || isModerator)) {
      fetchAuditLogs(page);
    }
  }, [user, isAdmin, isModerator, page, fetchAuditLogs]);

  // Reset to page 0 when server-side filters change
  useEffect(() => {
    setPage(0);
  }, [actionFilter, startDate, endDate]);

  // Apply client-side filters
  useEffect(() => {
    let filtered = [...logs];

    if (tableFilter !== 'all') {
      filtered = filtered.filter(log => log.tableName === tableFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.userEmail?.toLowerCase().includes(search) ||
        log.actionType?.toLowerCase().includes(search) ||
        log.tableName?.toLowerCase().includes(search) ||
        JSON.stringify(log.actionDetails).toLowerCase().includes(search)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, tableFilter, searchTerm]);

  // Derive unique tables from current page of results for client-side filter
  const uniqueTables = Array.from(new Set(logs.map(log => log.tableName).filter(Boolean)));

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

  const handleActionFilterChange = (value: string) => {
    setActionFilter(value);
  };

  const handleResetFilters = () => {
    setActionFilter('all');
    setTableFilter('all');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

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
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('auditLogs')}</h1>
            <p className="text-muted-foreground mt-1">{t('auditLogsDescription')}</p>
          </div>
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

              <Select value={actionFilter} onValueChange={handleActionFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('filterByAction')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allActions')}</SelectItem>
                  {ACTION_TYPES.map(action => (
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
                onClick={handleResetFilters}
              >
                <Filter className="mr-2 h-4 w-4" />
                {t('resetFilters')}
              </Button>
            </div>

            {/* Date filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder={t('startDate')}
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder={t('endDate')}
              />
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
                          {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell className={language === 'ar' || language === 'he' ? 'text-right' : ''}>
                          <div className="flex flex-col">
                            <span className="font-medium">{log.userEmail || t('system')}</span>
                            {log.ipAddress && (
                              <span className="text-xs text-muted-foreground">{log.ipAddress}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={language === 'ar' || language === 'he' ? 'text-right' : ''}>
                          <Badge className={getActionColor(log.actionType)}>
                            {log.actionType}
                          </Badge>
                        </TableCell>
                        <TableCell className={language === 'ar' || language === 'he' ? 'text-right' : ''}>
                          <code className="text-sm">{log.tableName || '-'}</code>
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

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                {t('previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('page')} {page + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage(p => p + 1)}
              >
                {t('next')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl w-[95vw]">
            <DialogHeader>
              <DialogTitle>{t('auditLogDetails')}</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]" dir="ltr">
                <div className="space-y-4 pe-6 ps-2" dir={language === 'ar' || language === 'he' ? 'rtl' : 'ltr'}>
                  <div>
                    <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {t('timestamp')}
                    </h4>
                    <p className={`text-sm font-mono ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {format(new Date(selectedLog.createdAt), 'PPpp')}
                    </p>
                  </div>

                  <div>
                    <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {t('user')}
                    </h4>
                    <p className={`text-sm ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {selectedLog.userEmail || t('system')}
                    </p>
                  </div>

                  <div>
                    <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                      {t('actions')}
                    </h4>
                    <Badge className={getActionColor(selectedLog.actionType)}>
                      {selectedLog.actionType}
                    </Badge>
                  </div>

                  {selectedLog.tableName && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('table')}
                      </h4>
                      <code className={`text-sm ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.tableName}
                      </code>
                    </div>
                  )}

                  {selectedLog.recordId && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('recordId')}
                      </h4>
                      <code className={`text-sm font-mono ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.recordId}
                      </code>
                    </div>
                  )}

                  {selectedLog.ipAddress && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('ipAddress')}
                      </h4>
                      <code className={`text-sm font-mono ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.ipAddress}
                      </code>
                    </div>
                  )}

                  {selectedLog.userAgent && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('userAgent')}
                      </h4>
                      <p className={`text-sm text-muted-foreground break-all ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {selectedLog.userAgent}
                      </p>
                    </div>
                  )}

                  {selectedLog.actionDetails && (
                    <div>
                      <h4 className={`font-semibold mb-2 ${language === 'ar' || language === 'he' ? 'text-right' : ''}`}>
                        {t('actionDetails')}
                      </h4>
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto text-left" dir="ltr">
                        {JSON.stringify(selectedLog.actionDetails, null, 2)}
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
