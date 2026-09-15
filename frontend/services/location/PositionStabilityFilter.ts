import { haversineDistanceMeters } from '@/stores/useLocationStore';
import { ProviderReading } from './providers/ILocationProvider';

export interface StabilityFilterOptions {
  microJitterThresholdMeters?: number;
  maxJumpVelocityMps?: number;
  outlierConfirmationReads?: number;
}

export class PositionStabilityFilter {
  private lastAccepted: ProviderReading | null = null;
  private pendingOutlier: ProviderReading | null = null;
  private outlierCount = 0;

  constructor(private options: StabilityFilterOptions = {}) {}

  filter(incoming: ProviderReading): ProviderReading {
    const jitterThreshold = this.options.microJitterThresholdMeters ?? 8;
    const maxVelocity = this.options.maxJumpVelocityMps ?? 85;

    if (!this.lastAccepted) {
      this.lastAccepted = incoming;
      return incoming;
    }

    const dist = haversineDistanceMeters(
      this.lastAccepted.latitude,
      this.lastAccepted.longitude,
      incoming.latitude,
      incoming.longitude
    );

    const timeDeltaSeconds = Math.max((incoming.timestamp - this.lastAccepted.timestamp) / 1000, 0.1);
    const speed = dist / timeDeltaSeconds;

    // 1. Micro-jitter suppression: if movement is tiny (< 8m) and accuracy is not dramatically better, preserve stable coordinate
    if (dist < jitterThreshold && incoming.accuracyMeters >= this.lastAccepted.accuracyMeters * 0.9) {
      return {
        ...this.lastAccepted,
        timestamp: incoming.timestamp,
        accuracyMeters: Math.min(this.lastAccepted.accuracyMeters, incoming.accuracyMeters),
      };
    }

    // 2. Outlier rejection: if speed exceeds physical maximum (> 300 km/h)
    if (dist > 500 && speed > maxVelocity) {
      if (this.pendingOutlier) {
        const pendingDist = haversineDistanceMeters(
          this.pendingOutlier.latitude,
          this.pendingOutlier.longitude,
          incoming.latitude,
          incoming.longitude
        );
        if (pendingDist < 100) {
          this.outlierCount++;
          if (this.outlierCount >= (this.options.outlierConfirmationReads ?? 2)) {
            this.lastAccepted = incoming;
            this.pendingOutlier = null;
            this.outlierCount = 0;
            return incoming;
          }
        }
      } else {
        this.pendingOutlier = incoming;
        this.outlierCount = 1;
      }

      return {
        ...this.lastAccepted,
        timestamp: incoming.timestamp,
      };
    }

    // Normal genuine movement
    this.lastAccepted = incoming;
    this.pendingOutlier = null;
    this.outlierCount = 0;
    return incoming;
  }

  reset(): void {
    this.lastAccepted = null;
    this.pendingOutlier = null;
    this.outlierCount = 0;
  }
}
