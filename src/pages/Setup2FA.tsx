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
import { QrCode, Shield } from 'lucide-react';

const Setup2FA = () => {
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [factorId, setFactorId] = useState<string>('');
  const [has2FA, setHas2FA] = useState(false);
  const [showDisableVerification, setShowDisableVerification] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    checkExisting2FA();
  }, [user, navigate]);

  const checkExisting2FA = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.totp && factors.totp.length > 0) {
        setHas2FA(true);
      }
    } catch (error) {
      console.error('Error checking 2FA status:', error);
    }
  };

  const handleEnroll = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);

      toast({
        title: t('success'),
        description: t('scanQRWithApp'),
      });
    } catch (error) {
      console.error('Enrollment error:', error);
      toast({
        title: t('error'),
        description: t('failedToStart2FASetup'),
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (error) {
        toast({
          title: t('error'),
          description: t('invalidVerificationCode'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('success'),
          description: t('twoFactorEnabledSuccess'),
        });
        navigate('/settings');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: t('error'),
        description: t('failedToVerifyCode'),
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];

      if (!totpFactor) {
        throw new Error(t('no2FAFactorFound'));
      }

      // First, verify with 2FA to get AAL2
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
        setIsLoading(false);
        return;
      }

      // Now unenroll with AAL2 authentication
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id,
      });

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('twoFactorDisabledSuccess'),
      });
      setHas2FA(false);
      setShowDisableVerification(false);
      setVerificationCode('');
      navigate('/settings');
    } catch (error) {
      console.error('Disable 2FA error:', error);
      toast({
        title: t('error'),
        description: t('failedToDisable2FA'),
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Shield className="w-10 h-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('twoFactorAuth')}</CardTitle>
          <CardDescription>
            {has2FA 
              ? t('accountProtectedWith2FA')
              : t('addExtraSecurityLayer')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {has2FA ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  {t('twoFactorCurrentlyEnabled')}
                </p>
              </div>
              
              {showDisableVerification ? (
                <form onSubmit={handleDisable2FA} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="disable-code">{t('verificationCode')}</Label>
                    <Input
                      id="disable-code"
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
                      {t('enterCodeToConfirm')}
                    </p>
                  </div>
                  <Button 
                    type="submit"
                    variant="destructive"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? t('disabling') : t('confirmDisable2FA')}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full" 
                    onClick={() => {
                      setShowDisableVerification(false);
                      setVerificationCode('');
                    }}
                    disabled={isLoading}
                  >
                    {t('cancel')}
                  </Button>
                </form>
              ) : (
                <>
                  <Button 
                    variant="destructive"
                    className="w-full" 
                    onClick={() => setShowDisableVerification(true)}
                    disabled={isLoading}
                  >
                    {t('disable2FA')}
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full" 
                    onClick={() => navigate('/settings')}
                  >
                    {t('backToSettings')}
                  </Button>
                </>
              )}
            </div>
          ) : qrCode ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('manualEntryCode')}</Label>
                  <Input
                    type="text"
                    value={secret}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('useCodeIfCantScan')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">{t('verificationCode')}</Label>
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
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? t('verifying') : t('enable2FA')}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">{t('howToSetup2FA')}</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>{t('installAuthApp')}</li>
                  <li>{t('clickStartSetup')}</li>
                  <li>{t('scanQRCode')}</li>
                  <li>{t('enterCodeToVerify')}</li>
                </ol>
              </div>

              <Button 
                className="w-full" 
                onClick={handleEnroll}
                disabled={isLoading}
              >
                <QrCode className="w-4 h-4 mr-2" />
                {isLoading ? t('settingUp') : t('startSetup')}
              </Button>

              <Button 
                variant="outline"
                className="w-full" 
                onClick={() => navigate('/settings')}
              >
                {t('cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Setup2FA;
