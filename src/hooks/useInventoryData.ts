import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Alert, AuditLog, DashboardStats, HardwareAsset, LifecycleState, ServerComponent, SoftwareLicense } from '../types';

export interface InventoryData {
  hardware: HardwareAsset[];
  software: SoftwareLicense[];
  serverComponents: ServerComponent[];
  alerts: Alert[];
  auditLogs: AuditLog[];
  stats: DashboardStats | null;
}

const EMPTY: InventoryData = { hardware: [], software: [], serverComponents: [], alerts: [], auditLogs: [], stats: null };

/** Loads everything the main screens show and wraps each change so the lists reload afterwards. */
export function useInventoryData() {
  const [data, setData] = useState<InventoryData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [hardware, software, serverComponents, alerts, auditLogs, stats] = await Promise.all([
        api<HardwareAsset[]>('/api/hardware'),
        api<SoftwareLicense[]>('/api/software'),
        api<ServerComponent[]>('/api/server-components'),
        api<Alert[]>('/api/alerts'),
        api<AuditLog[]>('/api/audit-logs'),
        api<DashboardStats>('/api/analytics'),
      ]);
      setData({ hardware, software, serverComponents, alerts, auditLogs, stats });
      setLoadError(null);
      setLastLoadedAt(new Date());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the inventory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Sends a change; errors propagate so the form or dialog can show them. */
  const change = useCallback(
    async (path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) => {
      await api(path, { method, body });
      await refresh();
    },
    [refresh],
  );

  const actions = {
    addHardware: (item: HardwareAsset) => change('/api/hardware', 'POST', item),
    updateHardware: (item: HardwareAsset) => change(`/api/hardware/${encodeURIComponent(item.id)}`, 'PUT', item),
    deleteHardware: (id: string) => change(`/api/hardware/${encodeURIComponent(id)}`, 'DELETE'),
    changeLifecycle: (id: string, to: LifecycleState, note: string) =>
      change(`/api/hardware/${encodeURIComponent(id)}/lifecycle`, 'POST', { to, note }),
    addSoftware: (item: SoftwareLicense) => change('/api/software', 'POST', item),
    updateSoftware: (item: SoftwareLicense) => change(`/api/software/${encodeURIComponent(item.id)}`, 'PUT', item),
    deleteSoftware: (id: string) => change(`/api/software/${encodeURIComponent(id)}`, 'DELETE'),
    addServerComponent: (item: ServerComponent) => change('/api/server-components', 'POST', item),
    updateServerComponent: (item: ServerComponent) => change(`/api/server-components/${encodeURIComponent(item.id)}`, 'PUT', item),
    deleteServerComponent: (id: string) => change(`/api/server-components/${encodeURIComponent(id)}`, 'DELETE'),
    resolveAlert: (id: string) => change(`/api/alerts/resolve/${encodeURIComponent(id)}`, 'POST'),
    runAlertChecks: () => change('/api/alerts/check-triggers', 'POST'),
  };

  return { ...data, isLoading, loadError, lastLoadedAt, refresh, actions };
}
