import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GeneralInformationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  informationId?: string;
  onSuccess: () => void;
}

export const GeneralInformationDialog = ({
  open,
  onOpenChange,
  informationId,
  onSuccess,
}: GeneralInformationDialogProps) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    text_1: '',
    text_2: '',
    text_3: '',
  });

  useEffect(() => {
    if (informationId && open) {
      fetchInformation();
    } else if (!open) {
      setFormData({ title: '', text_1: '', text_2: '', text_3: '' });
      setIsDirty(false);
    }
  }, [informationId, open]);

  const fetchInformation = async () => {
    const { data, error } = await supabase
      .from('general_information')
      .select('*')
      .eq('id', informationId)
      .single();

    if (error) {
      toast.error(t('error'));
      return;
    }

    setFormData({
      title: data.title || '',
      text_1: data.text_1 || '',
      text_2: data.text_2 || '',
      text_3: data.text_3 || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (informationId) {
        const { error } = await supabase
          .from('general_information')
          .update(formData)
          .eq('id', informationId);

        if (error) throw error;
        toast.success(t('updateSuccess'));
      } else {
        const { error } = await supabase
          .from('general_information')
          .insert([formData]);

        if (error) throw error;
        toast.success(t('addSuccess'));
      }

      setIsDirty(false);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      setShowCloseWarning(true);
    } else {
      onOpenChange(false);
    }
  };

  const confirmClose = () => {
    setShowCloseWarning(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    setIsDirty(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {informationId ? t('editInformation') : t('addInformation')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('informationTitle')} *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text_1">{t('informationText1')}</Label>
              <Textarea
                id="text_1"
                value={formData.text_1}
                onChange={(e) => handleInputChange('text_1', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text_2">{t('informationText2')}</Label>
              <Textarea
                id="text_2"
                value={formData.text_2}
                onChange={(e) => handleInputChange('text_2', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text_3">{t('informationText3')}</Label>
              <Textarea
                id="text_3"
                value={formData.text_3}
                onChange={(e) => handleInputChange('text_3', e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('loading') : t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedChanges')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unsavedChangesWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('stayOnPage')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>{t('discardChanges')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
