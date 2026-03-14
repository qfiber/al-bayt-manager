import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TranslationKey } from '@/lib/i18n';

interface LegalPageProps {
  titleKey: TranslationKey;
  lastUpdatedKey: TranslationKey;
  sections: ReadonlyArray<{ title: TranslationKey; content: TranslationKey }>;
}

export const LegalPage = ({ titleKey, lastUpdatedKey, sections }: LegalPageProps) => {
  const { t } = useLanguage();

  return (
    <div className="py-12 sm:py-20 px-4">
      <div className="mx-auto max-w-2xl">
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
