import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Building } from '@/lib/types';

export function useBuildings(enabled = true) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Building[]>('/buildings');
      setBuildings(data || []);
    } catch {
      setBuildings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      fetch();
    }
  }, [enabled, fetch]);

  return { buildings, loading, refetch: fetch };
}
