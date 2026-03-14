import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { usePaginatedSearch } from '@/hooks/use-paginated-search';
import { useToast } from '@/hooks/use-toast';
import { Users, LogIn } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Landlord {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  organizationId: string;
  organizationName: string;
  organizationSubdomain: string | null;
  memberSince: string;
}

const Landlords = () => {
  useRequireAuth('admin');
  const { user, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [landlords, setLandlords] = useState<Landlord[]>([]);

  const { search, setSearch, paginated, page, hasPrevious, hasNext, onPrevious, onNext } = usePaginatedSearch({
    items: landlords,
    searchFields: ['name', 'email', 'organizationName'] as (keyof Landlord)[],
  });

  useEffect(() => {
    if (user && isSuperAdmin) {
      api.get<Landlord[]>('/super-admin/landlords')
        .then(data => setLandlords(data || []))
        .catch(() => {});
    }
  }, [user, isSuperAdmin]);

  const handleImpersonate = async (userId: string) => {
    try {
      await api.post(`/organizations/impersonate/${userId}`);
      window.location.href = '/dashboard';
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  if (!user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('landlords')}</h1>
          </div>
          <SearchInput value={search} onChange={setSearch} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('allLandlords')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t('nameLabel')}</TableHead>
                  <TableHead className="text-start">{t('email')}</TableHead>
                  <TableHead className="text-start">{t('phone')}</TableHead>
                  <TableHead className="text-start">{t('organizationName')}</TableHead>
                  <TableHead className="text-start">{t('subdomain')}</TableHead>
                  <TableHead className="text-start">{t('date')}</TableHead>
                  <TableHead className="text-start">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableEmptyRow colSpan={7} message={t('noLandlordsFound')} />
                ) : (
                  paginated.map((landlord) => (
                    <TableRow key={`${landlord.userId}-${landlord.organizationId}`}>
                      <TableCell className="font-medium">{landlord.name || '-'}</TableCell>
                      <TableCell>{landlord.email}</TableCell>
                      <TableCell>{landlord.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{landlord.organizationName}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{landlord.organizationSubdomain || '-'}</TableCell>
                      <TableCell>{formatDate(landlord.memberSince)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleImpersonate(landlord.userId)} title={t('loginAs')}>
                          <LogIn className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls page={page} hasPrevious={hasPrevious} hasNext={hasNext} onPrevious={onPrevious} onNext={onNext} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Landlords;
