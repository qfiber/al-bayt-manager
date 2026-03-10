import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Turnstile } from '@marsidev/react-turnstile';

interface CaptchaFieldProps {
  onToken: (token: string | null) => void;
}

export const CaptchaField = ({ onToken }: CaptchaFieldProps) => {
  const { turnstileEnabled, turnstileSiteKey } = usePublicSettings();
  const { t } = useLanguage();

  if (!turnstileEnabled || !turnstileSiteKey) return null;

  return (
    <div className="space-y-2">
      <Label>{t('captchaVerification')}</Label>
      <div
        className="flex justify-center items-center p-4 border rounded-lg bg-muted/20"
        dir="ltr"
      >
        <Turnstile
          siteKey={turnstileSiteKey}
          onSuccess={(token) => onToken(token)}
          onError={() => onToken(null)}
          onExpire={() => onToken(null)}
          options={{
            theme: 'light',
            size: 'normal',
          }}
        />
      </div>
    </div>
  );
};
