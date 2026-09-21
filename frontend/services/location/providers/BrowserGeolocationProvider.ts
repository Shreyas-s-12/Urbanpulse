import { ILocationProvider, ProviderReading } from './ILocationProvider';

export class BrowserGeolocationProvider implements ILocationProvider {
  readonly name = 'BrowserGeolocationProvider';
  readonly type = 'DEVICE' as const;

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'geolocation' in navigator;
  }

  async getLocation(timeoutMs: number = 15000): Promise<ProviderReading> {
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
            source: 'DEVICE',
            providerName: this.name,
            isApproximate: pos.coords.accuracy > 75,
          });
        },
        (err) => {
          reject(err);
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
      );
    });
  }

  watchLocation(
    onReading: (reading: ProviderReading) => void,
    onError?: (err: any) => void
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
          source: 'DEVICE',
          providerName: this.name,
          isApproximate: pos.coords.accuracy > 75,
        });
      },
      (err) => {
        onError?.(err);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    return () => {
      try {
        if (typeof window !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchId);
        }
      } catch {}
    };
  }
}
