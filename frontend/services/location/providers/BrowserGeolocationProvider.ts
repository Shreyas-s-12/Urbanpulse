import { ILocationProvider, ProviderReading } from './ILocationProvider';

export class BrowserGeolocationProvider implements ILocationProvider {
  readonly name = 'BrowserGeolocationProvider';
  readonly type = 'BROWSER_GEOLOCATION' as const;

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'geolocation' in navigator;
  }

  async getLocation(timeoutMs: number = 10000): Promise<ProviderReading> {
    if (!this.isAvailable()) {
      throw new Error('Browser geolocation is unavailable on this device.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
            timestamp: pos.timestamp || Date.now(),
            source: 'BROWSER_GEOLOCATION',
            providerName: this.name,
            isApproximate: pos.coords.accuracy > 250,
          });
        },
        (err) => {
          reject(new Error(err.message || 'Geolocation request failed.'));
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
      );
    });
  }

  watchLocation(
    onReading: (reading: ProviderReading) => void,
    onError?: (err: Error) => void
  ): () => void {
    if (!this.isAvailable()) {
      onError?.(new Error('Browser geolocation is unavailable.'));
      return () => {};
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onReading({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
          source: 'BROWSER_GEOLOCATION',
          providerName: this.name,
          isApproximate: pos.coords.accuracy > 250,
        });
      },
      (err) => {
        onError?.(new Error(err.message));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }
}
