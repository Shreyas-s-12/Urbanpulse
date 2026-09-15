import { LocationSource } from '@shared/types';

export interface ProviderReading {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
  source: LocationSource;
  providerName: string;
  isApproximate?: boolean;
}

export interface ILocationProvider {
  readonly name: string;
  readonly type: LocationSource;
  isAvailable(): boolean | Promise<boolean>;
  getLocation(): Promise<ProviderReading>;
  watchLocation?(onReading: (reading: ProviderReading) => void, onError?: (err: Error) => void): () => void;
}
