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
import { Building, AlertCircle } from 'lucide-react';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [usersExist, setUsersExist] = useState<boolean | null>(null);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const { signIn, user, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('logo_url, turnstile_site_key')
        .maybeSingle();
      
      if (error) {
        console.log('Settings fetch error:', error);
        return;
      }
      
      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
      
      if (data?.turnstile_site_key) {
        setTurnstileSiteKey(data.turnstile_site_key);
      }
    };
    
    const checkUsersExist = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-users-exist');
        
        if (error) {
          console.error('Error checking users:', error);
          setUsersExist(true); // Assume users exist on error
          return;
        }
        
        setUsersExist(data.usersExist);
        setIsSignUpMode(!data.usersExist);
      } catch (error) {
        console.error('Error checking users:', error);
        setUsersExist(true);
      }
    };
    
    fetchSettings();
    checkUsersExist();
    
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
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast({
        title: 'Error',
        description: 'Please complete the CAPTCHA verification',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Verify Turnstile token
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-turnstile', {
        body: { token: turnstileToken },
      });

      if (verifyError || !verifyData?.success) {
        toast({
          title: 'Error',
          description: 'CAPTCHA verification failed. Please try again.',
          variant: 'destructive',
        });
        setTurnstileToken('');
        setIsLoading(false);
        return;
      }

      // Proceed with sign in
      const { error } = await signIn(email, password);

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
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
      console.error('Sign in error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during sign in',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleFirstUserSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast({
        title: 'Error',
        description: 'Please complete the CAPTCHA verification',
        variant: 'destructive',
      });
      return;
    }

    if (!email || !password || !name) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('register-first-user', {
        body: { 
          email, 
          password, 
          name, 
          phone,
          turnstileToken 
        },
      });

      if (error || !data?.success) {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to create user',
          variant: 'destructive',
        });
        setTurnstileToken('');
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Success',
        description: 'Admin user created successfully! Please sign in.',
      });

      // Switch to sign in mode and auto-login
      setIsSignUpMode(false);
      setUsersExist(true);
      
      // Auto sign in
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        toast({
          title: 'Please sign in',
          description: 'User created successfully. Please sign in.',
        });
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Sign up error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during registration',
        variant: 'destructive',
      });
      setTurnstileToken('');
    }

    setIsLoading(false);
  };

  if (loading || usersExist === null) {
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
            {isSignUpMode ? 'Create First Admin Account' : t('signInToAccount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSignUpMode && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No users found in the system. Create the first admin account to get started.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={isSignUpMode ? handleFirstUserSignUp : handleSignIn} className="space-y-4">
            {isSignUpMode && (
              <div className="space-y-2">
                <Label htmlFor="name">{t('name')}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {isSignUpMode && (
              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                />
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
                minLength={8}
              />
              {isSignUpMode && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            {turnstileSiteKey && (
              <div className="space-y-2">
                <Label>Verification</Label>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onVerify={(token) => setTurnstileToken(token)}
                  onError={() => {
                    setTurnstileToken('');
                    toast({
                      title: 'Error',
                      description: 'CAPTCHA verification failed',
                      variant: 'destructive',
                    });
                  }}
                  onExpire={() => setTurnstileToken('')}
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !turnstileToken}
            >
              {isLoading 
                ? (isSignUpMode ? 'Creating Account...' : t('signingIn'))
                : (isSignUpMode ? 'Create Admin Account' : t('signInButton'))
              }
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>{t('needAccountContact')}</p>
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
