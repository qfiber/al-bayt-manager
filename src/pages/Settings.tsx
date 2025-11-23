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
import { Settings as SettingsIcon, Save, DollarSign, Globe, Upload, Shield } from 'lucide-react';

interface SettingsData {
  id: string;
  monthly_fee: number;
  system_language: string;
  logo_url: string | null;
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
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);
  const [has2FA, setHas2FA] = useState(false);
  const [checking2FA, setChecking2FA] = useState(true);

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

  useEffect(() => {
    if (user) {
      check2FAStatus();
    }
  }, [user]);

  const check2FAStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.totp && factors.totp.length > 0) {
        setHas2FA(true);
      } else {
        setHas2FA(false);
      }
    } catch (error) {
      console.error('Error checking 2FA status:', error);
      setHas2FA(false);
    } finally {
      setChecking2FA(false);
    }
  };

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

    // Fetch branding logo
    const { data: brandingData } = await supabase
      .from('public_branding')
      .select('logo_url')
      .maybeSingle();
    
    if (brandingData?.logo_url) {
      setBrandingLogoUrl(brandingData.logo_url);
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

      // Update settings (monthly fee and language only)
      const settingsUpdateData = {
        monthly_fee: parseFloat(monthlyFee),
        system_language: systemLanguage,
      };

      const { error: settingsError } = await supabase
        .from('settings')
        .update(settingsUpdateData)
        .eq('id', settings.id);

      if (settingsError) throw settingsError;

      // Update public_branding if logo changed
      if (logoUrl) {
        // Check if branding record exists
        const { data: existingBranding } = await supabase
          .from('public_branding')
          .select('id')
          .maybeSingle();

        if (existingBranding) {
          // Update existing record
          const { error: brandingError } = await supabase
            .from('public_branding')
            .update({ logo_url: logoUrl })
            .eq('id', existingBranding.id);

          if (brandingError) throw brandingError;
        } else {
          // Insert new record
          const { error: brandingError } = await supabase
            .from('public_branding')
            .insert({ logo_url: logoUrl, company_name: 'qFiber LTD' });

          if (brandingError) throw brandingError;
        }
      }

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
                  <div className="mt-2 border rounded-lg p-4 bg-muted/20 flex items-center justify-center">
                    <img src={logoFile.preview} alt={t('logoPreview')} className="max-w-xs max-h-32 object-contain" />
                  </div>
                )}
                {!logoFile.preview && brandingLogoUrl && (
                  <div className="mt-2">
                    <Label className="text-muted-foreground">{t('currentLogo')}</Label>
                    <div className="mt-2 border rounded-lg p-4 bg-muted/20 flex items-center justify-center">
                      <img src={brandingLogoUrl} alt={t('currentLogo')} className="max-w-xs max-h-32 object-contain" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                {t('security')}
              </CardTitle>
              <CardDescription>
                {t('manageSecuritySettings')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">{t('twoFactorAuthentication')}</Label>
                    {!checking2FA && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${has2FA ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}>
                        {has2FA ? t('enabled') : t('disabled')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('addExtraSecurityWithAuthApp')}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/setup-2fa')}
                  disabled={checking2FA}
                >
                  {checking2FA ? t('loading') : t('manage')}
                </Button>
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
