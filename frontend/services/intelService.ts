import { UrbanIntelResponse } from '@shared/types';
import { apiClient } from './apiClient';

export const intelService = {
  async getFullIntelligence(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    scale?: string,
    units: string = 'metric'
  ): Promise<UrbanIntelResponse> {
    return await apiClient.get<UrbanIntelResponse>('/intel', {
      latitude,
      longitude,
      radius_km: radiusKm,
      scale,
      units,
    });
  },
};
