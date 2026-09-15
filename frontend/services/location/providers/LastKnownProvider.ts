import { ILocationProvider, ProviderReading } from './ILocationProvider';

export class LastKnownProvider implements ILocationProvider {
  readonly name = 'LastKnownProvider';
  readonly type = 'LAST_KNOWN' as const;
  private storageKey = 'urbanpulse_last_known_location';

  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return !!localStorage.getItem(this.storageKey);
    } catch {
      return false;
    }
  }

  saveLastKnown(reading: ProviderReading): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(reading));
    } catch {}
  }

  async getLocation(): Promise<ProviderReading> {
    if (typeof window === 'undefined') {
      throw new Error('LocalStorage unavailable.');
    }
    const item = localStorage.getItem(this.storageKey);
    if (!item) {
      throw new Error('No last known location found.');
    }
    const parsed = JSON.parse(item);
    return {
      ...parsed,
      source: 'LAST_KNOWN',
      providerName: this.name,
    };
  }
}
