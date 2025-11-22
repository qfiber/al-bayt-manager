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
    if (!loading && user && !require2FA) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate, require2FA]);

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
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (!session) {
        toast({
          title: 'Error',
          description: 'Session not found',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Check if user has 2FA factors
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactors = factorsData?.totp || [];
      
      // Check if user has any verified TOTP factors
      const hasVerifiedTotp = totpFactors.some(factor => factor.status === 'verified');
      
      // Check the Authentication Assurance Level from the session
      const sessionAal = (session as any)?.aal;
      
      // If user has verified 2FA factors and session is only aal1 (password only), 
      // or if we can't determine AAL but have verified factors, require 2FA verification
      if (hasVerifiedTotp && (!sessionAal || sessionAal === 'aal1')) {
        setRequire2FA(true);
        setIsLoading(false);
      } else if (!hasVerifiedTotp) {
        // No 2FA enabled, proceed normally
        toast({
          title: 'Success',
          description: 'Signed in successfully',
        });
        navigate('/dashboard');
      } else {
        // 2FA already verified (aal2)
        toast({
          title: 'Success',
          description: 'Signed in successfully',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during sign in',
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
          title: 'Error',
          description: 'Invalid verification code',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Signed in successfully',
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('2FA verification error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during verification',
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
                <Label htmlFor="code">Two-Factor Authentication Code</Label>
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
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? 'Verifying...' : 'Verify'}
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
                Back
              </Button>
            </form>
          )}
          
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <a href="/register" className="text-primary hover:underline">
                Register
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
