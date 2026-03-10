import { useLanguage } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Building } from '@/lib/types';

interface BuildingFilterProps {
  buildings: Building[];
  value: string;
  onChange: (value: string) => void;
}

export const BuildingFilter = ({ buildings, value, onChange }: BuildingFilterProps) => {
  const { t } = useLanguage();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={t('filterByBuilding')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('allBuildings')}</SelectItem>
        {buildings.map((building) => (
          <SelectItem key={building.id} value={building.id}>
            {building.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
