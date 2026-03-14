import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/api';

interface PublicSettingsContextType {
  currencyCode: string;
  currencySymbol: string;
  formatCurrency: (amount: number | string) => string;
  logoUrl: string | null;
  companyName: string | null;
  turnstileEnabled: boolean;
  turnstileSiteKey: string | null;
  registrationEnabled: boolean;
  primaryColor: string | null;
  accentColor: string | null;
  refresh: () => Promise<void>;
  /** @deprecated Use refresh() instead */
  refreshCurrency: () => Promise<void>;
}

const PublicSettingsContext = createContext<PublicSettingsContextType>({
  currencyCode: 'ILS',
  currencySymbol: '₪',
  formatCurrency: (amount) => `₪${Number(amount).toFixed(2)}`,
  logoUrl: null,
  companyName: null,
  turnstileEnabled: false,
  turnstileSiteKey: null,
  registrationEnabled: true,
  primaryColor: null,
  accentColor: null,
  refresh: async () => {},
  refreshCurrency: async () => {},
});

export const usePublicSettings = () => useContext(PublicSettingsContext);

/** Backward-compatible alias */
export const useCurrency = usePublicSettings;

export const PublicSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [currencyCode, setCurrencyCode] = useState('ILS');
  const [currencySymbol, setCurrencySymbol] = useState('₪');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);

  const fetchPublicSettings = useCallback(async () => {
    try {
      const data = await api.get<{
        systemLanguage: string;
        currencyCode: string;
        currencySymbol: string;
        logoUrl: string | null;
        companyName: string | null;
        turnstileEnabled: boolean;
        turnstileSiteKey: string | null;
        registrationEnabled: boolean;
        primaryColor: string | null;
        accentColor: string | null;
      }>('/settings/public');
      if (data) {
        setCurrencyCode(data.currencyCode || 'ILS');
        setCurrencySymbol(data.currencySymbol || '₪');
        setLogoUrl(data.logoUrl || null);
        setCompanyName(data.companyName || null);
        setTurnstileEnabled(data.turnstileEnabled ?? false);
        setTurnstileSiteKey(data.turnstileSiteKey || null);
        setRegistrationEnabled(data.registrationEnabled ?? true);
        setPrimaryColor(data.primaryColor || null);
        setAccentColor(data.accentColor || null);
      }
    } catch {
      // Use defaults on error
    }
  }, []);

  useEffect(() => {
    fetchPublicSettings();
  }, [fetchPublicSettings]);

  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', primaryColor);
    }
    if (accentColor) {
      document.documentElement.style.setProperty('--brand-accent', accentColor);
    }
  }, [primaryColor, accentColor]);

  const formatCurrency = useCallback(
    (amount: number | string) => `${currencySymbol}${Number(amount).toFixed(2)}`,
    [currencySymbol],
  );

  return (
    <PublicSettingsContext.Provider value={{
      currencyCode,
      currencySymbol,
      formatCurrency,
      logoUrl,
      companyName,
      turnstileEnabled,
      turnstileSiteKey,
      registrationEnabled,
      primaryColor,
      accentColor,
      refresh: fetchPublicSettings,
      refreshCurrency: fetchPublicSettings,
    }}>
      {children}
    </PublicSettingsContext.Provider>
  );
};

/** @deprecated Use PublicSettingsProvider instead */
export const CurrencyProvider = PublicSettingsProvider;
