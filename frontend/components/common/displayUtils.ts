/**
 * UrbanPulse Safe Display Utilities
 * Prevents React Error #31 ("Objects are not valid as a React child")
 * Guarantees that any arbitrary value (primitive, object, Error, array, null/undefined)
 * is safely transformed into a human-readable string without crashing the React renderer.
 */

export function formatDisplayValue(value: unknown, fallback: string = '—'): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value instanceof Error) {
    return value.message || 'Error occurred';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    if (typeof obj.displayValue === 'string') return obj.displayValue;
    if (typeof obj.formattedAddress === 'string') return obj.formattedAddress;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.value === 'string' || typeof obj.value === 'number') return String(obj.value);

    // Geographic viewport bounds: { north, south, east, west }
    if (
      obj.north !== undefined &&
      obj.south !== undefined &&
      obj.east !== undefined &&
      obj.west !== undefined
    ) {
      const n = Number(obj.north);
      const s = Number(obj.south);
      const e = Number(obj.east);
      const w = Number(obj.west);
      if (Number.isFinite(n) && Number.isFinite(s) && Number.isFinite(e) && Number.isFinite(w)) {
        const formatLat = (lat: number) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
        const formatLng = (lng: number) => `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
        return `[${formatLat(n)}, ${formatLng(w)} – ${formatLat(s)}, ${formatLng(e)}]`;
      }
    }

    // Coordinates: { latitude, longitude } or { lat, lng }
    if (obj.latitude !== undefined && obj.longitude !== undefined) {
      return `(${Number(obj.latitude).toFixed(4)}°, ${Number(obj.longitude).toFixed(4)}°)`;
    }
    if (obj.lat !== undefined && obj.lng !== undefined) {
      return `(${Number(obj.lat).toFixed(4)}°, ${Number(obj.lng).toFixed(4)}°)`;
    }

    // Diagnostics / structured objects: safe fallback
    try {
      return JSON.stringify(obj);
    } catch {
      return '[Complex Object]';
    }
  }

  return String(value);
}

export function toDisplayMessage(error: unknown, fallback: string = 'An unexpected condition occurred'): string {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    if (typeof errObj.message === 'string') return errObj.message;
    if (typeof errObj.error === 'string') return errObj.error;
    if (typeof errObj.detail === 'string') return errObj.detail;
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return String(error);
}
