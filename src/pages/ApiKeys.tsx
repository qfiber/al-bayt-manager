import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Key, Copy, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { useRequireAuth } from '@/hooks/use-require-auth';
import { TableEmptyRow } from '@/components/TableEmptyRow';
import { SearchInput } from '@/components/SearchInput';
import { PaginationControls } from '@/components/PaginationControls';
import { usePaginatedSearch } from '@/hooks/use-paginated-search';

interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeys() {
  const { user, isAdmin } = useAuth();
  useRequireAuth('admin');
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    search,
    setSearch: handleSearch,
    page,
    paginated,
    hasPrevious,
    hasNext,
    onPrevious,
    onNext,
  } = usePaginatedSearch<ApiKey>({
    items: apiKeys,
    searchFields: ['name'],
    pageSize: 20,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      fetchApiKeys();
    }
  }, [user, isAdmin]);

  const fetchApiKeys = async () => {
    try {
      const data = await api.get('/api-keys');
      setApiKeys(data || []);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: t('error'),
        description: t('apiKeysEnterName'),
        variant: "destructive",
      });
      return;
    }

    try {
      // Server generates and hashes the key
      const result = await api.post('/api-keys', { name: newKeyName });

      setGeneratedKey(result.key);
      setShowKeyDialog(true);
      setIsDialogOpen(false);
      setNewKeyName("");
      fetchApiKeys();

      toast({
        title: t('success'),
        description: t('apiKeyCreatedSuccess'),
      });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t('success'),
      description: t('copiedToClipboard'),
    });
  };

  const toggleKeyStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.put(`/api-keys/${id}`, { isActive: !currentStatus });
      fetchApiKeys();
      toast({
        title: t('success'),
        description: currentStatus ? t('keyDisabled') : t('keyEnabled'),
      });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm(t('confirmDeleteKey'))) {
      return;
    }

    try {
      await api.delete(`/api-keys/${id}`);
      fetchApiKeys();
      toast({
        title: t('success'),
        description: t('keyDeleted'),
      });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">{t('loading')}...</div>;
  }

  const apiBaseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/v1`;

  return (
    <div className="container mx-auto px-3 py-4 sm:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {t('apiKeys')}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('apiInformation')}</CardTitle>
          <CardDescription>
            {t('apiInformationDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('baseApiUrl')}</Label>
            <div className="flex gap-2 mt-2" dir="ltr">
              <Input value={apiBaseUrl} readOnly className="font-mono text-sm text-left" />
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(apiBaseUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm">{t('availableEndpoints')}</p>
            <div className="bg-muted p-4 rounded-lg space-y-3" dir="ltr">
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/apartments</p>
                <p className="text-xs text-muted-foreground text-left">
                  {t('endpointApartmentsDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/apartments/{'{id}'}</p>
                <p className="text-xs text-muted-foreground text-left">
                  {t('endpointApartmentByIdDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/buildings</p>
                <p className="text-xs text-muted-foreground text-left">
                  {t('endpointBuildingsDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/expenses</p>
                <p className="text-xs text-muted-foreground text-left">
                  {t('endpointExpensesDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/payments</p>
                <p className="text-xs text-muted-foreground text-left">
                  {t('endpointPaymentsDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/users</p>
                <p className="text-xs text-muted-foreground text-left">
                  {t('endpointUsersDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/user-apartments</p>
                <p className="text-xs text-muted-foreground text-left">
                  {t('endpointUserApartmentsDesc')}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm">
              {t('exampleCurlUsage')}
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1 text-left" dir="ltr">
                  {t('allApartmentsExample')}
                </p>
                <code className="block bg-muted p-4 rounded text-sm font-mono text-left" dir="ltr">
                  curl -H "x-api-key: YOUR_API_KEY" {apiBaseUrl}/apartments
                </code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 text-left" dir="ltr">
                  {t('specificApartmentExample')}
                </p>
                <code className="block bg-muted p-4 rounded text-sm font-mono text-left" dir="ltr">
                  curl -H "x-api-key: YOUR_API_KEY" {apiBaseUrl}/apartments/APARTMENT_ID
                </code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle>{t('apiKeys')}</CardTitle>
            <CardDescription>
              {t('manageReadOnlyKeys')}
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <SearchInput value={search} onChange={handleSearch} />
            <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t('createNewKey')}
          </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t('name')}</TableHead>
                <TableHead className="text-start">{t('statusLabel')}</TableHead>
                <TableHead className="text-start">{t('lastUsed')}</TableHead>
                <TableHead className="text-start">{t('created')}</TableHead>
                <TableHead className="text-start">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableEmptyRow colSpan={5} message={t('noApiKeysYet')} />
              ) : (
                paginated.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium text-start">{key.name}</TableCell>
                    <TableCell className="text-start">
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? t('activeStatus') : t('disabledStatus')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-start">
                      {key.lastUsedAt
                        ? formatDateTime(key.lastUsedAt)
                        : t('neverUsed')}
                    </TableCell>
                    <TableCell className="text-start">
                      {formatDateTime(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-start">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleKeyStatus(key.id, key.isActive)}
                        >
                          {key.isActive ? t('disableKey') : t('enableKey')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationControls
            page={page}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('createNewApiKey')}
            </DialogTitle>
            <DialogDescription>
              {t('enterDescriptiveName')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="keyName">
                {t('keyName')}
              </Label>
              <Input
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t('keyNamePlaceholder')}
              />
            </div>
            <Button onClick={generateApiKey} className="w-full">
              <Key className="h-4 w-4 me-2" />
              {t('generateKey')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('yourApiKey')}
            </DialogTitle>
            <DialogDescription>
              {t('saveKeyNow')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <code className="text-sm break-all">{generatedKey}</code>
            </div>
            <Button
              onClick={() => copyToClipboard(generatedKey!)}
              className="w-full"
              variant="outline"
            >
              <Copy className="h-4 w-4 me-2" />
              {t('copyKey')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
