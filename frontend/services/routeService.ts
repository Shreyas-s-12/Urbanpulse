import { ResolvedLocation, RoutePlan, TravelMode } from '@shared/types';
import { apiClient } from './apiClient';

export const routeService = {
  /**
   * Calls the FastAPI backend /routes/analyze endpoint for authentic Google Routes API routing.
   * Derives real Google traffic conditions and separate UrbanPulse hazard risks.
   * Does NOT substitute mock routes if Google Routes API fails.
   */
  async calculateRoutes(
    from: ResolvedLocation,
    to: ResolvedLocation,
    mode: TravelMode = 'drive',
    departureTime: string = 'Immediate'
  ): Promise<RoutePlan> {
    if (!from || !to) {
      throw new Error('Origin and destination coordinates are required.');
    }

    try {
      const plan = await apiClient.post<RoutePlan>('/routes/analyze', {
        from_location: from,
        to_location: to,
        travel_mode: mode,
        departure_time: departureTime,
      });

      if (plan && plan.candidateRoutes && plan.candidateRoutes.length > 0) {
        return plan;
      }

      throw new Error('No traffic-aware candidate routes returned by Google Routes API.');
    } catch (err: any) {
      console.error('Real-time route calculation failed:', err);
      const detail =
        err?.data?.detail ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to connect to real-time Google Routes service.';
      throw new Error(detail);
    }
  },
};
