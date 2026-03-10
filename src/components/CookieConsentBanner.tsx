import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

const STORAGE_KEY = 'cookie_consent_acknowledged';

export const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  useEffect(() => {
    const acknowledged = localStorage.getItem(STORAGE_KEY);
    if (!acknowledged) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 p-4 ${isMobile ? 'mb-16' : ''}`}
    >
      <div className="mx-auto max-w-3xl rounded-lg border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-muted-foreground">
            <p>{t('cookieBannerText')}</p>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <Link
                to="/privacy-policy"
                className="text-primary hover:underline font-medium"
              >
                {t('privacyPolicy')}
              </Link>
              <Link
                to="/terms"
                className="text-primary hover:underline font-medium"
              >
                {t('termsOfUsage')}
              </Link>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismiss}
            className="shrink-0"
          >
            {t('cookieAccept')}
          </Button>
        </div>
      </div>
    </div>
  );
};
