import { ResolvedLocation } from '@shared/types';
import { apiClient } from './apiClient';

export const locationService = {
  async requestDeviceLocation(): Promise<ResolvedLocation> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          try {
            const resolved = await locationService.reverseGeocode(latitude, longitude);
            resolve({
              ...resolved,
              accuracy,
              isUserLocation: true,
            });
          } catch {
            resolve({
              latitude,
              longitude,
              accuracy,
              city: latitude.toFixed(2) + '°N',
              country: longitude.toFixed(2) + '°E',
              displayName: 'Current Location (' + latitude.toFixed(4) + ', ' + longitude.toFixed(4) + ')',
              isUserLocation: true,
            });
          }
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  },

  async reverseGeocode(latitude: number, longitude: number): Promise<ResolvedLocation> {
    try {
      const data = await apiClient.get<ResolvedLocation>('/location/reverse', {
        latitude,
        longitude,
      });
      if (data && data.latitude !== undefined) {
        return {
          ...data,
          isUserLocation: false,
        };
      }
    } catch {}

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
          displayName: data.display_name || city + ', ' + country,
          isUserLocation: false,
        };
      }
    } catch (e) {
      console.warn('Reverse geocode direct fallback error:', e);
    }

    return {
      latitude,
      longitude,
      city: latitude.toFixed(2) + '°N',
      country: longitude.toFixed(2) + '°E',
      displayName: 'Coordinates (' + latitude.toFixed(4) + ', ' + longitude.toFixed(4) + ')',
      isUserLocation: false,
    };
  },

  async searchLocation(query: string): Promise<ResolvedLocation[]> {
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
      const results = await apiClient.get<ResolvedLocation[]>('/location/search', {
        query: q,
      });
      if (Array.isArray(results) && results.length > 0) {
        return results;
      }
    } catch {}

    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=jsonv2&addressdetails=1&limit=6',
        { headers: { 'User-Agent': 'UrbanPulse-Web' } }
      );
      if (res.ok) {
        const items = await res.json();
        return items.map((item: any) => {
          const addr = item.address || {};
          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.suburb ||
            item.name ||
            'Location';
          const district = addr.county || addr.state_district || '';
          const state = addr.state || addr.province || '';
          const region = state;
          const country = addr.country || '';
          const countryCode = (addr.country_code || '').toUpperCase() || undefined;
          const regionCode = addr['ISO3166-2-lvl4'] || undefined;

          return {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            city,
            district,
            state,
            region,
            country,
            countryCode,
            regionCode,
            displayName: item.display_name || city + ', ' + country,
            isUserLocation: false,
          };
        });
      }
    } catch (e) {
      console.warn('Search geocode direct fallback error:', e);
    }

    return [];
  },
};
