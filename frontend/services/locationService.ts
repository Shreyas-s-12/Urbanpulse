import {
  ResolvedLocation,
  LocationContext,
  LocationAccuracyTier,
  LocationAccuracyState,
  RawDeviceLocation,
  AddressMetadata,
} from '@shared/types';
import { apiClient } from './apiClient';
import { useLocationStore } from '@/stores/useLocationStore';
export function getAccuracyTier(accuracy: number): LocationAccuracyTier {
  if (accuracy < 25) return 'EXCELLENT';
  if (accuracy <= 75) return 'GOOD';
  if (accuracy <= 250) return 'MODERATE';
  if (accuracy <= 1000) return 'LOW';
  return 'VERY_LOW';
}
export interface LocateOptions {
  onProgress?: (state: LocationAccuracyState, reading?: { latitude: number; longitude: number; accuracy: number }) => void;
  onRawAcquired?: (raw: RawDeviceLocation) => void;
  timeoutMs?: number;
}
import { locationEngine } from './location/LocationIntelligenceEngine';
let activeLocateRequestId = 0;

export const locationService = {
  /**
   * Request device GPS location directly from browser geolocation API.
   * Simple, direct, immediate success path:
   * MY LOCATION -> navigator.geolocation.getCurrentPosition() -> RAW COORDS -> STORE -> MAP -> MARKER
   */
  async requestDeviceLocation(options?: LocateOptions): Promise<LocationContext> {
    // Section 1: Verify button click
    console.log('LOCATION_BUTTON_CLICKED');
    const reqId = ++activeLocateRequestId;

    // Section 2: Check browser geolocation support
    if (typeof window === 'undefined' || !navigator.geolocation) {
      console.warn('Location is not supported by this browser.');
      useLocationStore.getState().setLocationAccuracyState('UNAVAILABLE');
      useLocationStore.getState().setPermissionStatus('unsupported');
      options?.onProgress?.('UNAVAILABLE');
      return {
        latitude: 0,
        longitude: 0,
        displayName: 'Location is not supported by this browser.',
        isUserLocation: false,
        source: 'DEVICE',
        status: 'UNAVAILABLE',
      };
    }

    // Section 22: Check secure context
    const isSecure = typeof window !== 'undefined' ? window.isSecureContext : true;
    if (!isSecure && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      console.warn('Browser geolocation requires a secure context (HTTPS or localhost).');
    }

    // Section 3: Check permission using Permissions API where supported
    let permissionReport: 'granted' | 'prompt' | 'denied' | 'unknown' = 'unknown';
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const pStatus = await navigator.permissions.query({ name: 'geolocation' as any });
        permissionReport = pStatus.state as any;
      }
    } catch {
      permissionReport = 'unknown';
    }
    console.log('LOCATION_PERMISSION:', permissionReport);

    if (permissionReport === 'denied') {
      useLocationStore.getState().setLocationAccuracyState('DENIED');
      useLocationStore.getState().setPermissionStatus('denied');
      options?.onProgress?.('DENIED');
      return {
        latitude: 0,
        longitude: 0,
        displayName: 'Location access is blocked in your browser.',
        isUserLocation: false,
        source: 'DEVICE',
        status: 'DENIED',
      };
    }

    // Section 6: Show real user-facing state: LOCATING
    useLocationStore.getState().setLocationAccuracyState('LOCATING');
    useLocationStore.getState().setIsResolvingLocation(true);
    options?.onProgress?.('LOCATING');

    const timeoutMs = options?.timeoutMs ?? 15000;

    return new Promise((resolve) => {
      let isSettled = false;

      // Section 4: Actually call navigator.geolocation.getCurrentPosition()
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (isSettled || reqId !== activeLocateRequestId) return;
          isSettled = true;

          const { latitude, longitude, accuracy } = position.coords;
          const timestamp = position.timestamp || Date.now();

          // Section 9: Development log for exact raw coordinates
          console.log(`RAW DEVICE LOCATION\nLAT: ${latitude}\nLNG: ${longitude}\nACCURACY: ${accuracy}\nTIMESTAMP: ${timestamp}`);

          const rawDev: RawDeviceLocation = {
            latitude,
            longitude,
            accuracyMeters: accuracy,
            timestamp,
            source: 'DEVICE',
          };

          options?.onRawAcquired?.(rawDev);

          const finalState: LocationAccuracyState = accuracy <= 25 ? 'READY' : accuracy <= 75 ? 'READY' : 'APPROXIMATE';

          // Section 10 & 11: Immediately update store, map center, and marker
          useLocationStore.getState().validateAndSetDeviceLocation(rawDev, finalState, reqId);
          useLocationStore.getState().switchToDeviceLocation();
          useLocationStore.getState().setPermissionStatus('granted');
          useLocationStore.getState().setIsResolvingLocation(false);

          if (typeof window !== 'undefined') {
            const gmap = (window as any).__UP_GMAP_INSTANCE__;
            if (gmap?.setCenter) {
              gmap.setCenter({ lat: latitude, lng: longitude });
            }
            const marker = (window as any).__UP_USER_MARKER__;
            if (marker?.setPosition) {
              marker.setPosition({ lat: latitude, lng: longitude });
            }
          }

          const context: LocationContext = {
            latitude,
            longitude,
            rawLatitude: latitude,
            rawLongitude: longitude,
            accuracy,
            accuracyMeters: accuracy,
            accuracyTier: getAccuracyTier(accuracy),
            timestamp,
            source: 'DEVICE',
            status: finalState,
            isUserLocation: true,
            displayName: `Device Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          };

          options?.onProgress?.(finalState, { latitude, longitude, accuracy });

          // Section 8: Asynchronously reverse-geocode metadata without delaying marker
          locationService.reverseGeocodeMetadata(latitude, longitude)
            .then((meta) => {
              if (reqId === activeLocateRequestId) {
                useLocationStore.getState().updateDeviceAddressMetadata(meta);
              }
            })
            .catch((e) => console.warn('[Location] Async reverse geocoding non-fatal:', e));

          // Section 26: Short background improvement window if initial fix is moderate (> 25m)
          if (accuracy > 25 && typeof navigator !== 'undefined' && navigator.geolocation.watchPosition) {
            let watchCount = 0;
            let bestAcc = accuracy;
            let stopWatchId: number | null = null;
            try {
              stopWatchId = navigator.geolocation.watchPosition(
                (improvedPos) => {
                  if (reqId !== activeLocateRequestId) return;
                  watchCount++;
                  if (improvedPos.coords.accuracy < bestAcc) {
                    bestAcc = improvedPos.coords.accuracy;
                    const improvedRaw: RawDeviceLocation = {
                      latitude: improvedPos.coords.latitude,
                      longitude: improvedPos.coords.longitude,
                      accuracyMeters: improvedPos.coords.accuracy,
                      timestamp: improvedPos.timestamp || Date.now(),
                      source: 'DEVICE',
                    };
                    const improvedState: LocationAccuracyState = bestAcc <= 75 ? 'READY' : 'APPROXIMATE';
                    useLocationStore.getState().validateAndSetDeviceLocation(improvedRaw, improvedState, reqId);
                    if (bestAcc <= 25 || watchCount >= 3) {
                      if (stopWatchId !== null) {
                        try { navigator.geolocation.clearWatch(stopWatchId); } catch {}
                        stopWatchId = null;
                      }
                    }
                  }
                },
                () => {},
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
              );

              setTimeout(() => {
                if (stopWatchId !== null) {
                  try { navigator.geolocation.clearWatch(stopWatchId); } catch {}
                  stopWatchId = null;
                }
              }, 4000);
            } catch {}
          }

          resolve(context);
        },
        (error) => {
          if (isSettled || reqId !== activeLocateRequestId) return;
          isSettled = true;

          // Section 5: Log all geolocation errors
          console.log('LOCATION_ERROR', error.code, error.message);

          let errState: LocationAccuracyState = 'UNAVAILABLE';
          let userMsg = "Your device couldn't provide a location right now.";

          if (error.code === 1) {
            // PERMISSION_DENIED
            errState = 'DENIED';
            userMsg = 'Location access is blocked in your browser.';
            useLocationStore.getState().setPermissionStatus('denied');
          } else if (error.code === 2) {
            // POSITION_UNAVAILABLE
            errState = 'UNAVAILABLE';
            userMsg = "Your device couldn't provide a location right now.";
          } else if (error.code === 3) {
            // TIMEOUT
            errState = 'TIMEOUT';
            userMsg = 'Location timed out.';
          } else {
            errState = 'ERROR';
            userMsg = error.message || 'Location error';
          }

          useLocationStore.getState().setLocationAccuracyState(errState);
          useLocationStore.getState().setIsResolvingLocation(false);
          options?.onProgress?.(errState);

          resolve({
            latitude: 0,
            longitude: 0,
            rawLatitude: 0,
            rawLongitude: 0,
            accuracy: 0,
            accuracyMeters: 0,
            accuracyTier: 'LOW',
            timestamp: Date.now(),
            source: 'DEVICE',
            status: errState,
            isUserLocation: false,
            displayName: userMsg,
          });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: timeoutMs,
        }
      );
    });
  },
  /**
   * Continuous live-tracking with stability filtering and throttled refresh.
   */
  startLiveTracking(
    onUpdate: (loc: RawDeviceLocation, context?: LocationContext) => void,
    onRefreshIntelligence?: (coords: { latitude: number; longitude: number }) => void
  ): () => void {
    return locationEngine.startLiveTracking(onUpdate, onRefreshIntelligence);
  },
  /**
   * Manual Pin Placement (Rule 46).
   */
  setManualLocation(latitude: number, longitude: number): LocationContext {
    return locationEngine.setManualLocation(latitude, longitude);
  },
  /**
   * Coordinate integrity assertion (Rule 34 & 35).
   */
  assertCurrentLocationIntegrity: locationEngine.assertCurrentLocationIntegrity.bind(locationEngine),
  /**
   * Reverse-geocodes coordinates into strictly descriptive address metadata.
   * Output never replaces or overrides raw device coordinates.
   */
  async reverseGeocodeMetadata(latitude: number, longitude: number): Promise<AddressMetadata> {
    try {
      const data = await apiClient.get<any>('/location/reverse', {
        latitude,
        longitude,
      });
      if (data && typeof data === 'object') {
        return {
          houseNumber: data.houseNumber || null,
          street: data.street || null,
          neighborhood: data.neighborhood || data.suburb || null,
          locality: data.locality || data.city || null,
          district: data.district || null,
          city: data.city || null,
          state: data.state || data.region || null,
          country: data.country || null,
          countryCode: data.countryCode || null,
          postalCode: data.postalCode || null,
          formattedAddress: data.displayName || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
          reverseGeocodeCoordinate:
            data.latitude !== undefined && data.longitude !== undefined
              ? { latitude: data.latitude, longitude: data.longitude }
              : undefined,
        };
      }
    } catch {}
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`,
        { headers: { 'User-Agent': 'UrbanPulse-Web' } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        return {
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
          formattedAddress: data.display_name || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
          reverseGeocodeCoordinate:
            data.lat && data.lon
              ? { latitude: parseFloat(data.lat), longitude: parseFloat(data.lon) }
              : undefined,
        };
      }
    } catch {}
    return {
      formattedAddress: `Coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
    };
  },
  /**
   * Reverse-geocodes coordinates into display labels (city, district, state, country).
   * Strictly preserves input latitude and longitude, NEVER substituting a city centroid.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ResolvedLocation> {
    try {
      const data = await apiClient.get<ResolvedLocation>('/location/reverse', {
        latitude,
        longitude,
      });
      if (data && typeof data === 'object') {
        return {
          ...data,
          latitude, // Guaranteed preservation
          longitude, // Guaranteed preservation
          isUserLocation: false,
        };
      }
    } catch {}
    // Fallback: direct Nominatim reverse query
    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/reverse?lat=' + latitude + '&lon=' + longitude + '&format=jsonv2&addressdetails=1',
        { headers: { 'User-Agent': 'UrbanPulse-Web' } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.suburb ||
          'Local Area';
        const district = addr.county || addr.state_district || '';
        const state = addr.state || addr.province || '';
        const region = state;
        const country = addr.country || '';
        const countryCode = (addr.country_code || '').toUpperCase() || undefined;
        const regionCode = addr['ISO3166-2-lvl4'] || undefined;
        return {
          latitude,
          longitude,
          city,
          district,
          state,
          region,
          country,
          countryCode,
          regionCode,
          displayName: data.display_name || (city + ', ' + country),
          isUserLocation: false,
        };
      }
    } catch (e) {
      console.warn('Reverse geocode direct fallback error:', e);
    }
    return {
      latitude,
      longitude,
      city: latitude.toFixed(4) + '°N',
      country: longitude.toFixed(4) + '°E',
      displayName: 'Coordinates (' + latitude.toFixed(4) + ', ' + longitude.toFixed(4) + ')',
      isUserLocation: false,
    };
  },
  /**
   * Searches any city, address, landmark, or coordinates with context-aware disambiguation.
   */
  async searchLocation(
    query: string,
    bias?: { latitude?: number; longitude?: number; countryCode?: string }
  ): Promise<ResolvedLocation[]> {
    const q = query.trim();
    if (!q) return [];
    const coordMatch = q.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      const resolved = await locationService.reverseGeocode(lat, lon);
      return [resolved];
    }
    try {
      const params: Record<string, any> = { query: q };
      if (bias?.latitude !== undefined && bias?.longitude !== undefined) {
        params.lat = bias.latitude;
        params.lon = bias.longitude;
      }
      if (bias?.countryCode) {
        params.country_code = bias.countryCode;
      }
      const results = await apiClient.get<ResolvedLocation[]>('/location/search', params);
      if (Array.isArray(results) && results.length > 0) {
        return results.map((item) => ({
          ...item,
          source: 'SEARCH',
          isUserLocation: false,
        }));
      }
    } catch {}
    // Direct fallback: Open-Meteo Geocoding
    try {
      const res = await fetch(
        'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=6&language=en&format=json'
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.results || [];
        if (items.length > 0) {
          return items.map((item: any) => ({
            latitude: item.latitude,
            longitude: item.longitude,
            city: item.name,
            district: item.admin2 || null,
            state: item.admin1 || null,
            region: item.admin1 || null,
            country: item.country || null,
            countryCode: (item.country_code || '').toUpperCase() || undefined,
            displayName: `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}${item.country ? ', ' + item.country : ''}`,
            source: 'SEARCH',
            isUserLocation: false,
          }));
        }
      }
    } catch (e) {
      console.warn('Search geocode direct fallback error:', e);
    }
    return [];
  },
};
