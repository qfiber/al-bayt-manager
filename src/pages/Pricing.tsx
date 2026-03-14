import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Building2, Check, ArrowRight } from 'lucide-react';

interface Plan {
  id: string; name: string; slug: string;
  maxBuildings: number; maxApartmentsPerBuilding: number;
  monthlyPrice: string; semiAnnualPrice: string | null; yearlyPrice: string | null;
  isCustom: boolean; isActive: boolean;
}

const Pricing = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    api.get<Plan[]>('/subscriptions/plans').then(data => setPlans((data || []).filter(p => p.isActive))).catch(() => {});
  }, []);

  const getPrice = (plan: Plan) => {
    if (plan.isCustom) return t('contactUs');
    if (cycle === 'yearly' && plan.yearlyPrice) return `₪${parseFloat(plan.yearlyPrice).toLocaleString()}`;
    return `₪${parseFloat(plan.monthlyPrice).toLocaleString()}`;
  };

  const getPeriod = (plan: Plan) => {
    if (plan.isCustom) return '';
    return cycle === 'yearly' ? `/ ${t('yearly').toLowerCase()}` : `/ ${t('monthly').toLowerCase()}`;
  };

  const allFeatures = [
    t('landingFeatureBuildings'), t('landingFeaturePayments'), t('landingFeatureReports'),
    t('landingFeatureTenants'), t('landingFeatureMaintenance'), t('landingFeatureDocuments'),
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">{t('pricingTitle')}</h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{t('pricingSubtitle')}</p>

            {/* Cycle toggle */}
            <div className="mt-8 inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1">
              <button onClick={() => setCycle('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${cycle === 'monthly' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                {t('monthly')}
              </button>
              <button onClick={() => setCycle('yearly')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${cycle === 'yearly' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                {t('yearly')} <span className="text-green-600 ms-1 text-xs">{t('savePercent')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => {
              const isPopular = plan.slug === 'pro';
              return (
                <div key={plan.id} className={`relative rounded-2xl p-8 ${isPopular ? 'bg-gradient-to-b from-blue-600 to-indigo-700 text-white ring-4 ring-blue-600/20 scale-105' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'}`}>
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-4 py-1 rounded-full">
                      {t('mostPopular')}
                    </div>
                  )}
                  <h3 className={`text-xl font-bold ${isPopular ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{plan.name}</h3>
                  <div className="mt-4 mb-6">
                    <span className="text-4xl font-extrabold">{getPrice(plan)}</span>
                    <span className={`text-sm ${isPopular ? 'text-blue-100' : 'text-gray-500'}`}> {getPeriod(plan)}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {!plan.isCustom ? (
                      <>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className={`w-4 h-4 shrink-0 ${isPopular ? 'text-blue-200' : 'text-blue-600'}`} />
                          {plan.maxBuildings} {t('buildings')}
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className={`w-4 h-4 shrink-0 ${isPopular ? 'text-blue-200' : 'text-blue-600'}`} />
                          {plan.maxApartmentsPerBuilding} {t('maxApartmentsPerBuilding')}
                        </li>
                        {allFeatures.map(f => (
                          <li key={f} className="flex items-center gap-2 text-sm">
                            <Check className={`w-4 h-4 shrink-0 ${isPopular ? 'text-blue-200' : 'text-blue-600'}`} />
                            {f}
                          </li>
                        ))}
                      </>
                    ) : (
                      <li className={`text-sm ${isPopular ? 'text-blue-100' : 'text-gray-500'}`}>{t('enterpriseDesc')}</li>
                    )}
                  </ul>
                  <Button
                    onClick={() => plan.isCustom ? navigate('/contact') : navigate('/register')}
                    className={`w-full rounded-xl py-3 ${isPopular ? 'bg-white text-blue-600 hover:bg-gray-100' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'}`}
                  >
                    {plan.isCustom ? t('contactUs') : t('landingGetStarted')}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-center mt-8 text-sm text-gray-500">{t('pricingTrial')}</p>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
