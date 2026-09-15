import { haversineDistanceMeters } from '@/stores/useLocationStore';
import { LocationConflictStatus, LocationConfidenceTier } from '@shared/types';
import { ProviderReading } from './providers/ILocationProvider';
import { LocationEventBus } from './LocationEventBus';

export interface ArbitratedResult {
  selectedReading: ProviderReading;
  confidenceTier: LocationConfidenceTier;
  confidenceScore: number;
  conflict: LocationConflictStatus;
}

export class LocationArbiter {
  arbitrate(readings: ProviderReading[]): ArbitratedResult | null {
    if (!readings || readings.length === 0) return null;

    if (readings.length === 1) {
      const single = readings[0];
      const tier = this.deriveConfidenceTier(single.accuracyMeters);
      return {
        selectedReading: single,
        confidenceTier: tier,
        confidenceScore: this.accuracyToScore(single.accuracyMeters),
        conflict: { hasConflict: false },
      };
    }

    const sorted = [...readings].sort((a, b) => {
      if (a.accuracyMeters !== b.accuracyMeters) {
        return a.accuracyMeters - b.accuracyMeters;
      }
      return b.timestamp - a.timestamp;
    });

    const best = sorted[0];
    const secondBest = sorted[1];

    const distanceMeters = haversineDistanceMeters(
      best.latitude,
      best.longitude,
      secondBest.latitude,
      secondBest.longitude
    );

    let conflict: LocationConflictStatus = { hasConflict: false };

    if (distanceMeters > 1000 && best.accuracyMeters <= 150 && secondBest.accuracyMeters <= 150) {
      conflict = {
        hasConflict: true,
        message: `Location signals differ by ${(distanceMeters / 1000).toFixed(1)}km. Trying to improve accuracy...`,
        divergentDistanceMeters: distanceMeters,
        detectedAt: Date.now(),
      };

      LocationEventBus.emit('LOCATION_CONFLICT', {
        conflict,
        providers: [best.providerName, secondBest.providerName],
      });
    }

    return {
      selectedReading: best,
      confidenceTier: this.deriveConfidenceTier(best.accuracyMeters),
      confidenceScore: this.accuracyToScore(best.accuracyMeters),
      conflict,
    };
  }

  deriveConfidenceTier(accuracyMeters: number): LocationConfidenceTier {
    if (accuracyMeters <= 25) return 'HIGH';
    if (accuracyMeters <= 75) return 'GOOD';
    if (accuracyMeters <= 250) return 'APPROXIMATE';
    return 'LOW';
  }

  private accuracyToScore(acc: number): number {
    if (acc <= 15) return 0.98;
    if (acc <= 25) return 0.95;
    if (acc <= 50) return 0.88;
    if (acc <= 75) return 0.80;
    if (acc <= 150) return 0.65;
    if (acc <= 250) return 0.50;
    return 0.35;
  }
}
