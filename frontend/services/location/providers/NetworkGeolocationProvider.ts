import { ILocationProvider, ProviderReading } from './ILocationProvider';

/**
 * Fallback provider: IP/network based approximate resolution.
 * Rule 37 Compliance:
 * NEVER claims exact GPS coordinates.
 * Always marks isApproximate = true, source = 'NETWORK'.
 */
export class NetworkGeolocationProvider implements ILocationProvider {
  readonly name = 'NetworkGeolocationProvider';
  readonly type = 'NETWORK' as const;

  isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  async getLocation(): Promise<ProviderReading> {
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          return {
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            accuracyMeters: 5000, // Explicitly coarse network area
            timestamp: Date.now(),
            source: 'NETWORK',
            providerName: this.name,
            isApproximate: true,
          };
        }
      }
    } catch {}

    throw new Error('Network geolocation fallback could not determine approximate region.');
  }
}
