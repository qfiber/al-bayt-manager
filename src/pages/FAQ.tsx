import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown } from 'lucide-react';

const FAQ = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
    { q: t('faq6Q'), a: t('faq6A') },
    { q: t('faq7Q'), a: t('faq7A') },
    { q: t('faq8Q'), a: t('faq8A') },
  ];

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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">{t('faqTitle')}</h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{t('faqSubtitle')}</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-start hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${openIndex === i ? 'rotate-180' : ''}`} />
                </button>
                {openIndex === i && (
                  <div className="px-5 pb-5 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-500 mb-4">{t('stillHaveQuestions')}</p>
            <Button onClick={() => navigate('/contact')} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              {t('contactUs')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FAQ;
