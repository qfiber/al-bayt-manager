import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, Send, Mail, Globe, CheckCircle } from 'lucide-react';

const Contact = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setLoading(true);
    try {
      await api.post('/contact', { name, email, message });
      setSent(true);
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Al-Bayt</span>
          </a>
          <Button variant="ghost" onClick={() => navigate('/login')}>{t('signIn')}</Button>
        </div>
      </header>

      <section className="py-20 sm:py-28">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">{t('contactFormTitle')}</h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{t('contactFormDesc')}</p>
          </div>

          {sent ? (
            <div className="text-center py-16">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('thankYou')}</h2>
              <p className="text-gray-600 dark:text-gray-300">{t('contactSuccess')}</p>
              <Button variant="outline" onClick={() => navigate('/')} className="mt-8">{t('returnToHome')}</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="contactName" className="text-sm font-medium">{t('yourName')}</Label>
                <Input id="contactName" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="contactEmail" className="text-sm font-medium">{t('yourEmail')}</Label>
                <Input id="contactEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="contactMessage" className="text-sm font-medium">{t('contactMessage')}</Label>
                <Textarea id="contactMessage" value={message} onChange={(e) => setMessage(e.target.value)} required rows={6} className="mt-1 rounded-xl" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl py-3 gap-2">
                <Send className="w-4 h-4" />
                {loading ? t('loading') : t('sendContactForm')}
              </Button>
            </form>
          )}

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
              <Mail className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('email')}</p>
                <p className="text-sm text-gray-500">info@albayt.cloud</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
              <Globe className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('website')}</p>
                <p className="text-sm text-gray-500">albayt.cloud</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
