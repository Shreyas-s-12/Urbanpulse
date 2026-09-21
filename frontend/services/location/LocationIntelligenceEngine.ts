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
  private currentRequestId = 0;

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
    const autoImproveMs = options?.autoImproveTimeoutMs ?? 4000;

    const reqId = ++this.currentRequestId;
    this.stabilityFilter.reset();

    LocationEventBus.emit('LOCATION_REQUESTED', {
      provider: 'BrowserGeolocationProvider',
      timestamp: Date.now(),
    });

    onProgress?.('LOCATING');
    this.isAcquiring = true;
    useLocationStore.getState().setLocationAccuracyState('LOCATING');
    useLocationStore.getState().setIsResolvingLocation(true);

    return new Promise((resolve) => {
      let isSettled = false;
      let bestReading: ProviderReading | null = null;
      let readCount = 0;
      let improveTimer: NodeJS.Timeout | null = null;
      let stopWatch: (() => void) | null = null;

      const finish = (reading: ProviderReading, state: LocationAccuracyState) => {
        if (isSettled || reqId !== this.currentRequestId) return;
        isSettled = true;
        this.isAcquiring = false;

        if (improveTimer) {
          clearTimeout(improveTimer);
          improveTimer = null;
        }
        if (stopWatch) {
          try { stopWatch(); } catch {}
          stopWatch = null;
        }

        // Authoritative raw device coordinates strictly preserved (Rule 1, 2, 4)
        const rawDev: RawDeviceLocation = {
          latitude: reading.latitude,
          longitude: reading.longitude,
          accuracyMeters: reading.accuracyMeters,
          timestamp: reading.timestamp,
          source: 'DEVICE',
        };

        // Update central store immediately
        useLocationStore.getState().validateAndSetDeviceLocation(rawDev, state, reqId);
        useLocationStore.getState().switchToDeviceLocation();

        // Persist to session cache
        this.lastKnownProvider.saveLastKnown(reading);

        const context = this.readingToContext(reading, state);

        LocationEventBus.emit('LOCATION_LOCKED', { context });
        onProgress?.(state, reading);

        // Progressive enrichment: asynchronous address resolution without altering coordinates (Rule 10)
        this.enrichAddressAsynchronously(reading.latitude, reading.longitude);

        resolve(context);
      };

      const fail = (errorState: LocationAccuracyState, message: string) => {
        if (isSettled || reqId !== this.currentRequestId) return;
        isSettled = true;
        this.isAcquiring = false;

        if (improveTimer) {
          clearTimeout(improveTimer);
          improveTimer = null;
        }
        if (stopWatch) {
          try { stopWatch(); } catch {}
          stopWatch = null;
        }

        useLocationStore.getState().setLocationAccuracyState(errorState);
        useLocationStore.getState().setIsResolvingLocation(false);
        onProgress?.(errorState);
        LocationEventBus.emit('LOCATION_FAILED', { error: message });

        // Controlled resolution with error status (NEVER throws uncaught - Rule 15, 16)
        resolve({
          latitude: 0,
          longitude: 0,
          rawLatitude: 0,
          rawLongitude: 0,
          accuracy: 0,
          accuracyMeters: 0,
          accuracyTier: 'LOW',
          confidenceTier: 'LOW',
          confidence: 0,
          timestamp: Date.now(),
          source: 'DEVICE',
          status: errorState,
          isUserLocation: false,
          city: 'Location Unavailable',
          displayName: errorState === 'DENIED' ? 'Location Permission Denied' : 'Location Unavailable',
        });
      };

      // Browser Environment and API Availability Safety Guard (Rule 14)
      if (typeof window === 'undefined' || !this.browserProvider.isAvailable()) {
        fail('UNAVAILABLE', 'Geolocation is not available on this browser/environment.');
        return;
      }

      try {
        stopWatch = this.browserProvider.watchLocation(
          (incoming) => {
            if (isSettled || reqId !== this.currentRequestId) return;
            readCount++;

            const rawIncoming: RawDeviceLocation = {
              latitude: incoming.latitude,
              longitude: incoming.longitude,
              accuracyMeters: incoming.accuracyMeters,
              timestamp: incoming.timestamp,
              source: 'DEVICE',
            };

            // First reading (T+0): Immediately position marker & center map without delay
            if (readCount === 1) {
              bestReading = incoming;
              onRawAcquired?.(rawIncoming);

              const initialStatus: LocationAccuracyState =
                incoming.accuracyMeters <= 25 ? 'READY' : incoming.accuracyMeters <= 75 ? 'IMPROVING' : 'APPROXIMATE';

              useLocationStore.getState().validateAndSetDeviceLocation(rawIncoming, initialStatus, reqId);
              onProgress?.(initialStatus, incoming);

              // High precision fix (<= 25m): Lock immediately
              if (incoming.accuracyMeters <= 25) {
                finish(incoming, 'READY');
                return;
              }

              // Otherwise start controlled acquisition window to improve reading
              improveTimer = setTimeout(() => {
                if (!isSettled && bestReading && reqId === this.currentRequestId) {
                  const finalState: LocationAccuracyState = bestReading.accuracyMeters <= 75 ? 'READY' : 'APPROXIMATE';
                  finish(bestReading, finalState);
                }
              }, autoImproveMs);
            } else {
              // Consecutive reading: Keep best valid reading (Rule 6)
              if (!bestReading || incoming.accuracyMeters < bestReading.accuracyMeters) {
                const prevAcc = bestReading ? bestReading.accuracyMeters : 9999;
                bestReading = incoming;

                LocationEventBus.emit('LOCATION_IMPROVED', {
                  reading: this.readingToContext(incoming, 'IMPROVING'),
                  previousAccuracy: prevAcc,
                });

                onProgress?.('IMPROVING', incoming);
                useLocationStore.getState().validateAndSetDeviceLocation(rawIncoming, 'IMPROVING', reqId);

                // Auto-lock if high confidence reached
                if (incoming.accuracyMeters <= 25 || (incoming.accuracyMeters <= 50 && readCount >= 3)) {
                  finish(incoming, 'READY');
                }
              }
            }
          },
          (err) => {
            if (isSettled || reqId !== this.currentRequestId) return;
            console.warn('[LocationIntelligenceEngine] Geolocation callback error handled safely:', err);

            let errorState: LocationAccuracyState = 'UNAVAILABLE';
            if (err) {
              if (err.code === 1 || err.name === 'NotAllowedError' || String(err.message).toLowerCase().includes('denied')) {
                errorState = 'DENIED';
                useLocationStore.getState().setPermissionStatus('denied');
              } else if (err.code === 2) {
                errorState = 'UNAVAILABLE';
              } else if (err.code === 3) {
                errorState = 'UNAVAILABLE';
              }
            }
            fail(errorState, err?.message || 'Geolocation error');
          }
        );

        // Overall watchdog safety timeout (Rule 15, 33)
        setTimeout(() => {
          if (!isSettled && reqId === this.currentRequestId) {
            if (bestReading) {
              const finalState: LocationAccuracyState = (bestReading as ProviderReading).accuracyMeters <= 75 ? 'READY' : 'APPROXIMATE';
              finish(bestReading, finalState);
            } else {
              fail('UNAVAILABLE', 'Location acquisition timed out.');
            }
          }
        }, timeoutMs);
      } catch (catastrophicErr: any) {
        console.warn('[LocationIntelligenceEngine] Catastrophic geolocation launch error guarded:', catastrophicErr);
        fail('ERROR', catastrophicErr?.message || 'Failed to start geolocation');
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
