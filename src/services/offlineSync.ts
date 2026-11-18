import type { OfflineQueueItem } from '../types/buildflow';
import { loadSecureLocalItem, saveSecureLocalItem } from './capacitorBridge';

const QUEUE_KEY_PREFIX = 'offline_queue_';

export function generateIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function getOfflineQueue(employeeId: string): OfflineQueueItem[] {
  if (!employeeId) return [];
  return loadSecureLocalItem<OfflineQueueItem[]>(`${QUEUE_KEY_PREFIX}${employeeId}`) || [];
}

export function saveOfflineQueue(employeeId: string, items: OfflineQueueItem[]): void {
  if (!employeeId) return;
  saveSecureLocalItem(`${QUEUE_KEY_PREFIX}${employeeId}`, items);
}

export function enqueueOfflineAction(
  employeeId: string,
  item: Omit<OfflineQueueItem, 'id' | 'employeeId' | 'createdAt' | 'status' | 'retryCount'>
): OfflineQueueItem {
  const current = getOfflineQueue(employeeId);
  const newItem: OfflineQueueItem = {
    ...item,
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId,
    createdAt: new Date().toISOString(),
    status: 'Waiting to Sync',
    retryCount: 0,
  };
  const updated = [newItem, ...current];
  saveOfflineQueue(employeeId, updated);
  return newItem;
}

export function updateOfflineQueueItem(
  employeeId: string,
  itemId: string,
  patch: Partial<OfflineQueueItem>
): OfflineQueueItem[] {
  const current = getOfflineQueue(employeeId);
  const updated = current.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
  saveOfflineQueue(employeeId, updated);
  return updated;
}

export function removeSyncedItems(employeeId: string): OfflineQueueItem[] {
  const current = getOfflineQueue(employeeId);
  const filtered = current.filter((item) => item.status !== 'Synced Successfully');
  saveOfflineQueue(employeeId, filtered);
  return filtered;
}
