import { CivilSafetySummary } from '@shared/types';
import { apiClient } from './apiClient';

export const civilSafetyService = {
  /**
   * Fetches real-time civil safety, open police records, and civil defense advisories.
   * Strictly distinguishes 0 verified incidents from NO_COVERAGE.
   */
  async getCivilSafety(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    countryCode?: string | null,
    city?: string | null
  ): Promise<CivilSafetySummary> {
    try {
      const data = await apiClient.get<CivilSafetySummary>('/civil-safety', {
        latitude,
        longitude,
        radius_km: radiusKm,
        country_code: countryCode || undefined,
        city: city || undefined,
      });

      if (data && data.status) {
        return data;
      }
    } catch (err) {
      console.warn('Backend civil safety query error:', err);
    }

    return {
      status: 'NO_COVERAGE',
      feedCapability: 'NO_COVERAGE',
      incidentCount: null,
      incidents: [],
      alerts: [],
      alertCount: 0,
      updates: [],
      updateCount: 0,
      sources: [
        {
          name: 'Official Police Feeds',
          type: 'GOVERNMENT_STATION',
          authority: 'Jurisdiction-Dependent Open Data Feed',
        },
      ],
      coverage: 'Global Civil Safety Resolver',
      confidence: 0.0,
      observedAt: new Date().toISOString(),
      message: 'No verified public safety or police dispatch API covers these coordinates.',
    };
  },
};
