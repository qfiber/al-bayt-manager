import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';


const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [require2FA, setRequire2FA] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const data = await api.get<{
          logoUrl?: string;
          turnstileEnabled?: boolean;
          turnstileSiteKey?: string;
        }>('/branding');

        if (data?.logoUrl) {
          setLogoUrl(data.logoUrl);
        }

        if (data?.turnstileEnabled && data?.turnstileSiteKey) {
          setTurnstileEnabled(true);
          setTurnstileSiteKey(data.turnstileSiteKey);
        }
      } catch (error) {
        console.log('Branding fetch error:', error);
      }
    };

    fetchBranding();
  }, []);

  useEffect(() => {
    // Only auto-navigate if not currently checking for 2FA
    if (!loading && user && !require2FA && !isLoading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate, require2FA, isLoading]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

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

      // Sign in with email and password
      const result = await auth.login(email, password);

      if (result.requires2FA && result.sessionToken) {
        // User has 2FA enabled — store session token and show 2FA form
        setSessionToken(result.sessionToken);
        setRequire2FA(true);
        setIsLoading(false);
      } else {
        // No 2FA — tokens are already stored by auth.login
        toast({
          title: t('success'),
          description: t('signedInSuccessfully'),
        });
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
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
          <CardTitle className="text-2xl font-bold">{t('buildingManagementSystem')}</CardTitle>
          <CardDescription>
            {t('signInToAccount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
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

              {turnstileEnabled && turnstileSiteKey && (
                <div className="space-y-2">
                  <Label>{t('captchaVerification')}</Label>
                  <div
                    className="flex justify-center items-center p-4 border rounded-lg bg-muted/20"
                    dir="ltr"
                  >
                    <Turnstile
                      siteKey={turnstileSiteKey}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={() => setTurnstileToken(null)}
                      onExpire={() => setTurnstileToken(null)}
                      options={{
                        theme: 'light',
                        size: 'normal',
                      }}
                    />
                  </div>
                </div>
              )}

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

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              {t('dontHaveAccount')}{' '}
              <a href="/register" className="text-primary hover:underline">
                {t('register')}
              </a>
            </p>
          </div>

          <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground">
            <p>
              {language === 'ar' ? 'تصميم شركة ' : language === 'he' ? 'מופעל על ידי ' : 'Powered by '}
              <a
                href="https://qfiber.co.il"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {language === 'ar' ? 'كيوفايبر' : language === 'he' ? 'qFiber בע״מ' : 'qFiber LTD'}
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
