import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { AppSettings } from '../types';

/** Organisation-wide settings. Loaded once at startup (for the sidebar's company name) and again by the Settings screen. */
export function useSettings() {
  const [data, setData] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api<AppSettings>('/api/settings'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (patch: Partial<AppSettings>) => {
    const saved = await api<AppSettings>('/api/settings', { method: 'PUT', body: patch });
    setData(saved);
    return saved;
  }, []);

  return { data, isLoading, error, refresh, save };
}
