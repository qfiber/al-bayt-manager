import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, Save, Globe, Upload, Shield, Mail } from 'lucide-react';

interface SettingsData {
  id: string;
  systemLanguage: string;
  logoUrl: string | null;
  turnstileEnabled: boolean;
  turnstileSiteKey: string | null;
  turnstileSecretKey: string | null;
  smtpEnabled: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  resendApiKey: string | null;
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
  const [systemLanguage, setSystemLanguage] = useState('ar');
  const [isSaving, setIsSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<LogoFile>({ file: null, preview: null });
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);
  const [has2FA, setHas2FA] = useState(false);
  const [checking2FA, setChecking2FA] = useState(true);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileSecretKey, setTurnstileSecretKey] = useState('');
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');

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
      const factors = await api.get<{ id: string; friendlyName: string; status: string }[]>('/auth/2fa/factors');
      if (factors && factors.length > 0) {
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
    try {
      const data = await api.get<SettingsData>('/settings');

      if (data) {
        setSettings(data);
        setSystemLanguage(data.systemLanguage);
        setTurnstileEnabled(data.turnstileEnabled || false);
        setTurnstileSiteKey(data.turnstileSiteKey || '');
        setTurnstileSecretKey(data.turnstileSecretKey || '');
        setSmtpEnabled(data.smtpEnabled || false);
        setSmtpFromEmail(data.smtpFromEmail || '');
        setSmtpFromName(data.smtpFromName || '');
        setResendApiKey(data.resendApiKey || '');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Fetch branding logo
    try {
      const brandingData = await api.get<{ logoUrl: string | null }>('/branding');
      if (brandingData?.logoUrl) {
        setBrandingLogoUrl(brandingData.logoUrl);
      }
    } catch (error) {
      // Branding may not exist yet, ignore
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

    const result = await api.upload<{ url: string }>('/upload/logo', logoFile.file);
    return result.url;
  };

  const handleSave = async () => {
    if (!settings) {
      toast({ title: 'Error', description: 'Settings not loaded', variant: 'destructive' });
      return;
    }

    if (smtpEnabled && smtpFromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpFromEmail)) {
      toast({ title: 'Error', description: t('invalidEmail'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      let logoUrl: string | null = null;
      if (logoFile.file) {
        logoUrl = await uploadLogo();
      }

      // Update settings (language, turnstile, and email)
      await api.put('/settings', {
        systemLanguage,
        turnstileEnabled,
        turnstileSiteKey: turnstileSiteKey || null,
        turnstileSecretKey: turnstileSecretKey || null,
        smtpEnabled,
        smtpFromEmail: smtpFromEmail || null,
        smtpFromName: smtpFromName || null,
        resendApiKey: resendApiKey || null,
      });

      // Update branding (logo + turnstile config)
      const brandingUpdate: Record<string, any> = {};
      if (logoUrl) brandingUpdate.logoUrl = logoUrl;
      brandingUpdate.turnstileEnabled = turnstileEnabled;
      brandingUpdate.turnstileSiteKey = turnstileSiteKey || null;
      await api.put('/branding', brandingUpdate);

      toast({ title: 'Success', description: 'Settings updated successfully' });

      // Update the app language if it changed
      if (systemLanguage !== language) {
        setLanguage(systemLanguage as 'ar' | 'en' | 'he');
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
      <div className="container mx-auto px-3 py-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">{t('settings')}</h1>
          </div>
        </div>

        <div className="space-y-6">
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
                    <SelectItem value="he">{t('hebrew')} (עברית)</SelectItem>
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
                  accept="image/png,image/webp"
                  onChange={handleLogoChange}
                />
                {logoFile.preview && (
                  <div className="mt-2 border rounded-lg p-4 bg-muted/20 flex items-center justify-center">
                    <img src={logoFile.preview} alt={t('logoPreview')} className="w-full max-w-[200px] sm:max-w-xs max-h-32 object-contain" />
                  </div>
                )}
                {!logoFile.preview && brandingLogoUrl && (
                  <div className="mt-2">
                    <Label className="text-muted-foreground">{t('currentLogo')}</Label>
                    <div className="mt-2 border rounded-lg p-4 bg-muted/20 flex items-center justify-center">
                      <img src={brandingLogoUrl} alt={t('currentLogo')} className="w-full max-w-[200px] sm:max-w-xs max-h-32 object-contain" />
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

              {/* CAPTCHA Settings */}
              <div className="border-t pt-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">{t('captchaSettings')}</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('captchaDescription')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                    <div>
                      <Label htmlFor="turnstile-enabled">{t('enableCaptcha')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('captchaHelpText')}
                      </p>
                    </div>
                    <Switch
                      id="turnstile-enabled"
                      checked={turnstileEnabled}
                      onCheckedChange={setTurnstileEnabled}
                    />
                  </div>

                  {turnstileEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="turnstile-site-key">{t('captchaSiteKey')}</Label>
                        <Input
                          id="turnstile-site-key"
                          type="text"
                          placeholder="0x4AAAAAAA..."
                          value={turnstileSiteKey}
                          onChange={(e) => setTurnstileSiteKey(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('captchaSiteKeyHelp')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="turnstile-secret-key">{t('captchaSecretKey')}</Label>
                        <Input
                          id="turnstile-secret-key"
                          type="password"
                          placeholder="0x4AAAAAAA..."
                          value={turnstileSecretKey}
                          onChange={(e) => setTurnstileSecretKey(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t('captchaSecretKeyHelp')}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('emailSettings')}
              </CardTitle>
              <CardDescription>
                {t('emailSettingsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div>
                  <Label htmlFor="smtp-enabled">{t('enableEmailSending')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('enableEmailSendingDesc')}
                  </p>
                </div>
                <Switch
                  id="smtp-enabled"
                  checked={smtpEnabled}
                  onCheckedChange={setSmtpEnabled}
                />
              </div>

              {smtpEnabled && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="resend-api-key">{t('resendApiKey')}</Label>
                    <Input
                      id="resend-api-key"
                      type="password"
                      placeholder="re_..."
                      value={resendApiKey}
                      onChange={(e) => setResendApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('resendApiKeyHelp')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-from-email">{t('fromEmail')}</Label>
                    <Input
                      id="smtp-from-email"
                      type="email"
                      placeholder="noreply@yourdomain.com"
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('fromEmailHelp')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-from-name">{t('fromName')}</Label>
                    <Input
                      id="smtp-from-name"
                      type="text"
                      placeholder="Building Management"
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                    />
                  </div>
                </div>
              )}
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
                  <p className="text-sm mt-1">
                    {language === 'ar' ? t('arabic') : language === 'he' ? t('hebrew') : t('english')}
                  </p>
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
                  setSystemLanguage(settings.systemLanguage);
                  setTurnstileEnabled(settings.turnstileEnabled || false);
                  setTurnstileSiteKey(settings.turnstileSiteKey || '');
                  setSmtpEnabled(settings.smtpEnabled || false);
                  setSmtpFromEmail(settings.smtpFromEmail || '');
                  setSmtpFromName(settings.smtpFromName || '');
                  setResendApiKey(settings.resendApiKey || '');
                  setLogoFile({ file: null, preview: null });
                }
              }}
              disabled={isSaving}
            >
              {t('resetChanges')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 me-2" />
              {isSaving ? t('saving') : t('saveSettings')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
