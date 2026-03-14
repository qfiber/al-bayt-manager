import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useBuildings } from '@/hooks/use-buildings';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { downloadCsv } from '@/lib/csv-export';
import { BarChart3, Play, Save, Download, Trash2, FolderOpen } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const DATA_SOURCES = [
  { value: 'payments', label: 'payments' },
  { value: 'expenses', label: 'expenses' },
  { value: 'apartments', label: 'apartments' },
  { value: 'leases', label: 'leases' },
];

const GROUP_OPTIONS = [
  { value: '', label: 'none' },
  { value: 'building', label: 'building' },
  { value: 'month', label: 'month' },
  { value: 'category', label: 'category' },
  { value: 'status', label: 'status' },
];

const ReportBuilder = () => {
  useRequireAuth('admin-or-moderator');
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { buildings } = useBuildings(!!user);
  const { toast } = useToast();

  // Config state
  const [dataSource, setDataSource] = useState('payments');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [status, setStatus] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState('100');

  // Results state
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'table' | 'bar' | 'pie'>('table');

  // Saved reports
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reportName, setReportName] = useState('');
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      api.get('/custom-reports/saved').then(setSavedReports).catch(() => {});
    }
  }, [user]);

  const buildConfig = () => ({
    dataSource,
    filters: {
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(buildingId ? { buildingId } : {}),
      ...(status ? { status } : {}),
      ...(minAmount ? { minAmount: parseFloat(minAmount) } : {}),
      ...(maxAmount ? { maxAmount: parseFloat(maxAmount) } : {}),
    },
    ...(groupBy ? { groupBy } : {}),
    ...(sortBy ? { sortBy, sortOrder } : {}),
    limit: parseInt(limit) || 100,
  });

  const executeReport = async () => {
    setLoading(true);
    try {
      const result = await api.post('/custom-reports/execute', buildConfig());
      setResults(result);
      if (result.rows.length > 0 && groupBy) setChartType('bar');
      else setChartType('table');
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!reportName.trim()) return;
    try {
      await api.post('/custom-reports/save', { name: reportName, config: buildConfig() });
      toast({ title: t('success'), description: t('reportSaved') });
      setSaveDialogOpen(false);
      setReportName('');
      api.get('/custom-reports/saved').then(setSavedReports).catch(() => {});
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const loadReport = (report: any) => {
    const config = report.config;
    setDataSource(config.dataSource || 'payments');
    setDateFrom(config.filters?.dateFrom || '');
    setDateTo(config.filters?.dateTo || '');
    setBuildingId(config.filters?.buildingId || '');
    setStatus(config.filters?.status || '');
    setMinAmount(config.filters?.minAmount ? String(config.filters.minAmount) : '');
    setMaxAmount(config.filters?.maxAmount ? String(config.filters.maxAmount) : '');
    setGroupBy(config.groupBy || '');
    setSortBy(config.sortBy || '');
    setSortOrder(config.sortOrder || 'desc');
    setLimit(String(config.limit || 100));
    setLoadDialogOpen(false);
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await api.delete(`/custom-reports/saved/${id}`);
      setSavedReports(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  const handleExport = () => {
    if (!results?.rows?.length) return;
    const headers = results.columns;
    const rows = results.rows.map((r: any) => headers.map((h: string) => String(r[h] ?? '')));
    downloadCsv('custom-report.csv', headers, rows);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('reportBuilder')}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLoadDialogOpen(true)}>
              <FolderOpen className="w-4 h-4 me-2" />
              {t('loadReport')}
            </Button>
            <Button variant="outline" onClick={() => setSaveDialogOpen(true)} disabled={!results}>
              <Save className="w-4 h-4 me-2" />
              {t('saveReport')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Config Panel */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('reportConfig')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">{t('dataSource')}</Label>
                <Select value={dataSource} onValueChange={setDataSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCES.map(ds => (
                      <SelectItem key={ds.value} value={ds.value}>{t(ds.label as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">{t('building')}</Label>
                <Select value={buildingId || 'all'} onValueChange={v => setBuildingId(v === 'all' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allBuildings')}</SelectItem>
                    {buildings.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('from')}</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{t('to')}</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t('minAmount')}</Label>
                  <Input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs">{t('maxAmount')}</Label>
                  <Input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="∞" />
                </div>
              </div>

              <div>
                <Label className="text-xs">{t('groupBy')}</Label>
                <Select value={groupBy || 'none'} onValueChange={v => setGroupBy(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map(g => (
                      <SelectItem key={g.value || 'none'} value={g.value || 'none'}>{t(g.label as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">{t('limit')}</Label>
                <Input type="number" value={limit} onChange={e => setLimit(e.target.value)} min="1" max="1000" />
              </div>

              <Button onClick={executeReport} disabled={loading} className="w-full gap-2">
                <Play className="w-4 h-4" />
                {loading ? t('loading') : t('runReport')}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">
                {t('results')} {results ? `(${results.rowCount} ${t('rows')})` : ''}
              </CardTitle>
              <div className="flex gap-2">
                {results && groupBy && (
                  <>
                    <Button variant={chartType === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setChartType('table')}>{t('tableView')}</Button>
                    <Button variant={chartType === 'bar' ? 'default' : 'ghost'} size="sm" onClick={() => setChartType('bar')}>{t('barChart')}</Button>
                    <Button variant={chartType === 'pie' ? 'default' : 'ghost'} size="sm" onClick={() => setChartType('pie')}>{t('pieChart')}</Button>
                  </>
                )}
                {results?.rows?.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="w-4 h-4 me-1" />
                    CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!results ? (
                <div className="text-center py-16 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('configureAndRun')}</p>
                </div>
              ) : results.rows.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">{t('noData')}</div>
              ) : chartType === 'bar' && groupBy ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={results.rows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group_key" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => formatCurrency(parseFloat(value))} />
                    <Bar dataKey="total_amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : chartType === 'pie' && groupBy ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie data={results.rows} dataKey="total_amount" nameKey="group_key" cx="50%" cy="50%" outerRadius={150} label>
                      {results.rows.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(parseFloat(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {results.columns.map((col: string) => (
                          <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.rows.map((row: any, i: number) => (
                        <TableRow key={i}>
                          {results.columns.map((col: string) => (
                            <TableCell key={col} className="text-sm whitespace-nowrap">
                              {row[col] != null ? String(row[col]) : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Save Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('saveReport')}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t('reportName')}</Label>
                <Input value={reportName} onChange={e => setReportName(e.target.value)} placeholder={t('reportNamePlaceholder')} />
              </div>
              <Button onClick={handleSave} disabled={!reportName.trim()} className="w-full">{t('save')}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Load Dialog */}
        <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('savedReports')}</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {savedReports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('noSavedReports')}</p>
              ) : (
                savedReports.map(report => (
                  <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <button onClick={() => loadReport(report)} className="text-sm font-medium text-start flex-1">{report.name}</button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSaved(report.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ReportBuilder;
