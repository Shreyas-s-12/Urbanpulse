'use client';

import {
  SelectedSearchLocation,
  PlaceCategoryType,
  LocationSearchConfidence,
} from '@shared/types';
import { googleMapsLoader } from '@/services/googleMapsLoader';

export interface AutocompleteResultItem {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
  categoryType: PlaceCategoryType;
  confidence?: LocationSearchConfidence;
}

export class LocationSearchService {
  private static placesService: any = null;
  private static autocompleteService: any = null;

  private static mapTypesToCategory(types: string[] = []): PlaceCategoryType {
    if (types.includes('country')) return 'COUNTRY';
    if (types.includes('administrative_area_level_1') || types.includes('administrative_area_level_2')) return 'REGION';
    if (types.includes('locality') || types.includes('postal_town')) return 'CITY';
    if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) return 'NEIGHBORHOOD';
    if (types.includes('route')) return 'STREET';
    if (types.includes('street_address') || types.includes('premise') || types.includes('subpremise')) return 'ADDRESS';
    if (types.includes('point_of_interest') || types.includes('establishment')) return 'POI';
    if (types.includes('natural_feature') || types.includes('tourist_attraction')) return 'LANDMARK';
    return 'AREA';
  }

  public static getTypeAwareZoom(category?: PlaceCategoryType, types: string[] = []): number {
    const cat = category || this.mapTypesToCategory(types);
    switch (cat) {
      case 'COUNTRY':
        return 5;
      case 'REGION':
        return 8;
      case 'CITY':
      case 'TOWN':
        return 12;
      case 'DISTRICT':
        return 11;
      case 'NEIGHBORHOOD':
      case 'AREA':
        return 14;
      case 'STREET':
        return 16;
      case 'ADDRESS':
      case 'POI':
      case 'LANDMARK':
        return 17;
      default:
        return 13;
    }
  }

  public static async autocomplete(
    query: string,
    options?: {
      latitude?: number;
      longitude?: number;
      countryCode?: string;
    }
  ): Promise<AutocompleteResultItem[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    // Direct Coordinate Input Support (e.g., "12.9716, 77.5946" or "12.9716 77.5946")
    const coordMatch = q.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [
          {
            placeId: `coords_${lat.toFixed(5)}_${lng.toFixed(5)}`,
            primaryText: `Coordinates: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
            secondaryText: 'Custom global coordinates target',
            fullText: `Geospatial coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            types: ['geocode', 'coordinates'],
            categoryType: 'COORDINATES' as any,
            confidence: 'HIGH',
          },
        ];
      }
    }

    try {
      const mapStatus = googleMapsLoader.getStatus();
      const hasKey = googleMapsLoader.hasApiKey();

      // Only attempt Google Places if API key is present and map is not in a terminal failure state
      let placesLib = (window as any).google?.maps?.places;
      if (!placesLib && hasKey && mapStatus !== 'ERROR' && mapStatus !== 'TIMEOUT' && mapStatus !== 'UNAVAILABLE') {
        placesLib = await googleMapsLoader.importLibrary('places');
      }

      if (placesLib?.AutocompleteService) {
        if (!this.autocompleteService) {
          this.autocompleteService = new placesLib.AutocompleteService();
        }

        const req: any = { input: q };

        // Proximity bias based on active/device coordinates
        if (options?.latitude && options?.longitude && (window as any).google?.maps?.LatLng) {
          req.location = new (window as any).google.maps.LatLng(options.latitude, options.longitude);
          req.radius = 50000; // 50km contextual bias
        }

        if (options?.countryCode) {
          req.componentRestrictions = { country: options.countryCode.toLowerCase() };
        }

        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve(this.fallbackSearch(q));
          }, 2500);

          this.autocompleteService.getPlacePredictions(
            req,
            (predictions: any[], status: any) => {
              clearTimeout(timeout);
              if (status !== placesLib.PlacesServiceStatus.OK || !predictions) {
                // If country restriction caused zero results, retry without restriction
                if (req.componentRestrictions) {
                  delete req.componentRestrictions;
                  this.autocompleteService.getPlacePredictions(req, (p2: any[], s2: any) => {
                    if (s2 === placesLib.PlacesServiceStatus.OK && p2) {
                      resolve(this.formatPredictions(p2));
                    } else {
                      resolve(this.fallbackSearch(q));
                    }
                  });
                  return;
                }
                resolve(this.fallbackSearch(q));
                return;
              }
              resolve(this.formatPredictions(predictions));
            }
          );
        });
      }
    } catch (err) {
      console.warn('[LocationSearchService] Google autocomplete error, using fallback:', err);
    }

    return this.fallbackSearch(q);
  }

  private static formatPredictions(predictions: any[]): AutocompleteResultItem[] {
    return predictions.map((p) => {
      const types = p.types || [];
      const cat = this.mapTypesToCategory(types);
      const primary = p.structured_formatting?.main_text || p.description;
      const secondary = p.structured_formatting?.secondary_text || '';

      return {
        placeId: p.place_id,
        primaryText: primary,
        secondaryText: secondary,
        fullText: p.description,
        types,
        categoryType: cat,
        confidence: cat === 'ADDRESS' || cat === 'POI' ? 'HIGH' : cat === 'CITY' ? 'HIGH' : 'MODERATE',
      };
    });
  }

  private static async fallbackSearch(query: string): Promise<AutocompleteResultItem[]> {
    try {
      const res = await fetch(`/api/v1/geocoding/search?query=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      const results = Array.isArray(data) ? data : data.results || [];

      return results.map((item: any) => ({
        placeId: item.placeId || `coord_${item.latitude}_${item.longitude}`,
        primaryText: item.name || item.city || item.displayName || query,
        secondaryText: [item.district, item.state, item.country].filter(Boolean).join(', '),
        fullText: item.displayName || `${item.latitude}, ${item.longitude}`,
        types: item.types || ['geocode'],
        categoryType: 'CITY',
        confidence: 'MODERATE',
      }));
    } catch {
      return [];
    }
  }

  public static async getPlaceDetails(
    placeId: string,
    fallbackCoords?: { latitude: number; longitude: number }
  ): Promise<SelectedSearchLocation | null> {
    // Direct coordinate resolution
    if (placeId.startsWith('coords_')) {
      const parts = placeId.split('_');
      const lat = parseFloat(parts[1]);
      const lng = parseFloat(parts[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          placeId,
          latitude: lat,
          longitude: lng,
          displayName: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          formattedAddress: `Latitude ${lat.toFixed(4)}, Longitude ${lng.toFixed(4)}`,
          city: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`,
          country: 'Global Coordinate',
          types: ['coordinates'],
          categoryType: 'COORDINATES' as any,
          confidence: 'HIGH',
          source: 'SEARCH',
          timestamp: Date.now(),
        };
      }
    }

    try {
      const mapStatus = googleMapsLoader.getStatus();
      const hasKey = googleMapsLoader.hasApiKey();

      let placesLib = (window as any).google?.maps?.places;
      if (!placesLib && hasKey && mapStatus !== 'ERROR' && mapStatus !== 'TIMEOUT' && mapStatus !== 'UNAVAILABLE') {
        placesLib = await googleMapsLoader.importLibrary('places');
      }

      if (placesLib?.PlacesService) {
        if (!this.placesService) {
          const dummyDiv = document.createElement('div');
          this.placesService = new placesLib.PlacesService(dummyDiv);
        }

        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve(this.fallbackGeocode(placeId, fallbackCoords));
          }, 3000);

          this.placesService.getDetails(
            {
              placeId,
              fields: [
                'place_id',
                'geometry',
                'name',
                'formatted_address',
                'address_components',
                'types',
              ],
            },
            (place: any, status: any) => {
              clearTimeout(timeout);
              if (status === placesLib.PlacesServiceStatus.OK && place?.geometry?.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const types = place.types || [];
                const cat = this.mapTypesToCategory(types);

                let city: string | null = null;
                let locality: string | null = null;
                let neighborhood: string | null = null;
                let state: string | null = null;
                let country: string | null = null;
                let countryCode: string | null = null;

                if (Array.isArray(place.address_components)) {
                  place.address_components.forEach((comp: any) => {
                    const cTypes = comp.types || [];
                    if (cTypes.includes('locality')) city = comp.long_name;
                    if (cTypes.includes('sublocality') || cTypes.includes('sublocality_level_1')) locality = comp.long_name;
                    if (cTypes.includes('neighborhood')) neighborhood = comp.long_name;
                    if (cTypes.includes('administrative_area_level_1')) state = comp.long_name;
                    if (cTypes.includes('country')) {
                      country = comp.long_name;
                      countryCode = comp.short_name;
                    }
                  });
                }

                resolve({
                  placeId: place.place_id || placeId,
                  latitude: lat,
                  longitude: lng,
                  displayName: place.name || locality || city || place.formatted_address,
                  formattedAddress: place.formatted_address,
                  city: city || locality,
                  locality,
                  neighborhood,
                  state,
                  country,
                  countryCode,
                  types,
                  categoryType: cat,
                  confidence: cat === 'ADDRESS' || cat === 'POI' ? 'HIGH' : 'MODERATE',
                  source: 'SEARCH',
                  timestamp: Date.now(),
                });
                return;
              }

              // If PlacesService fails or rate limits, fallback to geocoding
              resolve(this.fallbackGeocode(placeId, fallbackCoords));
            }
          );
        });
      }
    } catch (err) {
      console.warn('[LocationSearchService] PlacesService detail error:', err);
    }

    return this.fallbackGeocode(placeId, fallbackCoords);
  }

  private static async fallbackGeocode(
    placeIdOrQuery: string,
    fallbackCoords?: { latitude: number; longitude: number }
  ): Promise<SelectedSearchLocation | null> {
    if (fallbackCoords) {
      return {
        latitude: fallbackCoords.latitude,
        longitude: fallbackCoords.longitude,
        displayName: `Selected Point (${fallbackCoords.latitude.toFixed(4)}, ${fallbackCoords.longitude.toFixed(4)})`,
        source: 'SEARCH',
        timestamp: Date.now(),
      };
    }

    try {
      const res = await fetch(`/api/v1/geocoding/search?query=${encodeURIComponent(placeIdOrQuery)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const results = Array.isArray(data) ? data : data.results || [];
      if (results.length > 0) {
        const item = results[0];
        return {
          placeId: item.placeId,
          latitude: item.latitude,
          longitude: item.longitude,
          displayName: item.displayName || item.city,
          formattedAddress: item.displayName,
          city: item.city,
          state: item.state,
          country: item.country,
          countryCode: item.countryCode,
          source: 'SEARCH',
          timestamp: Date.now(),
        };
      }
    } catch {}

    return null;
  }
}

export const locationSearchService = LocationSearchService;
