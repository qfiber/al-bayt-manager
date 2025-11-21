import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Save, DollarSign, Globe, Upload } from 'lucide-react';

interface SettingsData {
  id: string;
  monthly_fee: number;
  system_language: string;
}

interface LogoFile {
  file: File | null;
  preview: string | null;
}

const Settings = () => {
  const { user, isAdmin, loading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [monthlyFee, setMonthlyFee] = useState('');
  const [systemLanguage, setSystemLanguage] = useState('ar');
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<LogoFile>({ file: null, preview: null });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchSettings();
    }
  }, [user, isAdmin]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .maybeSingle();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    if (data) {
      setSettings(data);
      setMonthlyFee(data.monthly_fee.toString());
      setSystemLanguage(data.system_language);
    } else {
      // Create initial settings if none exist
      const { data: newSettings, error: createError } = await supabase
        .from('settings')
        .insert([{ monthly_fee: 0, system_language: 'ar' }])
        .select()
        .single();

      if (createError) {
        toast({ title: 'Error', description: createError.message, variant: 'destructive' });
      } else {
        setSettings(newSettings);
        setMonthlyFee('0');
        setSystemLanguage('ar');
      }
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile({
        file,
        preview: URL.createObjectURL(file),
      });
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile.file || !user) return null;

    const fileExt = logoFile.file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, logoFile.file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!settings) {
      toast({ title: 'Error', description: 'Settings not loaded', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      let logoUrl = null;
      if (logoFile.file) {
        logoUrl = await uploadLogo();
      }

      const updateData: any = {
        monthly_fee: parseFloat(monthlyFee),
        system_language: systemLanguage,
      };

      const { error } = await supabase
        .from('settings')
        .update(updateData)
        .eq('id', settings.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Settings updated successfully' });
      
      // Update the app language if it changed
      if (systemLanguage !== language) {
        setLanguage(systemLanguage as 'ar' | 'en');
      }
      
      fetchSettings();
      setLogoFile({ file: null, preview: null });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('settings')}</h1>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            {t('backToDashboard')}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Financial Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t('financialSettings')}
              </CardTitle>
              <CardDescription>
                {t('financialSettingsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="monthly_fee">{t('defaultMonthlyFee')}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      ₪
                    </span>
                    <Input
                      id="monthly_fee"
                      type="number"
                      step="0.01"
                      value={monthlyFee}
                      onChange={(e) => setMonthlyFee(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('defaultMonthlyFeeDesc')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t('languageLocalization')}
              </CardTitle>
              <CardDescription>
                {t('languageLocalizationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="system_language">{t('systemLanguage')}</Label>
                <Select value={systemLanguage} onValueChange={setSystemLanguage}>
                  <SelectTrigger id="system_language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t('arabic')} (العربية)</SelectItem>
                    <SelectItem value="en">{t('english')} (English)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {t('systemLanguageDesc')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                {t('systemLogo')}
              </CardTitle>
              <CardDescription>
                {t('systemLogoDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo">{t('uploadLogo')}</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
                {logoFile.preview && (
                  <div className="mt-2">
                    <img src={logoFile.preview} alt={t('logoPreview')} className="w-32 h-32 object-cover rounded" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('systemInformation')}</CardTitle>
              <CardDescription>
                {t('systemInfoDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t('settingsId')}</Label>
                  <p className="text-sm font-mono mt-1">{settings?.id || t('loading')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('currentLanguage')}</Label>
                  <p className="text-sm mt-1">{language === 'ar' ? t('arabic') : t('english')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (settings) {
                  setMonthlyFee(settings.monthly_fee.toString());
                  setSystemLanguage(settings.system_language);
                }
              }}
              disabled={isSaving}
            >
              {t('resetChanges')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? t('saving') : t('saveSettings')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
