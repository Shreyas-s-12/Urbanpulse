import { ILocationProvider, ProviderReading } from './ILocationProvider';

export class ManualProvider implements ILocationProvider {
  readonly name = 'ManualProvider';
  readonly type = 'MANUAL' as const;

  private currentManual: ProviderReading | null = null;

  isAvailable(): boolean {
    return true;
  }

  setManualCoordinate(latitude: number, longitude: number, accuracyMeters: number = 5): ProviderReading {
    this.currentManual = {
      latitude,
      longitude,
      accuracyMeters,
      timestamp: Date.now(),
      source: 'MANUAL',
      providerName: this.name,
      isApproximate: false,
    };
    return this.currentManual;
  }

  async getLocation(): Promise<ProviderReading> {
    if (!this.currentManual) {
      throw new Error('No manual location has been pinned.');
    }
    return this.currentManual;
  }
}
