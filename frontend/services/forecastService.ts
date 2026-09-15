/**
 * Location Multi-Pillar Forecasting Service
 * Queries backend /api/v1/forecast for authentic Open-Meteo numerical weather and CAMS AQI models.
 * Strictly never fabricates or invents predictions.
 */

import { apiClient } from './apiClient';

export interface ForecastDailyPoint {
  date: string;
  temperatureMinC: number;
  temperatureMaxC: number;
  tempHighC: number;
  tempLowC: number;
  precipitationProbability: number;
  weatherCondition: string;
  trafficTendency: string;
  predictedAqi: number;
  aqiValue: number;
  aqiRange: [number, number];
  aqiScale: string;
  aqiCategory: string;
  urbanConditionScore: number;
  confidence: number;
  isEstimate: boolean;
}

export interface MultiPillarForecastResponse {
  location?: any;
  horizon: '7_DAYS' | '30_DAYS';
  summary: string;
  daily: ForecastDailyPoint[];
  monthlyOutlook?: {
    expectedRange: [number, number];
    trend: string;
    seasonalRisks: string[];
    climatologicalContext: string;
  };
  confidence: number;
  sources: Array<{ type: string; source: string; generatedAt?: string }>;
  limitations?: string[];
  generatedAt: string;
  coverageStatus?: 'AVAILABLE' | 'PARTIAL' | 'NO_COVERAGE' | 'ERROR';
}

export const forecastService = {
  async getForecast(
    latitude: number,
    longitude: number,
    horizon: '7_DAYS' | '30_DAYS' = '7_DAYS',
    city?: string,
    countryCode?: string,
    signal?: AbortSignal
  ): Promise<MultiPillarForecastResponse> {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      horizon,
    });

    if (city) params.append('city', city);
    if (countryCode) params.append('country_code', countryCode);

    try {
      const data = await apiClient.get<MultiPillarForecastResponse>(
        `/forecast?${params.toString()}`,
        { signal }
      );

      const daily = data.daily || [];

      return {
        ...data,
        daily,
        coverageStatus: daily.length >= 5 ? 'AVAILABLE' : (daily.length > 0 ? 'PARTIAL' : 'NO_COVERAGE'),
      };
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }
      console.warn('[ForecastService] Remote forecast query failed:', err);
      throw new Error(err?.message || 'Failed to retrieve forecast telemetry.');
    }
  },
};
