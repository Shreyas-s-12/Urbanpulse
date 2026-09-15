import { LocationEventType, LocationContext, LocationConflictStatus } from '@shared/types';

export type LocationEventPayloadMap = {
  LOCATION_REQUESTED: { provider?: string; timestamp: number };
  LOCATION_READING_RECEIVED: { reading: LocationContext };
  LOCATION_IMPROVED: { reading: LocationContext; previousAccuracy: number };
  LOCATION_LOCKED: { context: LocationContext };
  LOCATION_DEGRADED: { reason: string; accuracyMeters?: number };
  LOCATION_CONFLICT: { conflict: LocationConflictStatus; providers: string[] };
  LOCATION_STALE: { ageSeconds: number };
  LOCATION_FAILED: { error: string; code?: number };
  LOCATION_COORDINATE_MISMATCH: {
    source: string;
    rawCoords: { lat: number; lng: number };
    discrepantCoords: { lat: number; lng: number };
    distanceMeters: number;
  };
};

export type LocationEventListener<T extends LocationEventType> = (
  payload: LocationEventPayloadMap[T]
) => void;

class LocationEventBusClass {
  private listeners: Map<LocationEventType, Set<(payload: any) => void>> = new Map();

  on<T extends LocationEventType>(event: T, listener: LocationEventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  emit<T extends LocationEventType>(event: T, payload: LocationEventPayloadMap[T]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    set.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[LocationEventBus] Error in listener for ${event}:`, err);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const LocationEventBus = new LocationEventBusClass();
