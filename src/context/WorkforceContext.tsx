import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, type BootstrapResponse } from '../services/apiClient';
import {
  loadSecureLocalItem,
  removeSecureLocalItem,
  requestCurrentGps,
  saveSecureLocalItem,
} from '../services/capacitorBridge';
import {
  enqueueOfflineAction,
  getOfflineQueue,
  removeSyncedItems,
  updateOfflineQueueItem,
} from '../services/offlineSync';
import type { OfflineQueueItem } from '../types/buildflow';

interface WorkforceContextValue {
  token: string | null;
  isAuthenticated: boolean;
  bootstrap: BootstrapResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  isOnline: boolean;
  simulatedOffline: boolean;
  setSimulatedOffline: (offline: boolean) => void;
  offlineQueue: OfflineQueueItem[];
  isSyncing: boolean;
  lastLocationPingAt: string | null;
  lastLocationStatus: string | null;
  login: (employeeCode: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
  queueOrSend: (opts: {
    kind: OfflineQueueItem['kind'];
    title: string;
    endpoint: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }) => Promise<{ mode: 'online' | 'queued'; response?: unknown }>;
  syncOfflineQueue: () => Promise<void>;
  clearSyncedQueue: () => void;
  triggerLocationPingNow: () => Promise<void>;
}

const WorkforceContext = createContext<WorkforceContextValue | null>(null);

const SESSION_KEY = 'session_token';
const BOOTSTRAP_CACHE_PREFIX = 'bootstrap_cache_';

export const WorkforceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => loadSecureLocalItem<string>(SESSION_KEY));
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastLocationPingAt, setLastLocationPingAt] = useState<string | null>(null);
  const [lastLocationStatus, setLastLocationStatus] = useState<string | null>(null);

  const isOnline = browserOnline && !simulatedOffline;

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const bootstrapQuery = useQuery<BootstrapResponse, Error>({
    queryKey: ['bootstrap', token],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      try {
        const data = await apiRequest<BootstrapResponse>('/api/me/bootstrap', { token });
        saveSecureLocalItem(`${BOOTSTRAP_CACHE_PREFIX}${data.employee.id}`, data);
        saveSecureLocalItem('last_emp_id', data.employee.id);
        return data;
      } catch (err) {
        const lastEmpId = loadSecureLocalItem<string>('last_emp_id');
        if (lastEmpId && !navigator.onLine) {
          const cached = loadSecureLocalItem<BootstrapResponse>(`${BOOTSTRAP_CACHE_PREFIX}${lastEmpId}`);
          if (cached) return cached;
        }
        throw err;
      }
    },
    enabled: Boolean(token),
    retry: (failureCount, err: unknown) => {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 15_000,
  });

  // Auto-clear invalid session on 401
  useEffect(() => {
    const err = bootstrapQuery.error as (Error & { status?: number }) | null;
    if (err?.status === 401) {
      removeSecureLocalItem(SESSION_KEY);
      setToken(null);
    }
  }, [bootstrapQuery.error]);

  const employeeId = bootstrapQuery.data?.employee.id || '';

  useEffect(() => {
    if (employeeId) {
      setOfflineQueue(getOfflineQueue(employeeId));
    } else {
      setOfflineQueue([]);
    }
  }, [employeeId]);

  const refreshData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['bootstrap', token] });
  }, [queryClient, token]);

  const login = useCallback(
    async (employeeCode: string, pin: string) => {
      const res = await apiRequest<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: { employeeCode, pin },
      });
      saveSecureLocalItem(SESSION_KEY, res.token);
      setToken(res.token);
      await queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    if (token && isOnline) {
      await apiRequest('/api/auth/logout', { method: 'POST', token }).catch(() => {});
    }
    removeSecureLocalItem(SESSION_KEY);
    setToken(null);
    setOfflineQueue([]);
    setLastLocationPingAt(null);
    setLastLocationStatus(null);
    queryClient.clear();
  }, [token, isOnline, queryClient]);

  const syncOfflineQueue = useCallback(async () => {
    if (!employeeId || !token || !isOnline || isSyncing) return;
    const queue = getOfflineQueue(employeeId).filter(
      (i) => i.status === 'Waiting to Sync' || i.status === 'Sync Failed' || i.status === 'Saved on Device'
    );
    if (queue.length === 0) return;

    setIsSyncing(true);
    try {
      for (const item of queue) {
        setOfflineQueue(updateOfflineQueueItem(employeeId, item.id, { status: 'Uploading' }));
        try {
          await apiRequest(item.endpoint, {
            method: 'POST',
            token,
            body: { ...item.payload, idempotencyKey: item.idempotencyKey },
          });
          setOfflineQueue(updateOfflineQueueItem(employeeId, item.id, { status: 'Synced Successfully', lastError: undefined }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Sync failed';
          setOfflineQueue(
            updateOfflineQueueItem(employeeId, item.id, {
              status: 'Sync Failed',
              retryCount: item.retryCount + 1,
              lastError: msg,
            })
          );
        }
      }
      await refreshData();
    } finally {
      setIsSyncing(false);
    }
  }, [employeeId, token, isOnline, isSyncing, refreshData]);

  // Automatically sync when network returns
  useEffect(() => {
    if (isOnline && employeeId && offlineQueue.some((i) => i.status === 'Waiting to Sync' || i.status === 'Sync Failed')) {
      void syncOfflineQueue();
    }
  }, [isOnline, employeeId, offlineQueue.length, syncOfflineQueue]);

  const queueOrSend = useCallback(
    async (opts: {
      kind: OfflineQueueItem['kind'];
      title: string;
      endpoint: string;
      payload: Record<string, unknown>;
      idempotencyKey: string;
    }) => {
      if (!isOnline) {
        if (!employeeId) throw new Error('No active employee session.');
        enqueueOfflineAction(employeeId, {
          kind: opts.kind,
          title: opts.title,
          endpoint: opts.endpoint,
          payload: opts.payload,
          idempotencyKey: opts.idempotencyKey,
        });
        setOfflineQueue(getOfflineQueue(employeeId));
        return { mode: 'queued' as const };
      }
      const response = await apiRequest(opts.endpoint, {
        method: 'POST',
        token,
        body: { ...opts.payload, idempotencyKey: opts.idempotencyKey },
      });
      await refreshData();
      return { mode: 'online' as const, response };
    },
    [isOnline, employeeId, token, refreshData]
  );

  const clearSyncedQueue = useCallback(() => {
    if (!employeeId) return;
    setOfflineQueue(removeSyncedItems(employeeId));
  }, [employeeId]);

  const activeSession = bootstrapQuery.data?.activeSession || null;
  const trackingActive = Boolean(activeSession?.status === 'active' && activeSession?.trackingActive);

  const triggerLocationPingNow = useCallback(async () => {
    if (!activeSession || !trackingActive || !token || !employeeId) return;
    const gps = await requestCurrentGps(8000);
    if (!gps.ok || !gps.reading) {
      setLastLocationStatus(gps.errorMessage || 'GPS signal unavailable for scheduled ping.');
      return;
    }
    const nowIso = new Date().toISOString();
    const payload = {
      sessionId: activeSession.id,
      latitude: gps.reading.latitude,
      longitude: gps.reading.longitude,
      accuracyMeters: gps.reading.accuracyMeters,
      capturedAt: gps.reading.timestamp,
      source: isOnline ? 'live' : 'offline_queue',
    };

    if (!isOnline) {
      enqueueOfflineAction(employeeId, {
        kind: 'location_ping',
        title: `Location ping (${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})`,
        endpoint: '/api/attendance/location-ping',
        payload,
        idempotencyKey: `ping-${Date.now()}`,
      });
      setOfflineQueue(getOfflineQueue(employeeId));
      setLastLocationPingAt(nowIso);
      setLastLocationStatus('Saved offline — waiting to sync');
      return;
    }

    try {
      await apiRequest('/api/attendance/location-ping', {
        method: 'POST',
        token,
        body: payload,
      });
      setLastLocationPingAt(nowIso);
      setLastLocationStatus(`Synced (±${gps.reading.accuracyMeters}m)`);
      await refreshData();
    } catch (err) {
      setLastLocationStatus(err instanceof Error ? err.message : 'Ping failed');
    }
  }, [activeSession, trackingActive, token, employeeId, isOnline, refreshData]);

  // Controlled 5-minute location tracking ONLY during an active authorized session
  const pingRef = useRef(triggerLocationPingNow);
  pingRef.current = triggerLocationPingNow;

  useEffect(() => {
    if (!trackingActive) return;
    const interval = setInterval(() => {
      void pingRef.current();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [trackingActive]);

  const value = useMemo<WorkforceContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token && bootstrapQuery.data?.employee),
      bootstrap: bootstrapQuery.data,
      isLoading: Boolean(token) && bootstrapQuery.isLoading,
      error: bootstrapQuery.error || null,
      isOnline,
      simulatedOffline,
      setSimulatedOffline,
      offlineQueue,
      isSyncing,
      lastLocationPingAt,
      lastLocationStatus,
      login,
      logout,
      refreshData,
      queueOrSend,
      syncOfflineQueue,
      clearSyncedQueue,
      triggerLocationPingNow,
    }),
    [
      token,
      bootstrapQuery.data,
      bootstrapQuery.isLoading,
      bootstrapQuery.error,
      isOnline,
      simulatedOffline,
      offlineQueue,
      isSyncing,
      lastLocationPingAt,
      lastLocationStatus,
      login,
      logout,
      refreshData,
      queueOrSend,
      syncOfflineQueue,
      clearSyncedQueue,
      triggerLocationPingNow,
    ]
  );

  return <WorkforceContext.Provider value={value}>{children}</WorkforceContext.Provider>;
};

export function useWorkforce(): WorkforceContextValue {
  const ctx = useContext(WorkforceContext);
  if (!ctx) throw new Error('useWorkforce must be used inside WorkforceProvider');
  return ctx;
}
