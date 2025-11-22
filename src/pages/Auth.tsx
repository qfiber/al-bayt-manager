import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building } from 'lucide-react';


const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [require2FA, setRequire2FA] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const { signIn, user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('logo_url')
        .maybeSingle();
      
      if (error) {
        console.log('Settings fetch error:', error);
        return;
      }
      
      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    };
    
    fetchSettings();
    
    // Subscribe to settings changes for real-time updates
    const channel = supabase
      .channel('settings-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'logo_url' in payload.new) {
            setLogoUrl(payload.new.logo_url as string);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
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
      // First, attempt to sign in with email and password
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (!session) {
        toast({
          title: t('error'),
          description: t('sessionNotFound'),
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Check if user has 2FA factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      console.log('MFA Factors:', factorsData);
      
      if (factorsError) {
        console.error('Error fetching factors:', factorsError);
      }
      
      const totpFactors = factorsData?.totp || [];
      
      // Check if user has any verified TOTP factors
      const hasVerifiedTotp = totpFactors.some(factor => factor.status === 'verified');
      
      console.log('Has verified TOTP:', hasVerifiedTotp);
      console.log('TOTP Factors:', totpFactors);
      
      // Use the official method to get the authentication assurance level
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const currentLevel = aalData?.currentLevel;
      const nextLevel = aalData?.nextLevel;
      
      console.log('Current AAL:', currentLevel);
      console.log('Next AAL:', nextLevel);
      
      // If user has verified 2FA factors and nextLevel suggests 2FA is needed
      // currentLevel: aal1 = password only, aal2 = password + 2FA
      // nextLevel: indicates what level can be achieved
      if (hasVerifiedTotp && currentLevel === 'aal1' && nextLevel === 'aal2') {
        // User has 2FA enabled but hasn't verified it yet in this session
        console.log('Requiring 2FA verification');
        setRequire2FA(true);
        setIsLoading(false);
      } else {
        // Either no 2FA or already verified
        console.log('Proceeding to dashboard');
        toast({
          title: t('success'),
          description: t('signedInSuccessfully'),
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: t('error'),
        description: t('errorDuringSignIn'),
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];

      if (!totpFactor) {
        throw new Error('No 2FA factor found');
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) {
        toast({
          title: t('error'),
          description: t('invalidVerificationCode'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('success'),
          description: t('signedInSuccessfully'),
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('2FA verification error:', error);
      toast({
        title: t('error'),
        description: t('errorDuringVerification'),
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
            <p>{t('footerPoweredByText')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
