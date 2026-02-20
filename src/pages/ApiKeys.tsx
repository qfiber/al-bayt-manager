import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeys() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, loading, navigate]);

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
        description: language === 'ar' ? 'الرجاء إدخال اسم للمفتاح' : 'Please enter a name for the key',
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
        description: language === 'ar' ? 'تم إنشاء مفتاح API بنجاح' : 'API key created successfully',
      });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t('success'),
      description: language === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard',
    });
  };

  const toggleKeyStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.put(`/api-keys/${id}`, { isActive: !currentStatus });
      fetchApiKeys();
      toast({
        title: t('success'),
        description: language === 'ar'
          ? (currentStatus ? 'تم تعطيل المفتاح' : 'تم تفعيل المفتاح')
          : (currentStatus ? 'Key disabled' : 'Key enabled'),
      });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المفتاح؟' : 'Are you sure you want to delete this key?')) {
      return;
    }

    try {
      await api.delete(`/api-keys/${id}`);
      fetchApiKeys();
      toast({
        title: t('success'),
        description: language === 'ar' ? 'تم حذف المفتاح' : 'Key deleted',
      });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">{t('loading')}...</div>;
  }

  if (!user || !isAdmin) return null;

  const apiBaseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/v1`;

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {language === 'ar' ? 'مفاتيح API' : 'API Keys'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'معلومات API' : 'API Information'}</CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'استخدم مفاتيح API للوصول إلى البيانات من التطبيقات الخارجية'
              : 'Use API keys to access data from external applications'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{language === 'ar' ? 'عنوان API الأساسي' : 'Base API URL'}</Label>
            <div className="flex gap-2 mt-2" dir="ltr">
              <Input value={apiBaseUrl} readOnly className="font-mono text-sm text-left" />
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(apiBaseUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm">{language === 'ar' ? 'نقاط النهاية المتاحة:' : 'Available Endpoints:'}</p>
            <div className="bg-muted p-4 rounded-lg space-y-3" dir="ltr">
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/apartments</p>
                <p className="text-xs text-muted-foreground text-left">
                  {language === 'ar'
                    ? 'جميع الشقق مع اسم المستخدم ورقم الهاتف والرصيد الإجمالي'
                    : 'All apartments with user name, phone, and total credit'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/apartments/{'{id}'}</p>
                <p className="text-xs text-muted-foreground text-left">
                  {language === 'ar'
                    ? 'شقة محددة مع أشهر الإشغال، الديون الإجمالية، وتفاصيل الديون لكل شهر'
                    : 'Specific apartment with months occupied, total debt, and month-by-month debt details'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/buildings</p>
                <p className="text-xs text-muted-foreground text-left">
                  {language === 'ar' ? 'جميع المباني' : 'All buildings'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/expenses</p>
                <p className="text-xs text-muted-foreground text-left">
                  {language === 'ar' ? 'جميع المصروفات مع معلومات المبنى' : 'All expenses with building information'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/payments</p>
                <p className="text-xs text-muted-foreground text-left">
                  {language === 'ar' ? 'جميع الدفعات مع معلومات الشقة' : 'All payments with apartment information'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/users</p>
                <p className="text-xs text-muted-foreground text-left">
                  {language === 'ar' ? 'جميع ملفات المستخدمين' : 'All user profiles'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-left">/user-apartments</p>
                <p className="text-xs text-muted-foreground text-left">
                  {language === 'ar' ? 'تعيينات الشقق للمستخدمين' : 'User apartment assignments'}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm">
              {language === 'ar' ? 'أمثلة على استخدام curl:' : 'Example curl usage:'}
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1 text-left" dir="ltr">
                  {language === 'ar' ? 'جميع الشقق:' : 'All apartments:'}
                </p>
                <code className="block bg-muted p-4 rounded text-sm font-mono text-left" dir="ltr">
                  curl -H "x-api-key: YOUR_API_KEY" {apiBaseUrl}/apartments
                </code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 text-left" dir="ltr">
                  {language === 'ar' ? 'شقة محددة:' : 'Specific apartment:'}
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
            <CardTitle>{language === 'ar' ? 'مفاتيح API' : 'API Keys'}</CardTitle>
            <CardDescription>
              {language === 'ar' ? 'إدارة مفاتيح الوصول للقراءة فقط' : 'Manage read-only access keys'}
            </CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'إنشاء مفتاح جديد' : 'Create New Key'}
          </Button>
        </CardHeader>
        <CardContent>
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                <TableHead className="text-right">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-right">{language === 'ar' ? 'آخر استخدام' : 'Last Used'}</TableHead>
                <TableHead className="text-right">{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                <TableHead className="text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {language === 'ar' ? 'لا توجد مفاتيح API' : 'No API keys yet'}
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium text-right">{key.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive
                          ? (language === 'ar' ? 'نشط' : 'Active')
                          : (language === 'ar' ? 'معطل' : 'Disabled')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {key.lastUsedAt
                        ? formatDateTime(key.lastUsedAt)
                        : (language === 'ar' ? 'لم يستخدم' : 'Never')}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDateTime(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleKeyStatus(key.id, key.isActive)}
                        >
                          {key.isActive
                            ? (language === 'ar' ? 'تعطيل' : 'Disable')
                            : (language === 'ar' ? 'تفعيل' : 'Enable')}
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
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'إنشاء مفتاح API جديد' : 'Create New API Key'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar'
                ? 'أدخل اسماً وصفياً لهذا المفتاح'
                : 'Enter a descriptive name for this key'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="keyName">
                {language === 'ar' ? 'اسم المفتاح' : 'Key Name'}
              </Label>
              <Input
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={language === 'ar' ? 'مثال: مفتاح n8n' : 'e.g., n8n Integration'}
              />
            </div>
            <Button onClick={generateApiKey} className="w-full">
              <Key className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إنشاء المفتاح' : 'Generate Key'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'مفتاح API الخاص بك' : 'Your API Key'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar'
                ? 'احفظ هذا المفتاح الآن. لن تتمكن من رؤيته مرة أخرى!'
                : 'Save this key now. You will not be able to see it again!'}
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
              <Copy className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'نسخ المفتاح' : 'Copy Key'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
