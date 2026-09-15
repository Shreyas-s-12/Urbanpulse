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
export const locationService = {
  /**
   * Request device GPS location via centralized LocationIntelligenceEngine.
   * Auto-improves, filters stability, arbitrates providers, and preserves raw coordinates.
   */
  async requestDeviceLocation(options?: LocateOptions): Promise<LocationContext> {
    return locationEngine.acquireLocation({
      onProgress: (state, reading) => {
        options?.onProgress?.(
          state,
          reading
            ? {
                latitude: reading.latitude,
                longitude: reading.longitude,
                accuracy: reading.accuracyMeters,
              }
            : undefined
        );
      },
      onRawAcquired: options?.onRawAcquired,
      timeoutMs: options?.timeoutMs,
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
