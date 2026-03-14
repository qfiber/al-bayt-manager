import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { api, auth } from '@/lib/api';
import { type PowProgress } from '@/lib/pow';
import { AuthHeader } from '@/components/AuthHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building, Shield } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useSubdomain } from '@/contexts/SubdomainContext';
import { LegalFooter } from '@/components/LegalFooter';
import { CaptchaField } from '@/components/CaptchaField';


const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [powActive, setPowActive] = useState(false);
  const [powHash, setPowHash] = useState('');
  const [powDone, setPowDone] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');
  const [resetLoading, setResetLoading] = useState(false);
  const hashContainerRef = useRef<HTMLDivElement>(null);
  const { user, loading, refreshUser } = useAuth();
  const { t } = useLanguage();
  const { logoUrl, companyName, turnstileEnabled, registrationEnabled } = usePublicSettings();
  const { subdomainOrg } = useSubdomain();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Only auto-navigate if not currently checking for 2FA
    if (!loading && user && !require2FA && !isLoading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate, require2FA, isLoading]);

  // Auto-scroll hash container to bottom
  useEffect(() => {
    if (hashContainerRef.current) {
      hashContainerRef.current.scrollTop = hashContainerRef.current.scrollHeight;
    }
  }, [powHash]);

  const handlePowProgress = (p: PowProgress) => {
    setPowHash(p.hash);
    if (p.done) setPowDone(true);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPowActive(false);
    setPowDone(false);
    setPowHash('');

    try {
      // Verify CAPTCHA if enabled
      if (turnstileEnabled && !turnstileToken) {
        toast({
          title: t('error'),
          description: t('captchaRequired'),
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (turnstileEnabled && turnstileToken) {
        try {
          const verifyData = await api.post<{ success: boolean }>('/captcha/verify', { token: turnstileToken });

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
        } catch {
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

      // Show PoW overlay
      setPowActive(true);

      // Sign in with email and password (with PoW progress)
      const result = await auth.login(email, password, handlePowProgress);

      if (result.requires2FA && result.sessionToken) {
        // User has 2FA enabled — store session token and show 2FA form
        setPowActive(false);
        setSessionToken(result.sessionToken);
        setRequire2FA(true);
        setIsLoading(false);
      } else {
        // No 2FA — cookies set by server
        await refreshUser();
        toast({
          title: t('success'),
          description: t('signedInSuccessfully'),
        });
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      setPowActive(false);
      toast({
        title: t('error'),
        description: error?.message || t('errorDuringSignIn'),
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!sessionToken) {
        throw new Error('No 2FA session found');
      }

      await auth.login2FA(sessionToken, verificationCode);
      await refreshUser();

      toast({
        title: t('success'),
        description: t('signedInSuccessfully'),
      });
      navigate('/dashboard');
    } catch (error: any) {
      console.error('2FA verification error:', error);
      toast({
        title: t('error'),
        description: error?.message || t('errorDuringVerification'),
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleRequestReset = async () => {
    if (!resetEmail) return;
    setResetLoading(true);
    try {
      const result = await api.post<{ token?: string }>('/auth/request-password-reset', { email: resetEmail });
      if (result.token) setResetToken(result.token);
      setResetStep('code');
      toast({ title: t('success'), description: t('resetCodeSent') });
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally { setResetLoading(false); }
  };

  const handleConfirmReset = async () => {
    if (!resetCode || !newPassword) return;
    setResetLoading(true);
    try {
      await api.post('/auth/confirm-password-reset', { token: resetToken, code: resetCode, newPassword });
      toast({ title: t('success'), description: t('passwordResetSuccess') });
      setResetMode(false);
      setResetStep('email');
      setResetEmail('');
      setResetCode('');
      setNewPassword('');
      setResetToken('');
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally { setResetLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <AuthHeader />
      <div className="w-full max-w-md pt-14">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher />
        </div>
      <Card className="w-full relative overflow-hidden">
        {/* PoW Overlay */}
        {powActive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6 animate-in fade-in duration-300">
            <Shield className="w-10 h-10 text-primary mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold mb-4">{t('securingConnection')}</h3>
            <div
              ref={hashContainerRef}
              className="w-full max-h-[3.75em] overflow-hidden rounded-lg bg-muted/50 border p-3 font-mono text-xs leading-[1.25em] break-all text-center"
              dir="ltr"
            >
              {powHash && (
                <span className={powDone ? 'text-green-500 font-bold' : 'text-muted-foreground'}>
                  {powHash}
                </span>
              )}
            </div>
          </div>
        )}

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
          <CardTitle className="text-2xl font-bold">{subdomainOrg?.name || companyName || t('buildingManagementSystem')}</CardTitle>
          <CardDescription>
            {t('signInToAccount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!resetMode ? (
            <>
              {!require2FA ? (
                <form onSubmit={handleSignIn} className="space-y-4">
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
                    <Label htmlFor="password">{t('password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <CaptchaField onToken={setTurnstileToken} />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? t('signingIn') : t('signInButton')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">{t('twoFactorAuthCode')}</Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      required
                      disabled={isLoading}
                      maxLength={6}
                      pattern="[0-9]{6}"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('enterSixDigitCode')}
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? t('verifying') : t('verify')}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setRequire2FA(false);
                      setVerificationCode('');
                      setSessionToken(null);
                    }}
                  >
                    {t('back')}
                  </Button>
                </form>
              )}

              <button type="button" onClick={() => setResetMode(true)} className="text-xs text-primary hover:underline mt-2 block w-full text-center">
                {t('forgotPassword')}
              </button>

              {registrationEnabled && (
                <div className="mt-6 text-center text-sm">
                  <p className="text-muted-foreground">
                    {t('dontHaveAccount')}{' '}
                    <Link to="/register" className="text-primary hover:underline">
                      {t('register')}
                    </Link>
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <button type="button" onClick={() => { setResetMode(false); setResetStep('email'); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                &larr; {t('backToLogin')}
              </button>
              <h3 className="font-semibold text-lg">{t('resetPassword')}</h3>
              {resetStep === 'email' ? (
                <div className="space-y-3">
                  <div>
                    <Label>{t('email')}</Label>
                    <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                  <Button onClick={handleRequestReset} disabled={resetLoading || !resetEmail} className="w-full">
                    {resetLoading ? t('loading') : t('sendResetCode')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t('resetCodeSentTo').replace('{email}', resetEmail)}</p>
                  <div>
                    <Label>{t('verificationCode')}</Label>
                    <Input value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="text-center text-xl tracking-widest" />
                  </div>
                  <div>
                    <Label>{t('newPassword')}</Label>
                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={16} />
                    <p className="text-xs text-muted-foreground mt-1">{t('passwordMinLength')}</p>
                  </div>
                  <Button onClick={handleConfirmReset} disabled={resetLoading || resetCode.length !== 6 || newPassword.length < 16} className="w-full">
                    {resetLoading ? t('loading') : t('resetPassword')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <LegalFooter variant="centered" />
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Auth;
