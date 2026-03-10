import { LegalPage } from '@/components/LegalPage';
import type { TranslationKey } from '@/lib/i18n';

const sections: ReadonlyArray<{ title: TranslationKey; content: TranslationKey }> = [
  { title: 'termsIntroTitle', content: 'termsIntroContent' },
  { title: 'termsServiceTitle', content: 'termsServiceContent' },
  { title: 'termsAccountsTitle', content: 'termsAccountsContent' },
  { title: 'termsAcceptableUseTitle', content: 'termsAcceptableUseContent' },
  { title: 'termsIntellectualPropertyTitle', content: 'termsIntellectualPropertyContent' },
  { title: 'termsDataPrivacyTitle', content: 'termsDataPrivacyContent' },
  { title: 'termsThirdPartyTitle', content: 'termsThirdPartyContent' },
  { title: 'termsDisclaimerTitle', content: 'termsDisclaimerContent' },
  { title: 'termsLiabilityTitle', content: 'termsLiabilityContent' },
  { title: 'termsGoverningLawTitle', content: 'termsGoverningLawContent' },
  { title: 'termsChangesTitle', content: 'termsChangesContent' },
  { title: 'termsContactTitle', content: 'termsContactContent' },
];

const TermsOfUsage = () => (
  <LegalPage titleKey="termsOfUsageTitle" lastUpdatedKey="termsLastUpdated" sections={sections} />
);

export default TermsOfUsage;
