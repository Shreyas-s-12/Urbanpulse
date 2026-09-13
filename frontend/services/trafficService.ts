import { TrafficConditionSummary } from '@shared/types';
import { apiClient } from './apiClient';

export const trafficService = {
  /**
   * Fetches authentic real-time Google Traffic conditions from the backend.
   * Does NOT fabricate or simulate traffic data.
   */
  async getTrafficSummary(
    latitude: number,
    longitude: number,
    radiusKm: number = 50
  ): Promise<TrafficConditionSummary> {
    try {
      const data = await apiClient.get<TrafficConditionSummary>('/traffic', {
        latitude,
        longitude,
        radius_km: radiusKm,
      });

      if (data && data.trafficStatus) {
        return data;
      }
    } catch (err) {
      console.warn('Backend traffic query error:', err);
    }

    return {
      status: 'UNAVAILABLE',
      trafficStatus: 'UNAVAILABLE',
      label: 'UNAVAILABLE',
      delayMinutes: 0,
      delayRatio: 1.0,
      detail: 'No verified feed',
      location: { latitude, longitude },
      radiusKm,
      source: 'Google Routes API',
      lastUpdated: new Date().toISOString(),
      reason: 'No verified Google traffic data available for this area',
    };
  },
};
