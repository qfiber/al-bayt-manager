import { LegalPage } from '@/components/LegalPage';
import type { TranslationKey } from '@/lib/i18n';

const sections: ReadonlyArray<{ title: TranslationKey; content: TranslationKey }> = [
  { title: 'privacyIntroTitle', content: 'privacyIntroContent' },
  { title: 'privacyDataCollectedTitle', content: 'privacyDataCollectedContent' },
  { title: 'privacyCookiesTitle', content: 'privacyCookiesContent' },
  { title: 'privacyThirdPartiesTitle', content: 'privacyThirdPartiesContent' },
  { title: 'privacyRetentionTitle', content: 'privacyRetentionContent' },
  { title: 'privacyUserRightsTitle', content: 'privacyUserRightsContent' },
  { title: 'privacySecurityTitle', content: 'privacySecurityContent' },
  { title: 'privacyContactTitle', content: 'privacyContactContent' },
  { title: 'privacyChangesTitle', content: 'privacyChangesContent' },
];

const PrivacyPolicy = () => (
  <LegalPage titleKey="privacyPolicyTitle" lastUpdatedKey="privacyLastUpdated" sections={sections} />
);

export default PrivacyPolicy;
