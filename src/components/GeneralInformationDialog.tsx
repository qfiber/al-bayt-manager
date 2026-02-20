import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
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
    text1: '',
    text2: '',
    text3: '',
  });

  useEffect(() => {
    if (informationId && open) {
      fetchInformation();
    } else if (!open) {
      setFormData({ title: '', text1: '', text2: '', text3: '' });
      setIsDirty(false);
    }
  }, [informationId, open]);

  const fetchInformation = async () => {
    try {
      const items = await api.get('/general-info');
      const data = items.find((item: any) => item.id === informationId);
      if (data) {
        setFormData({
          title: data.title || '',
          text1: data.text1 || '',
          text2: data.text2 || '',
          text3: data.text3 || '',
        });
      }
    } catch {
      toast.error(t('error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (informationId) {
        await api.put(`/general-info/${informationId}`, formData);
        toast.success(t('updateSuccess'));
      } else {
        await api.post('/general-info', formData);
        toast.success(t('addSuccess'));
      }

      setIsDirty(false);
      onSuccess();
      onOpenChange(false);
    } catch {
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
              <Label htmlFor="text1">{t('informationText1')}</Label>
              <Textarea
                id="text1"
                value={formData.text1}
                onChange={(e) => handleInputChange('text1', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text2">{t('informationText2')}</Label>
              <Textarea
                id="text2"
                value={formData.text2}
                onChange={(e) => handleInputChange('text2', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text3">{t('informationText3')}</Label>
              <Textarea
                id="text3"
                value={formData.text3}
                onChange={(e) => handleInputChange('text3', e.target.value)}
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
