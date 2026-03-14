import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Calendar, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const MyInspections = () => {
  useRequireAuth();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      api.get('/my-apartments/inspections')
        .then(setInspections)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex items-center gap-3 mb-8">
          <ClipboardCheck className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">{t('myInspections')}</h1>
        </div>

        {inspections.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{t('noUpcomingInspections')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {inspections.map((item: any) => {
              const insp = item.inspection;
              const typeLabels: Record<string, string> = {
                inspection: t('typeInspection'),
                maintenance: t('typeMaintenance'),
                visit: t('typeVisit'),
              };
              return (
                <Card key={insp.id}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{insp.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.buildingName}{item.apartmentNumber ? ` — ${t('apartment')} ${item.apartmentNumber}` : ` — ${t('entireBuilding')}`}
                        </p>
                        {insp.description && <p className="text-sm">{insp.description}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline">{typeLabels[insp.type] || insp.type}</Badge>
                          <span className="text-sm">
                            <Calendar className="w-3.5 h-3.5 inline me-1" />
                            {new Date(insp.scheduledAt).toLocaleDateString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}
                          </span>
                          {insp.duration && <span className="text-xs text-muted-foreground">{insp.duration} {t('durationMinutes')}</span>}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => window.open(`/api/inspections/${insp.id}/calendar`)}>
                        <Download className="w-4 h-4 me-2" />
                        {t('downloadCalendar')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyInspections;
