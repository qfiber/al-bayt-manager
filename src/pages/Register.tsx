import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';


const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const { signUp, user, loading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const data = await api.get('/branding');

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

    if (password.length < 8) {
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
      const { error } = await signUp(email, password, name, phone);

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('success'),
          description: t('accountCreatedSuccess'),
        });
        navigate('/auth');
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
            {t('createNewAccount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                {t('passwordMinLength')}
              </p>
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
              {isLoading ? t('creatingAccount') : t('createAccount')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              {t('alreadyHaveAccount')}{' '}
              <a href="/auth" className="text-primary hover:underline">
                {t('signIn')}
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

export default Register;
