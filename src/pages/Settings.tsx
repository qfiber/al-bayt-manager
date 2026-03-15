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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrency } from '@/contexts/PublicSettingsContext';
import { Settings as SettingsIcon, Save, Globe, Upload, Shield, Mail, Bell, DollarSign, Building2, MessageSquare, CreditCard, Palette, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { CardComPayment } from '@/components/CardComPayment';

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

function isMaskedValue(val: string): boolean {
  return /^\*{4,}/.test(val);
}

// ─── Field Group Component ────────────────────────────────────────────
const FieldGroup = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`space-y-4 ${className}`}>{children}</div>
);

const SectionCard = ({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description?: string; children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-4">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const ToggleRow = ({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-2">
    <div className="space-y-0.5">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────
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
  const [logoFile, setLogoFile] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null });
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
    setSystemLanguage(data.systemLanguage || 'ar');
    setCurrentLogoUrl(data.logoUrl);
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
    if (user && isAdmin) fetchSettings();
  }, [user, isAdmin]);

  useEffect(() => {
    if (user) check2FAStatus();
  }, [user]);

  const check2FAStatus = async () => {
    try {
      const factors = await api.get<{ id: string; friendlyName: string; status: string }[]>('/auth/2fa/factors');
      setHas2FA(factors && factors.length > 0);
    } catch {
    } finally { setChecking2FA(false); }
  };

  const fetchSettings = async () => {
    try {
      const data = await api.get<SettingsData>('/settings');
      if (data) applySettingsToForm(data);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setLogoFile({ file, preview: URL.createObjectURL(file) });
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile.file) return null;
    const formData = new FormData();
    formData.append('logo', logoFile.file);
    const result = await api.upload<{ logoUrl: string }>('/upload/logo', formData);
    return result.logoUrl;
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
      if (logoFile.file) logoUrl = await uploadLogo();

      const updated = await api.put<SettingsData>('/settings', {
        companyName: companyName || null, systemLanguage,
        ...(logoUrl ? { logoUrl } : {}),
        turnstileEnabled, turnstileSiteKey: turnstileSiteKey || null, turnstileSecretKey: turnstileSecretKey || null,
        registrationEnabled, smtpEnabled, smtpFromEmail: smtpFromEmail || null, smtpFromName: smtpFromName || null,
        resendApiKey: resendApiKey || null, ntfyEnabled, ntfyServerUrl: ntfyServerUrl || null,
        smsEnabled, smsApiToken: smsApiToken || null, smsUsername: smsUsername || null, smsSenderName: smsSenderName || null,
        currencyCode, currencySymbol,
        stripeEnabled, stripePublishableKey: stripePublishableKey || null, stripeSecretKey: stripeSecretKey || null, stripeWebhookSecret: stripeWebhookSecret || null,
        cardcomEnabled, cardcomTerminalNumber: cardcomTerminalNumber || null, cardcomApiName: cardcomApiName || null, cardcomApiPassword: cardcomApiPassword || null,
        emailVerificationEnabled,
        paypalEnabled, paypalClientId: paypalClientId || null, paypalClientSecret: paypalClientSecret || null, paypalMode,
        twilioEnabled, twilioAccountSid: twilioAccountSid || null, twilioAuthToken: twilioAuthToken || null, twilioPhoneNumber: twilioPhoneNumber || null,
        region, ezCountApiKey: ezCountApiKey || null, ezCountApiEmail: ezCountApiEmail || null,
        primaryColor, accentColor,
      });
      if (updated) applySettingsToForm(updated);
      toast({ title: t('success'), description: t('settingsUpdated') });
      if (systemLanguage !== language) setLanguage(systemLanguage as 'ar' | 'en' | 'he');
      await refresh();
      setLogoFile({ file: null, preview: null });
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isRtl = language === 'ar' || language === 'he';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-3 py-4 sm:p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                {t('settings')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('settingsDescription')}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Save className="w-4 h-4 me-2" />}
            {t('save')}
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="general" className="flex-1 min-w-[80px] text-xs sm:text-sm">
              <Building2 className="w-3.5 h-3.5 me-1.5 hidden sm:inline" />{t('general')}
            </TabsTrigger>
            {isSuperAdmin && (
              <>
                <TabsTrigger value="security" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                  <Shield className="w-3.5 h-3.5 me-1.5 hidden sm:inline" />{t('security')}
                </TabsTrigger>
                <TabsTrigger value="communications" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                  <Mail className="w-3.5 h-3.5 me-1.5 hidden sm:inline" />{t('communications')}
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                  <CreditCard className="w-3.5 h-3.5 me-1.5 hidden sm:inline" />{t('payments')}
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="subscription" className="flex-1 min-w-[80px] text-xs sm:text-sm">
              <DollarSign className="w-3.5 h-3.5 me-1.5 hidden sm:inline" />{t('subscription')}
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════ GENERAL TAB ═══════════════ */}
          <TabsContent value="general" className="space-y-4">
            <SectionCard icon={Building2} title={t('companyBranding')} description={t('companyBrandingDesc')}>
              <FieldGroup>
                <div>
                  <Label>{t('companyName')}</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t('companyName')} />
                </div>
                <div>
                  <Label>{t('companyLogo')}</Label>
                  <div className="flex items-center gap-4 mt-1">
                    {(logoFile.preview || currentLogoUrl) && (
                      <img src={logoFile.preview || currentLogoUrl || ''} alt="Logo" className="w-16 h-16 object-contain rounded-lg border bg-white p-1" />
                    )}
                    <div className="flex-1">
                      <Input type="file" accept="image/*" onChange={handleLogoChange} className="cursor-pointer" />
                    </div>
                  </div>
                </div>
              </FieldGroup>
            </SectionCard>

            <SectionCard icon={Globe} title={t('languageSettings')}>
              <div>
                <Label>{t('systemLanguage')}</Label>
                <Select value={systemLanguage} onValueChange={setSystemLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="he">עברית</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </SectionCard>

            <SectionCard icon={DollarSign} title={t('currencySettings')}>
              <FieldGroup>
                <div>
                  <Label>{t('currencyPreset')}</Label>
                  <Select value={currencyPreset} onValueChange={(v) => {
                    setCurrencyPreset(v);
                    if (v !== 'custom') { setCurrencyCode(CURRENCY_PRESETS[v].code); setCurrencySymbol(CURRENCY_PRESETS[v].symbol); }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ILS">₪ ILS</SelectItem>
                      <SelectItem value="USD">$ USD</SelectItem>
                      <SelectItem value="EUR">€ EUR</SelectItem>
                      <SelectItem value="custom">{t('custom')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {currencyPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t('currencyCode')}</Label>
                      <Input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} maxLength={3} />
                    </div>
                    <div>
                      <Label>{t('currencySymbol')}</Label>
                      <Input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} maxLength={5} />
                    </div>
                  </div>
                )}
              </FieldGroup>
            </SectionCard>

            <SectionCard icon={Palette} title={t('brandingColors')}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('primaryColor')}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label>{t('accentColor')}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 2FA */}
            <SectionCard icon={Shield} title={t('twoFactorAuth')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">{has2FA ? t('twoFactorEnabled') : t('twoFactorDisabled')}</p>
                  <p className="text-xs text-muted-foreground">{t('twoFactorDescription')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/setup-2fa')}>
                  {has2FA ? t('manage') : t('setup')}
                </Button>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ═══════════════ SECURITY TAB (super-admin) ═══════════════ */}
          {isSuperAdmin && (
            <TabsContent value="security" className="space-y-4">
              <SectionCard icon={Shield} title={t('accessControl')}>
                <FieldGroup>
                  <ToggleRow label={t('publicRegistration')} description={t('publicRegistrationDesc')} checked={registrationEnabled} onChange={setRegistrationEnabled} />
                  <ToggleRow label={t('enableEmailVerification')} description={t('emailVerificationHelp')} checked={emailVerificationEnabled} onChange={setEmailVerificationEnabled} />
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={Shield} title={t('captchaSettings')} description={t('captchaDescription')}>
                <FieldGroup>
                  <ToggleRow label={t('enableCaptcha')} checked={turnstileEnabled} onChange={setTurnstileEnabled} />
                  {turnstileEnabled && (
                    <>
                      <div>
                        <Label>{t('turnstileSiteKey')}</Label>
                        <Input value={turnstileSiteKey} onChange={(e) => setTurnstileSiteKey(e.target.value)} placeholder="0x..." />
                      </div>
                      <div>
                        <Label>{t('turnstileSecretKey')}</Label>
                        <div className="flex gap-2">
                          <Input type="password" value={turnstileSecretKey} onChange={(e) => setTurnstileSecretKey(e.target.value)} className="flex-1" />
                          {isMaskedValue(turnstileSecretKey) && (
                            <Button variant="outline" size="sm" onClick={() => setTurnstileSecretKey('')}>{t('change')}</Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={Globe} title={t('regionConfiguration')} description={t('regionConfigDesc')}>
                <div>
                  <Label>{t('region')}</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IL">{t('regionIsrael')}</SelectItem>
                      <SelectItem value="INTL">{t('regionInternational')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SectionCard>
            </TabsContent>
          )}

          {/* ═══════════════ COMMUNICATIONS TAB (super-admin) ═══════════════ */}
          {isSuperAdmin && (
            <TabsContent value="communications" className="space-y-4">
              <SectionCard icon={Mail} title={t('emailConfiguration')} description={t('emailConfigDesc')}>
                <FieldGroup>
                  <ToggleRow label={t('enableEmail')} checked={smtpEnabled} onChange={setSmtpEnabled} />
                  {smtpEnabled && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t('fromEmail')}</Label>
                          <Input type="email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} />
                        </div>
                        <div>
                          <Label>{t('fromName')}</Label>
                          <Input value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label>{t('resendApiKey')}</Label>
                        <Input type="password" value={resendApiKey} onChange={(e) => setResendApiKey(e.target.value)} placeholder="re_..." />
                      </div>
                    </>
                  )}
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={Bell} title={t('pushNotifications')} description={t('pushNotificationsDesc')}>
                <FieldGroup>
                  <ToggleRow label={t('enableNtfy')} checked={ntfyEnabled} onChange={setNtfyEnabled} />
                  {ntfyEnabled && (
                    <div>
                      <Label>{t('ntfyServerUrl')}</Label>
                      <Input value={ntfyServerUrl} onChange={(e) => setNtfyServerUrl(e.target.value)} placeholder="https://ntfy.sh" />
                    </div>
                  )}
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={MessageSquare} title={t('smsConfiguration')} description={t('smsConfigDesc')}>
                <FieldGroup>
                  <ToggleRow label={t('enableSms')} checked={smsEnabled} onChange={setSmsEnabled} />
                  {smsEnabled && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t('smsUsername')}</Label>
                          <Input value={smsUsername} onChange={(e) => setSmsUsername(e.target.value)} />
                        </div>
                        <div>
                          <Label>{t('smsSenderName')}</Label>
                          <Input value={smsSenderName} onChange={(e) => setSmsSenderName(e.target.value)} maxLength={11} />
                        </div>
                      </div>
                      <div>
                        <Label>{t('smsApiToken')}</Label>
                        <Input type="password" value={smsApiToken} onChange={(e) => setSmsApiToken(e.target.value)} />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label>{t('smsTestPhone')}</Label>
                          <Input value={smsTestPhone} onChange={(e) => setSmsTestPhone(e.target.value)} placeholder="+972..." />
                        </div>
                        <Button variant="outline" size="sm" disabled={smsTestLoading || !smsTestPhone}
                          onClick={async () => {
                            setSmsTestLoading(true);
                            try {
                              await api.post('/settings/test-sms', { phone: smsTestPhone });
                              toast({ title: t('success'), description: t('smsTestSent') });
                            } catch (err: any) {
                              toast({ title: t('error'), description: err.message, variant: 'destructive' });
                            } finally { setSmsTestLoading(false); }
                          }}>
                          {smsTestLoading ? t('loading') : t('smsTestSend')}
                        </Button>
                      </div>
                    </>
                  )}
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={MessageSquare} title={t('twilioConfiguration')} description={t('twilioConfigDesc')}>
                <FieldGroup>
                  <ToggleRow label={t('enableTwilio')} checked={twilioEnabled} onChange={setTwilioEnabled} />
                  {twilioEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        <Input value={twilioPhoneNumber} onChange={(e) => setTwilioPhoneNumber(e.target.value)} placeholder="+1..." />
                      </div>
                    </div>
                  )}
                </FieldGroup>
              </SectionCard>
            </TabsContent>
          )}

          {/* ═══════════════ PAYMENTS TAB (super-admin) ═══════════════ */}
          {isSuperAdmin && (
            <TabsContent value="payments" className="space-y-4">
              <SectionCard icon={CreditCard} title={t('cardcomConfiguration')} description={t('cardcomConfigDesc')}>
                <FieldGroup>
                  <ToggleRow label={t('enableCardcom')} checked={cardcomEnabled} onChange={setCardcomEnabled} />
                  {cardcomEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>{t('cardcomTerminalNumber')}</Label>
                        <Input value={cardcomTerminalNumber} onChange={(e) => setCardcomTerminalNumber(e.target.value)} placeholder="1000" />
                      </div>
                      <div>
                        <Label>{t('cardcomApiName')}</Label>
                        <Input type="password" value={cardcomApiName} onChange={(e) => setCardcomApiName(e.target.value)} />
                      </div>
                      <div>
                        <Label>{t('cardcomApiPassword')}</Label>
                        <Input type="password" value={cardcomApiPassword} onChange={(e) => setCardcomApiPassword(e.target.value)} />
                      </div>
                    </div>
                  )}
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={CreditCard} title={t('stripeConfiguration')} description={t('stripeConfigDesc')}>
                <FieldGroup>
                  <ToggleRow label={t('enableStripe')} checked={stripeEnabled} onChange={setStripeEnabled} />
                  {stripeEnabled && (
                    <>
                      <div>
                        <Label>{t('stripePublishableKey')}</Label>
                        <Input value={stripePublishableKey} onChange={(e) => setStripePublishableKey(e.target.value)} placeholder="pk_live_..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t('stripeSecretKey')}</Label>
                          <Input type="password" value={stripeSecretKey} onChange={(e) => setStripeSecretKey(e.target.value)} />
                        </div>
                        <div>
                          <Label>{t('stripeWebhookSecret')}</Label>
                          <Input type="password" value={stripeWebhookSecret} onChange={(e) => setStripeWebhookSecret(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={CreditCard} title={t('paypalConfiguration')} description={t('paypalConfigDesc')}>
                <FieldGroup>
                  <ToggleRow label={t('enablePaypal')} checked={paypalEnabled} onChange={setPaypalEnabled} />
                  {paypalEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                </FieldGroup>
              </SectionCard>

              <SectionCard icon={FileText} title={t('ezCountConfiguration')} description={t('ezCountConfigDesc')}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t('ezCountApiKey')}</Label>
                    <Input type="password" value={ezCountApiKey} onChange={(e) => setEzCountApiKey(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t('ezCountApiEmail')}</Label>
                    <Input type="email" value={ezCountApiEmail} onChange={(e) => setEzCountApiEmail(e.target.value)} />
                  </div>
                </div>
              </SectionCard>
            </TabsContent>
          )}

          {/* ═══════════════ SUBSCRIPTION TAB ═══════════════ */}
          <TabsContent value="subscription">
            <SubscriptionSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// ─── Subscription Section ──────────────────────────────────────────────
const SubscriptionSection = () => {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState('monthly');
  const [paymentState, setPaymentState] = useState<{ lowProfileId: string; planName: string; amount: number; isIsrael: boolean } | null>(null);

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
      const plan = plans.find(p => p.id === planId);
      const result = await api.post('/subscriptions/cardcom-checkout', { planId, billingCycle: cycle });
      if (result.lowProfileId) {
        const price = cycle === 'yearly' && plan?.yearlyPrice ? parseFloat(plan.yearlyPrice) :
          cycle === 'semi_annual' && plan?.semiAnnualPrice ? parseFloat(plan.semiAnnualPrice) :
          parseFloat(plan?.monthlyPrice || '0');
        setPaymentState({ lowProfileId: result.lowProfileId, planName: plan?.name || '', amount: price, isIsrael: result.isIsrael ?? false });
        return;
      }
    } catch {}
    toast({ title: t('error'), description: t('noPaymentGatewayConfigured'), variant: 'destructive' });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4 text-primary" />
            {t('subscriptionManagement')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{subscription?.planName || t('noPlan')}</p>
              <p className="text-sm text-muted-foreground">
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
                    className={`px-4 py-1.5 rounded-full text-sm transition-colors ${selectedCycle === cycle ? 'bg-background shadow font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                    {cycle === 'monthly' ? t('monthly') : cycle === 'semi_annual' ? t('semiAnnual') : t('yearly')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.filter(p => p.isActive && !p.isCustom).map(plan => {
                const isSamePlan = plan.id === currentPlanId;
                const currentCycle = subscription?.subscription?.billingCycle;
                const isExactMatch = isSamePlan && selectedCycle === currentCycle;
                const price = selectedCycle === 'yearly' && plan.yearlyPrice ? parseFloat(plan.yearlyPrice) :
                  selectedCycle === 'semi_annual' && plan.semiAnnualPrice ? parseFloat(plan.semiAnnualPrice) :
                  parseFloat(plan.monthlyPrice);

                return (
                  <div key={plan.id} className={`border rounded-xl p-4 transition-colors ${isSamePlan ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>
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

      <CardComPayment
        open={!!paymentState}
        onOpenChange={(open) => { if (!open) setPaymentState(null); }}
        lowProfileId={paymentState?.lowProfileId || null}
        planName={paymentState?.planName || ''}
        amount={paymentState?.amount || 0}
        isIsrael={paymentState?.isIsrael}
        onSuccess={() => {
          setPaymentState(null);
          setShowChangePlan(false);
          toast({ title: t('success'), description: t('subscriptionActivated') });
          api.get('/subscriptions/current').then(setSubscription).catch(() => {});
        }}
        onError={(msg) => {
          toast({ title: t('error'), description: msg, variant: 'destructive' });
        }}
      />
    </>
  );
};

export default Settings;
