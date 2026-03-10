import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

interface LegalFooterProps {
  variant: 'centered' | 'spread';
}

export const LegalFooter = ({ variant }: LegalFooterProps) => {
  const { t } = useLanguage();

  if (variant === 'centered') {
    return (
      <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground space-y-1.5">
        <p>
          {t('footerPoweredBy')}{' '}
          <a
            href="https://qfiber.co.il"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            qFiber LTD
          </a>
        </p>
        <p className="flex items-center justify-center gap-2 flex-wrap">
          <Link to="/terms" className="text-primary hover:underline">
            {t('termsOfUsage')}
          </Link>
          <span className="text-muted-foreground">&middot;</span>
          <Link to="/privacy-policy" className="text-primary hover:underline">
            {t('privacyPolicy')}
          </Link>
          <span className="text-muted-foreground">&middot;</span>
          <Link to="/accessibility" className="text-primary hover:underline">
            {t('accessibility')}
          </Link>
        </p>
      </div>
    );
  }

  // variant === 'spread'
  return (
    <>
      <span>
        {t('footerPoweredBy')}{' '}
        <a
          href="https://qfiber.co.il"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          qFiber LTD
        </a>
      </span>
      <nav className="flex items-center gap-3">
        <Link to="/terms" className="text-primary hover:underline">
          {t('termsOfUsage')}
        </Link>
        <span className="text-muted-foreground">&middot;</span>
        <Link to="/privacy-policy" className="text-primary hover:underline">
          {t('privacyPolicy')}
        </Link>
        <span className="text-muted-foreground">&middot;</span>
        <Link to="/accessibility" className="text-primary hover:underline">
          {t('accessibility')}
        </Link>
      </nav>
    </>
  );
};
