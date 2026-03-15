import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';

const CARDCOM_IFRAME_BASE = 'https://secure.cardcom.solutions/api/openfields';
const CARDCOM_ORIGIN = 'https://secure.cardcom.solutions';

const FIELD_CSS = `
body { margin: 0; padding: 0; box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
input {
  border: 1px solid hsl(214.3 31.8% 80%);
  border-radius: 0.375rem;
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
input:focus {
  border-color: hsl(221.2 83.2% 53.3%);
  box-shadow: 0 0 0 2px hsla(221.2, 83.2%, 53.3%, 0.2);
}
input.invalid { border-color: hsl(0 84.2% 60.2%); }
`;

interface CardComPaymentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lowProfileId: string | null;
  planName: string;
  amount: number;
  currency?: string;
  isIsrael?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function CardComPayment({
  open, onOpenChange, lowProfileId, planName, amount, currency = '₪',
  isIsrael = false, onSuccess, onError,
}: CardComPaymentProps) {
  const { t, language } = useLanguage();
  const masterFrameRef = useRef<HTMLIFrameElement>(null);
  const [iframesReady, setIframesReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [idNumber, setIdNumber] = useState('');

  // Init iframes when lowProfileId is available
  useEffect(() => {
    if (!lowProfileId || !masterFrameRef.current || !open) return;

    const iframe = masterFrameRef.current;
    const initIframes = () => {
      iframe.contentWindow?.postMessage({
        action: 'init',
        cardFieldCSS: FIELD_CSS,
        cvvFieldCSS: FIELD_CSS,
        reCaptchaFieldCSS: 'body { margin: 0; }',
        placeholder: '4580 0000 0000 0000',
        cvvPlaceholder: '123',
        lowProfileCode: lowProfileId,
        language: language === 'he' ? 'he' : 'en',
      }, CARDCOM_ORIGIN);
      setIframesReady(true);
    };

    iframe.addEventListener('load', initIframes);
    try { initIframes(); } catch {}

    return () => iframe.removeEventListener('load', initIframes);
  }, [lowProfileId, open, language]);

  // Listen for payment results
  useEffect(() => {
    if (!open) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== CARDCOM_ORIGIN) return;
      const msg = event.data;
      if (!msg || !msg.action) return;

      if (msg.action === 'HandleSubmit') {
        if (msg.data?.IsSuccess) {
          setLoading(false);
          onSuccess();
        } else {
          setLoading(false);
          onError(msg.data?.Description || t('paymentFailed'));
        }
      } else if (msg.action === 'HandleEror') {
        setLoading(false);
        onError(msg.message || t('paymentFailed'));
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [open, onSuccess, onError, t]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIframesReady(false);
      setLoading(false);
      setName('');
      setEmail('');
      setExpMonth('');
      setExpYear('');
      setIdNumber('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterFrameRef.current?.contentWindow) return;

    setLoading(true);
    masterFrameRef.current.contentWindow.postMessage({
      action: 'doTransaction',
      cardOwnerId: idNumber || '000000000',
      cardOwnerName: name,
      cardOwnerEmail: email,
      expirationMonth: expMonth,
      expirationYear: expYear,
      cardOwnerPhone: '',
      numberOfPayments: '1',
    }, CARDCOM_ORIGIN);
  };

  const isRtl = language === 'he' || language === 'ar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {t('payment')}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm text-muted-foreground">{planName}</p>
          <p className="text-3xl font-bold mt-1">{currency}{amount.toFixed(2)}</p>
        </div>

        {/* Hidden master iframe */}
        <iframe
          ref={masterFrameRef}
          id="CardComMasterFrame"
          name="CardComMasterFrame"
          src={`${CARDCOM_IFRAME_BASE}/master`}
          style={{ display: 'block', width: 0, height: 0, border: 'none' }}
          title="Cardcom Master"
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t('cardNumber')}</Label>
            <iframe
              id="CardComCardNumber"
              name="CardComCardNumber"
              src={`${CARDCOM_IFRAME_BASE}/cardNumber`}
              className="w-full border-0 mt-1"
              style={{ height: 44 }}
              title="Card Number"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t('expiryMonth')}</Label>
              <Input
                placeholder="MM"
                maxLength={2}
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <Label>{t('expiryYear')}</Label>
              <Input
                placeholder="YY"
                maxLength={2}
                value={expYear}
                onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <Label>CVV</Label>
              <iframe
                id="CardComCvv"
                name="CardComCvv"
                src={`${CARDCOM_IFRAME_BASE}/CVV`}
                className="w-full border-0 mt-0"
                style={{ height: 40 }}
                title="CVV"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('cardholderName')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>{t('email')}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          {isIsrael && (
            <div>
              <Label>{t('idNumber')}</Label>
              <Input
                placeholder="000000000"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))}
                maxLength={9}
              />
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-base" disabled={!iframesReady || loading || !name || !email || !expMonth || !expYear}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('processing')}</>
            ) : (
              `${t('payNow')} ${currency}${amount.toFixed(2)}`
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            {t('securePayment')}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
