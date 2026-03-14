import { useNavigate } from 'react-router-dom';
import { usePublicSettings } from '@/contexts/PublicSettingsContext';
import { Building2 } from 'lucide-react';

export const AuthHeader = () => {
  const navigate = useNavigate();
  const { companyName, logoUrl } = usePublicSettings();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName || 'Al-Bayt'} className="h-7 w-auto" />
          ) : (
            <>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">{companyName || 'Al-Bayt'}</span>
            </>
          )}
        </button>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing'); }} className="text-gray-500 hover:text-gray-900 dark:hover:text-white hidden sm:inline">
            Pricing
          </a>
          <a href="/faq" onClick={(e) => { e.preventDefault(); navigate('/faq'); }} className="text-gray-500 hover:text-gray-900 dark:hover:text-white hidden sm:inline">
            FAQ
          </a>
          <a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }} className="text-gray-500 hover:text-gray-900 dark:hover:text-white hidden sm:inline">
            Contact
          </a>
        </nav>
      </div>
    </div>
  );
};
