import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import type { TranslationKey } from '@/lib/i18n';

interface LegalPageProps {
  titleKey: TranslationKey;
  lastUpdatedKey: TranslationKey;
  sections: ReadonlyArray<{ title: TranslationKey; content: TranslationKey }>;
}

export const LegalPage = ({ titleKey, lastUpdatedKey, sections }: LegalPageProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />
            {t('back')}
          </Button>
          <LanguageSwitcher />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t(titleKey)}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(lastUpdatedKey)}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {sections.map(({ title, content }) => (
              <section key={title}>
                <h2 className="text-lg font-semibold mb-2">{t(title)}</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {t(content)}
                </p>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
