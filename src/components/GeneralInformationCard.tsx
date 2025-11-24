import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-lg font-semibold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
          {title}
        </CardTitle>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(id)}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {text_1 && <p className="text-sm text-muted-foreground">{text_1}</p>}
        {text_2 && <p className="text-sm text-muted-foreground">{text_2}</p>}
        {text_3 && <p className="text-sm text-muted-foreground">{text_3}</p>}
      </CardContent>
    </Card>
  );
};
