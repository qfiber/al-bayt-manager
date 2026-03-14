import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { api, auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building, ShieldX, Mail } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LegalFooter } from '@/components/LegalFooter';
import { CaptchaField } from '@/components/CaptchaField';
import { getBaseDomain } from '@/lib/subdomain';
import { AuthHeader } from '@/components/AuthHeader';


const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSubdomain, setOrganizationSubdomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { signUp, user, loading } = useAuth();
  const { t } = useLanguage();
  const { logoUrl, companyName, turnstileEnabled, registrationEnabled } = usePublicSettings();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !name || !phone) {
      toast({
        title: t('error'),
        description: t('fillAllRequiredFields'),
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 16) {
      toast({
        title: t('error'),
        description: t('passwordMinLengthError'),
        variant: 'destructive',
      });
      return;
    }

    // Verify CAPTCHA if enabled
    if (turnstileEnabled && !turnstileToken) {
      toast({
        title: t('error'),
        description: t('captchaRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (turnstileEnabled && turnstileToken) {
        const verifyData = await api.post('/captcha/verify', { token: turnstileToken });

        if (!verifyData?.success) {
          toast({
            title: t('error'),
            description: t('captchaVerificationFailed'),
            variant: 'destructive',
          });
          setIsLoading(false);
          setTurnstileToken(null);
          return;
        }
      }
      const { error, requiresVerification, verificationToken: token } = await signUp(email, password, name, phone, organizationName || undefined, organizationSubdomain || undefined);

      if (requiresVerification && token) {
        setVerificationToken(token);
        setVerificationMode(true);
        toast({ title: t('success'), description: t('verificationEmailSent') });
      } else if (error) {
        toast({
          title: t('error'),
          description: error.message || error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('success'),
          description: t('accountCreatedSuccess'),
        });
        // AuthContext.signUp auto-logs in and navigates to /dashboard
      }
    } catch (error) {
      console.error('Sign up error:', error);
      toast({
        title: t('error'),
        description: t('registrationError'),
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await api.post('/auth/verify-email', { token: verificationToken, code: verificationCode });
      toast({ title: t('success'), description: t('emailVerified') });
      // Now auto-login
      const loginResult = await auth.login(email, password);
      if (!loginResult.requires2FA) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    try {
      const result = await api.post('/auth/resend-verification', { token: verificationToken });
      if (result.token) setVerificationToken(result.token);
      toast({ title: t('success'), description: t('verificationCodeResent') });
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12 sm:py-20 px-4">
      <div className="w-full max-w-md">

      <Card className="w-full">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {logoUrl ? (
              <div className="max-w-[200px] max-h-[120px] flex items-center justify-center">
                <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-primary/10">
                <Building className="w-10 h-10 text-primary" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold">{companyName || t('buildingManagementSystem')}</CardTitle>
          <CardDescription>
            {registrationEnabled ? t('createNewAccount') : t('registrationClosed')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrationEnabled ? (
            <>
              {verificationMode ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <Mail className="w-12 h-12 text-primary mx-auto mb-3" />
                    <h3 className="font-semibold text-lg">{t('verifyYourEmail')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t('verificationCodeSentTo').replace('{email}', email)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('verificationCode')}</Label>
                    <Input
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-widest"
                      maxLength={6}
                    />
                  </div>
                  <Button onClick={handleVerify} disabled={verifying || verificationCode.length !== 6} className="w-full">
                    {verifying ? t('loading') : t('verifyEmail')}
                  </Button>
                  <Button variant="ghost" onClick={handleResendCode} className="w-full text-sm">
                    {t('resendVerificationCode')}
                  </Button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t('name')}</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder={t('fullName')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{t('email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">{t('phone')}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder={t('phone')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organizationName">{t('organizationName')}</Label>
                      <Input
                        id="organizationName"
                        type="text"
                        placeholder={t('organizationNamePlaceholder')}
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">{t('organizationNameHelp')}</p>
                    </div>

                    {organizationName && (
                      <div className="space-y-2">
                        <Label htmlFor="organizationSubdomain">{t('subdomain')}</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            id="organizationSubdomain"
                            type="text"
                            value={organizationSubdomain}
                            onChange={(e) => setOrganizationSubdomain(
                              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
                            )}
                            disabled={isLoading}
                            placeholder="my-company"
                            maxLength={32}
                            className="flex-1"
                            dir="ltr"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">.{getBaseDomain()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('subdomainRegisterHelp')}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="password">{t('password')}</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={16}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('passwordMinLength')}
                      </p>
                    </div>

                    <CaptchaField onToken={setTurnstileToken} />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? t('creatingAccount') : t('createAccount')}
                    </Button>
                  </form>

                  <div className="mt-6 text-center text-sm">
                    <p className="text-muted-foreground">
                      {t('alreadyHaveAccount')}{' '}
                      <Link to="/login" className="text-primary hover:underline">
                        {t('signIn')}
                      </Link>
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <ShieldX className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                {t('registrationClosedDesc')}
              </p>
              <Link to="/login">
                <Button variant="outline" className="mt-2">
                  {t('signIn')}
                </Button>
              </Link>
            </div>
          )}

          <LegalFooter variant="centered" />
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Register;
