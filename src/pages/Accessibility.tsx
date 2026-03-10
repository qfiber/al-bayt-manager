import { LegalPage } from '@/components/LegalPage';
import type { TranslationKey } from '@/lib/i18n';

const sections: ReadonlyArray<{ title: TranslationKey; content: TranslationKey }> = [
  { title: 'a11yCommitmentTitle', content: 'a11yCommitmentContent' },
  { title: 'a11yStandardsTitle', content: 'a11yStandardsContent' },
  { title: 'a11yFeaturesTitle', content: 'a11yFeaturesContent' },
  { title: 'a11yLimitationsTitle', content: 'a11yLimitationsContent' },
  { title: 'a11yThirdPartyTitle', content: 'a11yThirdPartyContent' },
  { title: 'a11yFeedbackTitle', content: 'a11yFeedbackContent' },
];

const Accessibility = () => (
  <LegalPage titleKey="accessibilityTitle" lastUpdatedKey="accessibilityLastUpdated" sections={sections} />
);

export default Accessibility;
