/**
 * UrbanPulse Heatmap Service
 * Fetches normalized spatial intelligence cells for deck.gl overlay.
 */

import { apiFetch } from './apiClient';
import { HeatmapResponse, HeatmapMetric, HeatmapSubMetric, HeatmapGeography, HeatmapTimeWindow } from '@shared/types';

export interface FetchHeatmapOptions {
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
  metric?: HeatmapMetric;
  subMetric?: HeatmapSubMetric;
  geography?: HeatmapGeography;
  timeWindow?: HeatmapTimeWindow;
  hours?: number;
  country?: string;
  region?: string;
  placeName?: string;
  viewportBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom?: number;
  signal?: AbortSignal;
}

export const heatmapService = {
  /**
   * Fetches real-data spatial intelligence heatmap from backend.
   * Guaranteed to return structured statistical metrics and scope-decoupled diagnostics.
   */
  async fetchHeatmap(
    optionsOrLat?: FetchHeatmapOptions | number | null,
    legacyLng?: number | null,
    legacyRadiusKm: number = 50,
    legacyMetric: HeatmapMetric = 'AQI',
    legacySubMetric?: HeatmapSubMetric,
    legacyGeography: HeatmapGeography = 'CITY',
    legacyTimeWindow: HeatmapTimeWindow = 'NOW',
    legacyHours: number = 24,
    legacyCountry?: string,
    legacyRegion?: string,
    legacyPlaceName?: string,
    legacySignal?: AbortSignal
  ): Promise<HeatmapResponse> {
    let opts: FetchHeatmapOptions;
    if (typeof optionsOrLat === 'object' && optionsOrLat !== null) {
      opts = optionsOrLat;
    } else {
      opts = {
        latitude: optionsOrLat,
        longitude: legacyLng,
        radiusKm: legacyRadiusKm,
        metric: legacyMetric,
        subMetric: legacySubMetric,
        geography: legacyGeography,
        timeWindow: legacyTimeWindow,
        hours: legacyHours,
        country: legacyCountry,
        region: legacyRegion,
        placeName: legacyPlaceName,
        signal: legacySignal,
      };
    }

    const params = new URLSearchParams();
    if (opts.latitude !== undefined && opts.latitude !== null) {
      params.set('lat', opts.latitude.toString());
    }
    if (opts.longitude !== undefined && opts.longitude !== null) {
      params.set('lng', opts.longitude.toString());
    }
    if (opts.radiusKm !== undefined && opts.radiusKm !== null) {
      params.set('radius_km', opts.radiusKm.toString());
    }
    if (opts.metric) {
      params.set('metric', opts.metric);
    }
    if (opts.geography) {
      params.set('geography', opts.geography);
    }
    if (opts.timeWindow) {
      params.set('time_window', opts.timeWindow);
    }
    if (opts.hours !== undefined && opts.hours !== null) {
      params.set('hours', opts.hours.toString());
    }
    if (opts.subMetric) {
      params.set('sub_metric', opts.subMetric);
    }
    if (opts.country) {
      params.set('country', opts.country);
    }
    if (opts.region) {
      params.set('region', opts.region);
    }
    if (opts.placeName) {
      params.set('place_name', opts.placeName);
    }
    if (opts.viewportBounds) {
      params.set('viewport_north', opts.viewportBounds.north.toString());
      params.set('viewport_south', opts.viewportBounds.south.toString());
      params.set('viewport_east', opts.viewportBounds.east.toString());
      params.set('viewport_west', opts.viewportBounds.west.toString());
    }
    if (opts.zoom !== undefined && opts.zoom !== null) {
      params.set('zoom', opts.zoom.toString());
    }

    return apiFetch<HeatmapResponse>(`/intelligence/heatmap?${params.toString()}`, {
      signal: opts.signal,
    });
  },
};

