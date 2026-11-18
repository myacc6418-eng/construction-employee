export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: string;
}

export interface GpsResult {
  ok: boolean;
  reading?: GpsReading;
  errorCode?: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED';
  errorMessage?: string;
}

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function getPlatformRuntimeLabel(): string {
  if (isCapacitorNative()) return 'Capacitor Native Mobile';
  return 'Mobile Web / Responsive Browser';
}

export async function requestCurrentGps(timeoutMs = 10000): Promise<GpsResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED',
      errorMessage: 'Geolocation is not supported on this device or browser.',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          reading: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy || 30),
            timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
          },
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({
            ok: false,
            errorCode: 'PERMISSION_DENIED',
            errorMessage:
              'Location permission was denied. Enable GPS access in your browser or device settings, or submit an Attendance Exception request.',
          });
        } else if (err.code === err.TIMEOUT) {
          resolve({
            ok: false,
            errorCode: 'TIMEOUT',
            errorMessage: 'GPS signal timed out. Step into an open area away from heavy concrete cover and retry.',
          });
        } else {
          resolve({
            ok: false,
            errorCode: 'POSITION_UNAVAILABLE',
            errorMessage: 'Current GPS coordinates are unavailable on this device.',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
}

// Haversine helper for client-side distance preview (server remains authoritative)
export function computeDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Protected local storage wrapper using base64-encoded envelope scoped by key
export function saveSecureLocalItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify({ v: 1, ts: Date.now(), data: value });
    const encoded = btoa(unescape(encodeURIComponent(serialized)));
    localStorage.setItem(`bf_sec_${key}`, encoded);
  } catch {
    // Ignore quota errors gracefully
  }
}

export function loadSecureLocalItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`bf_sec_${key}`);
    if (!raw) return null;
    const decoded = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(decoded) as { v: number; data: T };
    return parsed.data;
  } catch {
    return null;
  }
}

export function removeSecureLocalItem(key: string): void {
  try {
    localStorage.removeItem(`bf_sec_${key}`);
  } catch {
    // Ignore
  }
}
