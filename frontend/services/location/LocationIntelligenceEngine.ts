import {
  LocationContext,
  LocationAccuracyTier,
  LocationAccuracyState,
  LocationSource,
  RawDeviceLocation,
  AddressMetadata,
  LocationConflictStatus,
} from '@shared/types';
import { haversineDistanceMeters, useLocationStore } from '@/stores/useLocationStore';
import { LocationEventBus } from './LocationEventBus';
import { BrowserGeolocationProvider } from './providers/BrowserGeolocationProvider';
import { NetworkGeolocationProvider } from './providers/NetworkGeolocationProvider';
import { ManualProvider } from './providers/ManualProvider';
import { LastKnownProvider } from './providers/LastKnownProvider';
import { PositionStabilityFilter } from './PositionStabilityFilter';
import { LocationArbiter, ArbitratedResult } from './LocationArbiter';
import { ProviderReading } from './providers/ILocationProvider';
import { apiClient } from '../apiClient';

export interface AcquisitionOptions {
  onProgress?: (state: LocationAccuracyState, reading?: ProviderReading) => void;
  onRawAcquired?: (raw: RawDeviceLocation) => void;
  timeoutMs?: number;
  autoImproveTimeoutMs?: number;
}

export class LocationIntelligenceEngine {
  private static instance: LocationIntelligenceEngine | null = null;

  // Providers
  private browserProvider = new BrowserGeolocationProvider();
  private networkProvider = new NetworkGeolocationProvider();
  private manualProvider = new ManualProvider();
  private lastKnownProvider = new LastKnownProvider();

  // Subsystems
  private stabilityFilter = new PositionStabilityFilter({
    microJitterThresholdMeters: 8,
    maxJumpVelocityMps: 85,
    outlierConfirmationReads: 2,
  });
  private arbiter = new LocationArbiter();

  // Active state
  private activeWatchStop: (() => void) | null = null;
  private isAcquiring = false;
  private lastRefreshedCoords: { latitude: number; longitude: number } | null = null;

  private constructor() {}

  public static getInstance(): LocationIntelligenceEngine {
    if (!LocationIntelligenceEngine.instance) {
      LocationIntelligenceEngine.instance = new LocationIntelligenceEngine();
    }
    return LocationIntelligenceEngine.instance;
  }

  /**
   * Primary acquisition pipeline:
   * DEVICE -> MULTI-READ -> QUALITY EVALUATION -> ARBITRATION -> ADDRESS ENRICHMENT -> LOCK
   * Non-blocking: immediate raw callback for zero UI delay.
   */
  public async acquireLocation(options?: AcquisitionOptions): Promise<LocationContext> {
    const onProgress = options?.onProgress;
    const onRawAcquired = options?.onRawAcquired;
    const timeoutMs = options?.timeoutMs ?? 10000;
    const autoImproveMs = options?.autoImproveTimeoutMs ?? 5000;

    LocationEventBus.emit('LOCATION_REQUESTED', {
      provider: 'BrowserGeolocationProvider',
      timestamp: Date.now(),
    });

    onProgress?.('LOCATING');
    this.isAcquiring = true;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let bestReading: ProviderReading | null = null;
      let readCount = 0;
      let improveTimer: NodeJS.Timeout | null = null;

      const finish = (reading: ProviderReading, state: LocationAccuracyState) => {
        if (isSettled) return;
        isSettled = true;
        this.isAcquiring = false;

        if (improveTimer) {
          clearTimeout(improveTimer);
          improveTimer = null;
        }

        const stableReading = this.stabilityFilter.filter(reading);
        const arbitrated = this.arbiter.arbitrate([stableReading]);
        const finalReading = arbitrated ? arbitrated.selectedReading : stableReading;

        // Persist to session cache
        this.lastKnownProvider.saveLastKnown(finalReading);

        const context = this.readingToContext(finalReading, state, arbitrated);

        LocationEventBus.emit('LOCATION_LOCKED', { context });
        onProgress?.(state, finalReading);

        // Progressive enrichment: asynchronous address resolution without blocking coordinates
        this.enrichAddressAsynchronously(finalReading.latitude, finalReading.longitude);

        resolve(context);
      };

      // 1. Primary path: Browser Hardware Geolocation
      if (this.browserProvider.isAvailable()) {
        const stopWatch = this.browserProvider.watchLocation(
          (incoming) => {
            if (isSettled) return;
            readCount++;

            // Immediate callback on first read (T+0) to move map & marker instantly
            if (readCount === 1) {
              bestReading = incoming;
              onRawAcquired?.({
                latitude: incoming.latitude,
                longitude: incoming.longitude,
                accuracyMeters: incoming.accuracyMeters,
                timestamp: incoming.timestamp,
                source: 'BROWSER_GEOLOCATION',
              });

              onProgress?.(
                incoming.accuracyMeters <= 25
                  ? 'LOCKED'
                  : incoming.accuracyMeters <= 75
                  ? 'IMPROVING'
                  : 'APPROXIMATE',
                incoming
              );

              // If already high precision (< 25m), lock immediately
              if (incoming.accuracyMeters <= 25) {
                stopWatch();
                finish(incoming, 'LOCKED');
                return;
              }

              // Otherwise start auto-improve timer
              improveTimer = setTimeout(() => {
                if (!isSettled && bestReading) {
                  stopWatch();
                  const finalState = bestReading.accuracyMeters <= 75 ? 'LOCKED' : 'APPROXIMATE';
                  finish(bestReading, finalState);
                }
              }, autoImproveMs);
            } else {
              // Consecutive reading: evaluate if accuracy improved
              if (!bestReading || incoming.accuracyMeters < bestReading.accuracyMeters) {
                const prevAcc = bestReading ? bestReading.accuracyMeters : 9999;
                bestReading = incoming;

                LocationEventBus.emit('LOCATION_IMPROVED', {
                  reading: this.readingToContext(incoming, 'IMPROVING'),
                  previousAccuracy: prevAcc,
                });

                onProgress?.('IMPROVING', incoming);

                // Auto-lock if accuracy meets high confidence threshold
                if (incoming.accuracyMeters <= 25 || (incoming.accuracyMeters <= 50 && readCount >= 3)) {
                  stopWatch();
                  finish(incoming, 'LOCKED');
                }
              }
            }
          },
          async (err) => {
            if (isSettled) return;
            console.warn('[LocationIntelligenceEngine] Browser GPS unavailable:', err.message);

            // 2. Fallback hierarchy: Attempt Network Geolocation
            try {
              const netReading = await this.networkProvider.getLocation();
              finish(netReading, 'APPROXIMATE');
            } catch {
              // 3. Fallback hierarchy: Attempt Last Known Location
              try {
                const lastKnown = await this.lastKnownProvider.getLocation();
                finish(lastKnown, 'STALE');
              } catch {
                isSettled = true;
                this.isAcquiring = false;
                onProgress?.('UNAVAILABLE');
                LocationEventBus.emit('LOCATION_FAILED', { error: err.message });
                reject(err);
              }
            }
          }
        );

        // Overall watchdog timeout
        setTimeout(() => {
          if (!isSettled) {
            stopWatch();
            if (bestReading) {
              const finalState = (bestReading as ProviderReading).accuracyMeters <= 75 ? 'LOCKED' : 'APPROXIMATE';
              finish(bestReading, finalState);
            } else {
              isSettled = true;
              this.isAcquiring = false;
              onProgress?.('UNAVAILABLE');
              reject(new Error('Location acquisition timed out.'));
            }
          }
        }, timeoutMs);
      } else {
        // Geolocation completely unsupported: attempt network fallback
        this.networkProvider.getLocation()
          .then((net) => finish(net, 'APPROXIMATE'))
          .catch((err) => {
            onProgress?.('UNAVAILABLE');
            reject(err);
          });
      }
    });
  }

  /**
   * Continuous live-tracking with position stability filtering and intelligent refresh throttling.
   */
  public startLiveTracking(
    onReading: (loc: RawDeviceLocation, context: LocationContext) => void,
    onRefreshIntelligence?: (coords: { latitude: number; longitude: number }) => void
  ): () => void {
    if (this.activeWatchStop) {
      this.activeWatchStop();
      this.activeWatchStop = null;
    }

    this.stabilityFilter.reset();

    const stop = this.browserProvider.watchLocation(
      (incoming) => {
        // Pass through stability filter to eliminate micro-jitter
        const filtered = this.stabilityFilter.filter(incoming);
        const arbitrated = this.arbiter.arbitrate([filtered]);
        const reading = arbitrated ? arbitrated.selectedReading : filtered;

        const rawDev: RawDeviceLocation = {
          latitude: reading.latitude,
          longitude: reading.longitude,
          accuracyMeters: reading.accuracyMeters,
          timestamp: reading.timestamp,
          source: reading.source as 'BROWSER_GEOLOCATION',
        };

        const context = this.readingToContext(reading, 'LOCKED', arbitrated);
        onReading(rawDev, context);

        // Intelligent movement threshold check (Section 9):
        // Moving < 10m does not refresh all backend intelligence.
        // Moving > 50m triggers intelligence refresh.
        if (this.lastRefreshedCoords) {
          const movedDist = haversineDistanceMeters(
            this.lastRefreshedCoords.latitude,
            this.lastRefreshedCoords.longitude,
            reading.latitude,
            reading.longitude
          );
          if (movedDist >= 50) {
            this.lastRefreshedCoords = { latitude: reading.latitude, longitude: reading.longitude };
            onRefreshIntelligence?.(this.lastRefreshedCoords);
          }
        } else {
          this.lastRefreshedCoords = { latitude: reading.latitude, longitude: reading.longitude };
        }
      },
      (err) => {
        console.warn('[LocationIntelligenceEngine] Live tracking warning:', err);
      }
    );

    this.activeWatchStop = stop;
    return () => {
      stop();
      this.activeWatchStop = null;
      this.lastRefreshedCoords = null;
    };
  }

  public stopLiveTracking(): void {
    if (this.activeWatchStop) {
      this.activeWatchStop();
      this.activeWatchStop = null;
      this.lastRefreshedCoords = null;
    }
  }

  /**
   * Manual Pin Placement (Rule 46).
   */
  public setManualLocation(latitude: number, longitude: number): LocationContext {
    const reading = this.manualProvider.setManualCoordinate(latitude, longitude);
    const context = this.readingToContext(reading, 'LOCKED');
    this.enrichAddressAsynchronously(latitude, longitude);
    LocationEventBus.emit('LOCATION_LOCKED', { context });
    return context;
  }

  /**
   * Development assertion verifying position integrity (Rule 34 & 35).
   * Verifies marker coordinate, map target, and current device location match within epsilon.
   */
  public assertCurrentLocationIntegrity(
    deviceCoords: { latitude: number; longitude: number } | null,
    mapCoords: { latitude: number; longitude: number } | null,
    markerCoords: { latitude: number; longitude: number } | null
  ): boolean {
    if (!deviceCoords || !mapCoords || !markerCoords) return true;

    const diffMap = haversineDistanceMeters(deviceCoords.latitude, deviceCoords.longitude, mapCoords.latitude, mapCoords.longitude);
    const diffMarker = haversineDistanceMeters(deviceCoords.latitude, deviceCoords.longitude, markerCoords.latitude, markerCoords.longitude);

    if (diffMap > 1.0 || diffMarker > 1.0) {
      console.error('[LOCATION_COORDINATE_MISMATCH]', {
        deviceCoords,
        mapCoords,
        markerCoords,
        diffMapMeters: diffMap,
        diffMarkerMeters: diffMarker,
      });

      LocationEventBus.emit('LOCATION_COORDINATE_MISMATCH', {
        source: 'assertCurrentLocationIntegrity',
        rawCoords: { lat: deviceCoords.latitude, lng: deviceCoords.longitude },
        discrepantCoords: { lat: markerCoords.latitude, lng: markerCoords.longitude },
        distanceMeters: Math.max(diffMap, diffMarker),
      });

      return false;
    }

    return true;
  }

  /**
   * Asynchronous Address Enrichment (Rule 18 & 20).
   * Output strictly enriches addressMetadata and NEVER shifts raw coordinates.
   */
  public async enrichAddressAsynchronously(latitude: number, longitude: number): Promise<AddressMetadata> {
    try {
      const data = await apiClient.get<any>('/location/reverse', { latitude, longitude });
      if (data && typeof data === 'object') {
        const metadata: AddressMetadata = {
          street: data.street || null,
          locality: data.district || data.neighborhood || data.suburb || null,
          city: data.city || null,
          state: data.state || null,
          country: data.country || null,
          countryCode: (data.countryCode || data.country_code || '').toUpperCase() || null,
          postalCode: data.postalCode || data.postcode || null,
          formattedAddress: data.displayName || data.display_name || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
        };
        useLocationStore.getState().updateDeviceAddressMetadata(metadata);
        return metadata;
      }
    } catch {}

    // Fallback: OpenStreetMap Nominatim reverse
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`,
        { headers: { 'User-Agent': 'UrbanPulse-ModernEngine' } }
      );
      if (res.ok) {
        const json = await res.json();
        const addr = json.address || {};
        const metadata: AddressMetadata = {
          houseNumber: addr.house_number || null,
          street: addr.road || addr.street || null,
          neighborhood: addr.neighbourhood || addr.suburb || null,
          locality: addr.suburb || addr.town || addr.village || null,
          district: addr.county || addr.state_district || null,
          city: addr.city || addr.town || addr.village || null,
          state: addr.state || addr.province || null,
          country: addr.country || null,
          countryCode: (addr.country_code || '').toUpperCase() || null,
          postalCode: addr.postcode || null,
          formattedAddress: json.display_name || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
        };
        useLocationStore.getState().updateDeviceAddressMetadata(metadata);
        return metadata;
      }
    } catch {}

    const fallbackMeta: AddressMetadata = {
      formattedAddress: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
    };
    useLocationStore.getState().updateDeviceAddressMetadata(fallbackMeta);
    return fallbackMeta;
  }

  private readingToContext(
    reading: ProviderReading,
    status: LocationAccuracyState,
    arbitrated?: ArbitratedResult | null
  ): LocationContext {
    const tier: LocationAccuracyTier =
      reading.accuracyMeters < 25
        ? 'EXCELLENT'
        : reading.accuracyMeters <= 75
        ? 'GOOD'
        : reading.accuracyMeters <= 250
        ? 'MODERATE'
        : 'LOW';

    const ageSec = Math.max(0, Math.floor((Date.now() - reading.timestamp) / 1000));
    const freshnessText =
      ageSec < 5
        ? 'Just now'
        : ageSec < 60
        ? `${ageSec}s ago`
        : `${Math.floor(ageSec / 60)}m ago`;

    return {
      latitude: reading.latitude,
      longitude: reading.longitude,
      rawLatitude: reading.latitude,
      rawLongitude: reading.longitude,
      accuracy: reading.accuracyMeters,
      accuracyMeters: reading.accuracyMeters,
      accuracyTier: tier,
      confidenceTier: arbitrated ? arbitrated.confidenceTier : this.arbiter.deriveConfidenceTier(reading.accuracyMeters),
      confidence: arbitrated ? arbitrated.confidenceScore : 0.85,
      timestamp: reading.timestamp,
      source: reading.source,
      status,
      isUserLocation: reading.source !== 'MANUAL',
      city: `${reading.latitude.toFixed(3)}°N`,
      country: `${reading.longitude.toFixed(3)}°E`,
      displayName: `Device Location (±${Math.round(reading.accuracyMeters)}m)`,
      freshnessText,
      providerName: reading.providerName,
    };
  }
}

export const locationEngine = LocationIntelligenceEngine.getInstance();
