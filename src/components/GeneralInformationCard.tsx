import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface GeneralInformationCardProps {
  id: string;
  title: string;
  text_1?: string;
  text_2?: string;
  text_3?: string;
  isAdmin: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const GeneralInformationCard = ({
  id,
  title,
  text_1,
  text_2,
  text_3,
  isAdmin,
  onEdit,
  onDelete,
}: GeneralInformationCardProps) => {
  const { dir } = useLanguage();
  const texts = [text_1, text_2, text_3].filter(Boolean) as string[];

  return (
    <Card className={`relative overflow-hidden hover:shadow-md transition-shadow border-s-4 border-s-primary/60`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-base font-semibold leading-tight truncate">{title}</h3>
        </div>
        {isAdmin && (
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(id)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(id)}
              className="h-7 w-7 text-destructive/70 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      {texts.length > 0 && (
        <CardContent className="px-5 pb-4 pt-1">
          <div className="space-y-1.5">
            {texts.map((text, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
