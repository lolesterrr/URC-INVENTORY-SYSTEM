import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { ReportsData } from '../types';

/** Loads the standard reports on demand, not with the rest of the inventory data, since they are read rarely. */
export function useReports() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await api<ReportsData>('/api/reports'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
