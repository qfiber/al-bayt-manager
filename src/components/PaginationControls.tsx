import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

interface PaginationControlsProps {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export const PaginationControls = ({
  page,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: PaginationControlsProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between mt-4">
      <Button variant="outline" size="sm" disabled={!hasPrevious} onClick={onPrevious}>
        {t('previous')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t('page')} {page}
      </span>
      <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext}>
        {t('next')}
      </Button>
    </div>
  );
};
