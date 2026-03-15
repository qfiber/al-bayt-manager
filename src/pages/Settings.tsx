import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { Settings as SettingsIcon, Save, Globe, Upload, Shield, Mail, Bell, DollarSign, Building2, MessageSquare, CreditCard, Palette, FileText } from 'lucide-react';

interface SettingsData {
  id: string;
  companyName: string | null;
  systemLanguage: string;
  logoUrl: string | null;
  turnstileEnabled: boolean;
  turnstileSiteKey: string | null;
  turnstileSecretKey: string | null;
  registrationEnabled: boolean;
  smtpEnabled: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  resendApiKey: string | null;
  ntfyEnabled: boolean;
  ntfyServerUrl: string | null;
  smsEnabled: boolean;
  smsProvider: string | null;
  smsApiToken: string | null;
  smsUsername: string | null;
  smsSenderName: string | null;
  currencyCode: string;
  currencySymbol: string;
  stripeEnabled: boolean;
  stripePublishableKey: string | null;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  cardcomEnabled: boolean;
  cardcomTerminalNumber: string | null;
  cardcomApiName: string | null;
  cardcomApiPassword: string | null;
  emailVerificationEnabled: boolean;
  paypalEnabled: boolean;
  paypalClientId: string | null;
  paypalClientSecret: string | null;
  paypalMode: string | null;
  twilioEnabled: boolean;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioPhoneNumber: string | null;
  region: string;
  ezCountApiKey: string | null;
  ezCountApiEmail: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}

interface LogoFile {
  file: File | null;
  preview: string | null;
}

const CURRENCY_PRESETS: Record<string, { code: string; symbol: string }> = {
  ILS: { code: 'ILS', symbol: '₪' },
  USD: { code: 'USD', symbol: '$' },
  EUR: { code: 'EUR', symbol: '€' },
};

function detectCurrencyPreset(code: string, symbol: string): string {
  for (const [key, preset] of Object.entries(CURRENCY_PRESETS)) {
    if (preset.code === code && preset.symbol === symbol) return key;
  }
  return 'custom';
}

/** Returns true if the value looks like a masked secret (all asterisks + last 4 chars) */
function isMaskedValue(val: string): boolean {
  return /^\*{4,}/.test(val);
}

const Settings = () => {
  useRequireAuth('admin');

  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { refresh } = usePublicSettings();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [checking2FA, setChecking2FA] = useState(true);

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [systemLanguage, setSystemLanguage] = useState('ar');
  const [logoFile, setLogoFile] = useState<LogoFile>({ file: null, preview: null });
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileSecretKey, setTurnstileSecretKey] = useState('');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [ntfyEnabled, setNtfyEnabled] = useState(false);
  const [ntfyServerUrl, setNtfyServerUrl] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsApiToken, setSmsApiToken] = useState('');
  const [smsUsername, setSmsUsername] = useState('');
  const [smsSenderName, setSmsSenderName] = useState('');
  const [smsTestPhone, setSmsTestPhone] = useState('');
  const [smsTestLoading, setSmsTestLoading] = useState(false);
  const [currencyPreset, setCurrencyPreset] = useState('ILS');
  const [currencyCode, setCurrencyCode] = useState('ILS');
  const [currencySymbol, setCurrencySymbol] = useState('₪');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [cardcomEnabled, setCardcomEnabled] = useState(false);
  const [cardcomTerminalNumber, setCardcomTerminalNumber] = useState('');
  const [cardcomApiName, setCardcomApiName] = useState('');
  const [cardcomApiPassword, setCardcomApiPassword] = useState('');
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalMode, setPaypalMode] = useState('sandbox');
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [region, setRegion] = useState('IL');
  const [ezCountApiKey, setEzCountApiKey] = useState('');
  const [ezCountApiEmail, setEzCountApiEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [accentColor, setAccentColor] = useState('#6366f1');

  const applySettingsToForm = useCallback((data: SettingsData) => {
    setSettings(data);
    setCompanyName(data.companyName || '');
    setSystemLanguage(data.systemLanguage);
    setCurrentLogoUrl(data.logoUrl || null);
    setTurnstileEnabled(data.turnstileEnabled);
    setTurnstileSiteKey(data.turnstileSiteKey || '');
    setTurnstileSecretKey(data.turnstileSecretKey || '');
    setRegistrationEnabled(data.registrationEnabled ?? true);
    setSmtpEnabled(data.smtpEnabled);
    setSmtpFromEmail(data.smtpFromEmail || '');
    setSmtpFromName(data.smtpFromName || '');
    setResendApiKey(data.resendApiKey || '');
    setNtfyEnabled(data.ntfyEnabled);
    setNtfyServerUrl(data.ntfyServerUrl || '');
    setSmsEnabled(data.smsEnabled);
    setSmsApiToken(data.smsApiToken || '');
    setSmsUsername(data.smsUsername || '');
    setSmsSenderName(data.smsSenderName || '');
    const code = data.currencyCode || 'ILS';
    const symbol = data.currencySymbol || '₪';
    setCurrencyCode(code);
    setCurrencySymbol(symbol);
    setCurrencyPreset(detectCurrencyPreset(code, symbol));
    setStripeEnabled(data.stripeEnabled ?? false);
    setStripePublishableKey(data.stripePublishableKey || '');
    setStripeSecretKey(data.stripeSecretKey || '');
    setStripeWebhookSecret(data.stripeWebhookSecret || '');
    setCardcomEnabled(data.cardcomEnabled ?? false);
    setCardcomTerminalNumber(data.cardcomTerminalNumber || '');
    setCardcomApiName(data.cardcomApiName || '');
    setCardcomApiPassword(data.cardcomApiPassword || '');
    setEmailVerificationEnabled(data.emailVerificationEnabled ?? false);
    setPaypalEnabled(data.paypalEnabled ?? false);
    setPaypalClientId(data.paypalClientId || '');
    setPaypalClientSecret(data.paypalClientSecret || '');
    setPaypalMode(data.paypalMode || 'sandbox');
    setTwilioEnabled(data.twilioEnabled ?? false);
    setTwilioAccountSid(data.twilioAccountSid || '');
    setTwilioAuthToken(data.twilioAuthToken || '');
    setTwilioPhoneNumber(data.twilioPhoneNumber || '');
    setRegion(data.region || 'IL');
    setEzCountApiKey(data.ezCountApiKey || '');
    setEzCountApiEmail(data.ezCountApiEmail || '');
    setPrimaryColor(data.primaryColor || '#3b82f6');
    setAccentColor(data.accentColor || '#6366f1');
  }, []);

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
      setHas2FA(factors && factors.length > 0);
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
        applySettingsToForm(data);
      }
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile({ file, preview: URL.createObjectURL(file) });
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile.file) return null;
    const result = await api.upload<{ url: string }>('/upload/logo', logoFile.file);
    return result.url;
  };

  const handleSave = async () => {
    if (!settings) {
      toast({ title: t('error'), description: t('settingsNotLoaded'), variant: 'destructive' });
      return;
    }

    if (smtpEnabled && smtpFromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpFromEmail)) {
      toast({ title: t('error'), description: t('invalidEmail'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      let logoUrl: string | null = null;
      if (logoFile.file) {
        logoUrl = await uploadLogo();
      }

      const updated = await api.put<SettingsData>('/settings', {
        companyName: companyName || null,
        systemLanguage,
        ...(logoUrl ? { logoUrl } : {}),
        turnstileEnabled,
        turnstileSiteKey: turnstileSiteKey || null,
        turnstileSecretKey: turnstileSecretKey || null,
        registrationEnabled,
        smtpEnabled,
        smtpFromEmail: smtpFromEmail || null,
        smtpFromName: smtpFromName || null,
        resendApiKey: resendApiKey || null,
        ntfyEnabled,
        ntfyServerUrl: ntfyServerUrl || null,
        smsEnabled,
        smsApiToken: smsApiToken || null,
        smsUsername: smsUsername || null,
        smsSenderName: smsSenderName || null,
        currencyCode,
        currencySymbol,
        stripeEnabled,
        stripePublishableKey: stripePublishableKey || null,
        stripeSecretKey: stripeSecretKey || null,
        stripeWebhookSecret: stripeWebhookSecret || null,
        cardcomEnabled,
        cardcomTerminalNumber: cardcomTerminalNumber || null,
        cardcomApiName: cardcomApiName || null,
        cardcomApiPassword: cardcomApiPassword || null,
        emailVerificationEnabled,
        paypalEnabled,
        paypalClientId: paypalClientId || null,
        paypalClientSecret: paypalClientSecret || null,
        paypalMode,
        twilioEnabled,
        twilioAccountSid: twilioAccountSid || null,
        twilioAuthToken: twilioAuthToken || null,
        twilioPhoneNumber: twilioPhoneNumber || null,
        region,
        ezCountApiKey: ezCountApiKey || null,
        ezCountApiEmail: ezCountApiEmail || null,
        primaryColor,
        accentColor,
      });

      // Apply updated data directly from PUT response — don't re-fetch
      if (updated) applySettingsToForm(updated);

      toast({ title: t('success'), description: t('settingsUpdated') });

      if (systemLanguage !== language) {
        setLanguage(systemLanguage as 'ar' | 'en' | 'he');
      }

      await refresh();
      setLogoFile({ file: null, preview: null });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      applySettingsToForm(settings);
      setLogoFile({ file: null, preview: null });
    }
  };

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
          {/* Company / Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {t('companyBranding')}
              </CardTitle>
              <CardDescription>
                {t('companyBrandingDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">{t('companyName')}</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t('companyNamePlaceholder')}
                  maxLength={255}
                />
              </div>

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
                {!logoFile.preview && currentLogoUrl && (
                  <div className="mt-2">
                    <Label className="text-muted-foreground">{t('currentLogo')}</Label>
                    <div className="mt-2 border rounded-lg p-4 bg-muted/20 flex items-center justify-center">
                      <img src={currentLogoUrl} alt={t('currentLogo')} className="w-full max-w-[200px] sm:max-w-xs max-h-32 object-contain" />
                    </div>
                  </div>
                )}
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
                    <SelectItem value="he">{t('hebrew')} (עברית)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {t('systemLanguageDesc')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Currency Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t('currencySettings')}
              </CardTitle>
              <CardDescription>
                {t('currencySettingsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('currency')}</Label>
                <Select
                  value={currencyPreset}
                  onValueChange={(val) => {
                    setCurrencyPreset(val);
                    if (CURRENCY_PRESETS[val]) {
                      setCurrencyCode(CURRENCY_PRESETS[val].code);
                      setCurrencySymbol(CURRENCY_PRESETS[val].symbol);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ILS">ILS (₪)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="custom">{t('customCurrency')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {currencyPreset === 'custom' && (
                <div className="space-y-2">
                  <Label>{t('currencyCode')}</Label>
                  <Input
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('currencySymbol')}</Label>
                <Input
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  maxLength={5}
                />
                <p className="text-xs text-muted-foreground">
                  {t('currencySymbolHint')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Platform Settings — Super Admin Only */}
          {isSuperAdmin && (<>

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
              {/* Registration Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div>
                  <Label htmlFor="registration-enabled" className="text-base font-semibold">{t('publicRegistration')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('publicRegistrationDesc')}
                  </p>
                </div>
                <Switch
                  id="registration-enabled"
                  checked={registrationEnabled}
                  onCheckedChange={setRegistrationEnabled}
                />
              </div>

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
                        <div className="flex items-center justify-between">
                          <Label htmlFor="turnstile-secret-key">{t('captchaSecretKey')}</Label>
                          {isMaskedValue(turnstileSecretKey) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setTurnstileSecretKey('')}
                            >
                              {t('changeKey')}
                            </Button>
                          )}
                        </div>
                        <Input
                          id="turnstile-secret-key"
                          type="password"
                          placeholder="0x4AAAAAAA..."
                          value={turnstileSecretKey}
                          onChange={(e) => setTurnstileSecretKey(e.target.value)}
                          readOnly={isMaskedValue(turnstileSecretKey)}
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="resend-api-key">{t('resendApiKey')}</Label>
                      {isMaskedValue(resendApiKey) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setResendApiKey('')}
                        >
                          {t('changeKey')}
                        </Button>
                      )}
                    </div>
                    <Input
                      id="resend-api-key"
                      type="password"
                      placeholder="re_..."
                      value={resendApiKey}
                      onChange={(e) => setResendApiKey(e.target.value)}
                      readOnly={isMaskedValue(resendApiKey)}
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
                      placeholder={t('companyNamePlaceholder')}
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Push Notifications (ntfy) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {t('ntfyConfiguration')}
              </CardTitle>
              <CardDescription>
                {t('ntfyConfigDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div>
                  <Label htmlFor="ntfy-enabled">{t('ntfyEnabled')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('ntfyEnabledDesc')}
                  </p>
                </div>
                <Switch
                  id="ntfy-enabled"
                  checked={ntfyEnabled}
                  onCheckedChange={setNtfyEnabled}
                />
              </div>

              {ntfyEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="ntfy-server-url">{t('ntfyServerUrl')}</Label>
                  <Input
                    id="ntfy-server-url"
                    type="url"
                    placeholder="https://ntfy.sh"
                    value={ntfyServerUrl}
                    onChange={(e) => setNtfyServerUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('ntfyServerUrlHelp')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SMS Settings (019) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                {t('smsConfiguration')}
              </CardTitle>
              <CardDescription>
                {t('smsConfigDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div>
                  <Label htmlFor="sms-enabled">{t('smsEnabled')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('smsEnabledDesc')}
                  </p>
                </div>
                <Switch
                  id="sms-enabled"
                  checked={smsEnabled}
                  onCheckedChange={setSmsEnabled}
                />
              </div>

              {smsEnabled && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="sms-username">{t('smsUsername')}</Label>
                    <Input
                      id="sms-username"
                      type="text"
                      placeholder="my019user"
                      value={smsUsername}
                      onChange={(e) => setSmsUsername(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('smsUsernameHelp')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sms-api-token">{t('smsApiToken')}</Label>
                      {isMaskedValue(smsApiToken) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSmsApiToken('')}
                        >
                          {t('changeKey')}
                        </Button>
                      )}
                    </div>
                    <Input
                      id="sms-api-token"
                      type="password"
                      placeholder="your-019-api-token"
                      value={smsApiToken}
                      onChange={(e) => setSmsApiToken(e.target.value)}
                      readOnly={isMaskedValue(smsApiToken)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('smsApiTokenHelp')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sms-sender-name">{t('smsSenderName')}</Label>
                    <Input
                      id="sms-sender-name"
                      type="text"
                      placeholder="AlBayt"
                      value={smsSenderName}
                      onChange={(e) => setSmsSenderName(e.target.value)}
                      maxLength={11}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('smsSenderNameHelp')}
                    </p>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <Label className="text-base font-semibold">{t('smsTestSend')}</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="tel"
                        placeholder="05xxxxxxxx"
                        value={smsTestPhone}
                        onChange={(e) => setSmsTestPhone(e.target.value)}
                        className="max-w-[200px]"
                        dir="ltr"
                      />
                      <Button
                        variant="outline"
                        disabled={smsTestLoading || !smsTestPhone}
                        onClick={async () => {
                          setSmsTestLoading(true);
                          try {
                            const result = await api.post('/settings/test-sms', { phone: smsTestPhone });
                            toast({
                              title: result.success ? t('smsTestSuccess') : t('smsTestFailed'),
                              description: result.error || undefined,
                              variant: result.success ? 'default' : 'destructive',
                            });
                          } catch (err: any) {
                            toast({ title: t('smsTestFailed'), description: err.message, variant: 'destructive' });
                          } finally {
                            setSmsTestLoading(false);
                          }
                        }}
                      >
                        {smsTestLoading ? t('loading') : t('smsTestSend')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stripe Payment Gateway */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {t('stripeConfiguration')}
              </CardTitle>
              <CardDescription>{t('stripeConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="stripeEnabled">{t('enableStripe')}</Label>
                <Switch
                  id="stripeEnabled"
                  checked={stripeEnabled}
                  onCheckedChange={setStripeEnabled}
                />
              </div>
              {stripeEnabled && (
                <div className="space-y-4">
                  <div>
                    <Label>{t('stripePublishableKey')}</Label>
                    <Input
                      value={stripePublishableKey}
                      onChange={(e) => setStripePublishableKey(e.target.value)}
                      placeholder="pk_live_..."
                    />
                  </div>
                  <div>
                    <Label>{t('stripeSecretKey')}</Label>
                    <Input
                      type="password"
                      value={stripeSecretKey}
                      onChange={(e) => setStripeSecretKey(e.target.value)}
                      placeholder="sk_live_..."
                    />
                  </div>
                  <div>
                    <Label>{t('stripeWebhookSecret')}</Label>
                    <Input
                      type="password"
                      value={stripeWebhookSecret}
                      onChange={(e) => setStripeWebhookSecret(e.target.value)}
                      placeholder="whsec_..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('stripeComingSoon')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CardCom Payment Gateway */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {t('cardcomConfiguration')}
              </CardTitle>
              <CardDescription>{t('cardcomConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="cardcomEnabled">{t('enableCardcom')}</Label>
                <Switch
                  id="cardcomEnabled"
                  checked={cardcomEnabled}
                  onCheckedChange={setCardcomEnabled}
                />
              </div>
              {cardcomEnabled && (
                <div className="space-y-4">
                  <div>
                    <Label>{t('cardcomTerminalNumber')}</Label>
                    <Input
                      value={cardcomTerminalNumber}
                      onChange={(e) => setCardcomTerminalNumber(e.target.value)}
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <Label>{t('cardcomApiName')}</Label>
                    <Input
                      type="password"
                      value={cardcomApiName}
                      onChange={(e) => setCardcomApiName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t('cardcomApiPassword')}</Label>
                    <Input
                      type="password"
                      value={cardcomApiPassword}
                      onChange={(e) => setCardcomApiPassword(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('cardcomComingSoon')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PayPal Payment Gateway */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {t('paypalConfiguration')}
              </CardTitle>
              <CardDescription>{t('paypalConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Label>{t('enablePaypal')}</Label>
                <Switch checked={paypalEnabled} onCheckedChange={setPaypalEnabled} />
              </div>
              {paypalEnabled && (
                <div className="space-y-4">
                  <div>
                    <Label>{t('paypalClientId')}</Label>
                    <Input value={paypalClientId} onChange={(e) => setPaypalClientId(e.target.value)} placeholder="AX..." />
                  </div>
                  <div>
                    <Label>{t('paypalClientSecret')}</Label>
                    <Input type="password" value={paypalClientSecret} onChange={(e) => setPaypalClientSecret(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('paypalMode')}</Label>
                    <Select value={paypalMode} onValueChange={setPaypalMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Twilio SMS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                {t('twilioConfiguration')}
              </CardTitle>
              <CardDescription>{t('twilioConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Label>{t('enableTwilio')}</Label>
                <Switch checked={twilioEnabled} onCheckedChange={setTwilioEnabled} />
              </div>
              {twilioEnabled && (
                <div className="space-y-4">
                  <div>
                    <Label>{t('twilioAccountSid')}</Label>
                    <Input value={twilioAccountSid} onChange={(e) => setTwilioAccountSid(e.target.value)} placeholder="AC..." />
                  </div>
                  <div>
                    <Label>{t('twilioAuthToken')}</Label>
                    <Input type="password" value={twilioAuthToken} onChange={(e) => setTwilioAuthToken(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('twilioPhoneNumber')}</Label>
                    <Input value={twilioPhoneNumber} onChange={(e) => setTwilioPhoneNumber(e.target.value)} placeholder="+1234567890" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* EZCount Invoicing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t('ezCountConfiguration')}
              </CardTitle>
              <CardDescription>{t('ezCountConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('ezCountApiKey')}</Label>
                <Input type="password" value={ezCountApiKey} onChange={(e) => setEzCountApiKey(e.target.value)} placeholder="API Key" />
              </div>
              <div>
                <Label>{t('ezCountApiEmail')}</Label>
                <Input type="email" value={ezCountApiEmail} onChange={(e) => setEzCountApiEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            </CardContent>
          </Card>

          {/* Region */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t('regionConfiguration')}
              </CardTitle>
              <CardDescription>{t('regionConfigDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label>{t('region')}</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IL">{t('regionIsrael')}</SelectItem>
                    <SelectItem value="INTL">{t('regionInternational')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">{t('regionHelp')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Verification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('emailVerification')}
              </CardTitle>
              <CardDescription>{t('emailVerificationDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="emailVerificationEnabled">{t('enableEmailVerification')}</Label>
                <Switch
                  id="emailVerificationEnabled"
                  checked={emailVerificationEnabled}
                  onCheckedChange={setEmailVerificationEnabled}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t('emailVerificationHelp')}</p>
            </CardContent>
          </Card>

          </>)}

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                {t('brandingSettings')}
              </CardTitle>
              <CardDescription>{t('brandingSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('primaryColor')}</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="color" value={primaryColor || '#3b82f6'} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                    <Input value={primaryColor || '#3b82f6'} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" placeholder="#3b82f6" />
                  </div>
                </div>
                <div>
                  <Label>{t('accentColor')}</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="color" value={accentColor || '#6366f1'} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                    <Input value={accentColor || '#6366f1'} onChange={(e) => setAccentColor(e.target.value)} className="flex-1" placeholder="#6366f1" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Management */}
          <SubscriptionSection />

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
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

// Subscription management sub-component
const SubscriptionSection = () => {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState('monthly');

  useEffect(() => {
    api.get('/subscriptions/current').then(setSubscription).catch(() => {});
    api.get('/subscriptions/plans').then(setPlans).catch(() => {});
  }, []);

  const status = subscription?.subscription?.status;
  const currentPlanId = subscription?.subscription?.planId;
  const trialEnd = subscription?.subscription?.trialEndDate;
  const periodEnd = subscription?.subscription?.currentPeriodEnd;

  const endDate = status === 'trial' ? trialEnd : periodEnd;
  const daysLeft = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  const handleChangePlan = async (planId: string, cycle: string) => {
    try {
      const result = await api.post('/subscriptions/cardcom-checkout', { planId, billingCycle: cycle });
      if (result.url) { window.location.href = result.url; return; }
    } catch {}
    toast({ title: t('error'), description: t('noPaymentGatewayConfigured'), variant: 'destructive' });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {t('subscriptionManagement')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('currentPlan')}: {subscription?.planName || t('noPlan')}</p>
              <p className="text-xs text-muted-foreground">
                {!status ? t('selectPlanToStart') :
                 status === 'trial' && daysLeft !== null ? t('trialEndsIn').replace('{days}', String(daysLeft)) :
                 status === 'active' ? `${t('billingCycle')}: ${subscription?.subscription?.billingCycle || '-'}` :
                 status === 'past_due' ? t('subscriptionExpired') : status}
              </p>
            </div>
            {status && (
              <Badge variant={status === 'active' ? 'default' : status === 'trial' ? 'outline' : 'destructive'}>
                {status}
              </Badge>
            )}
          </div>

          {subscription?.maxBuildings != null && (
            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
              <div>
                <span className="text-muted-foreground">{t('maxBuildings')}</span>
                <p className="font-medium">{subscription?.maxBuildings === 0 ? '∞' : subscription?.maxBuildings}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t('maxApartmentsPerBuilding')}</span>
                <p className="font-medium">{subscription?.maxApartmentsPerBuilding === 0 ? '∞' : subscription?.maxApartmentsPerBuilding}</p>
              </div>
            </div>
          )}

          <Button variant="outline" onClick={() => setShowChangePlan(true)} className="w-full">
            {t('changePlan')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('changePlan')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="inline-flex bg-muted rounded-full p-1">
                {['monthly', 'semi_annual', 'yearly'].map(cycle => (
                  <button key={cycle} onClick={() => setSelectedCycle(cycle)}
                    className={`px-4 py-1.5 rounded-full text-sm ${selectedCycle === cycle ? 'bg-background shadow font-medium' : 'text-muted-foreground'}`}>
                    {cycle === 'monthly' ? t('monthly') : cycle === 'semi_annual' ? t('semiAnnual') : t('yearly')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {plans.filter(p => p.isActive && !p.isCustom).map(plan => {
                const isSamePlan = plan.id === currentPlanId;
                const currentCycle = subscription?.subscription?.billingCycle;
                const isExactMatch = isSamePlan && selectedCycle === currentCycle;
                const price = selectedCycle === 'yearly' && plan.yearlyPrice ? parseFloat(plan.yearlyPrice) :
                  selectedCycle === 'semi_annual' && plan.semiAnnualPrice ? parseFloat(plan.semiAnnualPrice) :
                  parseFloat(plan.monthlyPrice);

                return (
                  <div key={plan.id} className={`border rounded-xl p-4 ${isSamePlan ? 'border-primary bg-primary/5' : ''}`}>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-2xl font-bold mt-2">{formatCurrency(price)}</p>
                    <p className="text-xs text-muted-foreground">
                      / {selectedCycle === 'monthly' ? t('monthly').toLowerCase() : selectedCycle === 'semi_annual' ? t('semiAnnual').toLowerCase() : t('yearly').toLowerCase()}
                    </p>
                    <div className="text-xs text-muted-foreground mt-3 space-y-1">
                      <p>{plan.maxBuildings} {t('buildings')}</p>
                      <p>{plan.maxApartmentsPerBuilding} {t('maxApartmentsPerBuilding')}</p>
                    </div>
                    <Button size="sm" className="w-full mt-3" variant={isExactMatch ? 'outline' : 'default'}
                      disabled={isExactMatch}
                      onClick={() => handleChangePlan(plan.id, selectedCycle)}>
                      {isExactMatch ? t('currentPlan') : isSamePlan ? t('changeCycle') : t('selectPlan')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Settings;
