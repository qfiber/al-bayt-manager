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
}

const SubdomainContext = createContext<SubdomainContextType>({
  orgSubdomain: null,
  subdomainOrg: null,
  loading: false,
});

export const SubdomainProvider = ({ children }: { children: ReactNode }) => {
  const [orgSubdomain] = useState(() => getOrgSubdomain());
  const [subdomainOrg, setSubdomainOrg] = useState<SubdomainOrg | null>(null);
  const [loading, setLoading] = useState(!!orgSubdomain);

  useEffect(() => {
    if (orgSubdomain) {
      api.get(`/organizations/by-subdomain/${orgSubdomain}`)
        .then((data: any) => {
          if (data.organization) {
            setSubdomainOrg(data.organization);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [orgSubdomain]);

  return (
    <SubdomainContext.Provider value={{ orgSubdomain, subdomainOrg, loading }}>
      {children}
    </SubdomainContext.Provider>
  );
};

export const useSubdomain = () => useContext(SubdomainContext);
