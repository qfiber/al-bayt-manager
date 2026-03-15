import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getOrgSubdomain } from '@/lib/subdomain';
import { api } from '@/lib/api';

interface SubdomainOrg {
  id: string;
  name: string;
  subdomain: string;
}

interface SubdomainContextType {
  orgSubdomain: string | null;
  subdomainOrg: SubdomainOrg | null;
  loading: boolean;
  suspended: boolean;
}

const SubdomainContext = createContext<SubdomainContextType>({
  orgSubdomain: null,
  subdomainOrg: null,
  loading: false,
  suspended: false,
});

export const SubdomainProvider = ({ children }: { children: ReactNode }) => {
  const [orgSubdomain] = useState(() => getOrgSubdomain());
  const [subdomainOrg, setSubdomainOrg] = useState<SubdomainOrg | null>(null);
  const [loading, setLoading] = useState(!!orgSubdomain);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    if (orgSubdomain) {
      api.get(`/organizations/by-subdomain/${orgSubdomain}`)
        .then((data: any) => {
          if (data.organization) {
            setSubdomainOrg(data.organization);
          }
        })
        .catch((err: any) => {
          if (err?.status === 403) setSuspended(true);
        })
        .finally(() => setLoading(false));
    }
  }, [orgSubdomain]);

  // Show suspended page if org is deactivated
  if (suspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 p-4">
        <div className="text-center max-w-md space-y-4">
          <div className="text-6xl">🚫</div>
          <h1 className="text-2xl font-bold text-red-700 dark:text-red-400">Account Suspended</h1>
          <p className="text-muted-foreground">
            This organization has been suspended. Please contact the system administrator for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SubdomainContext.Provider value={{ orgSubdomain, subdomainOrg, loading, suspended }}>
      {children}
    </SubdomainContext.Provider>
  );
};

export const useSubdomain = () => useContext(SubdomainContext);
