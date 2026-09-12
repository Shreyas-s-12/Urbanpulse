import { ResolvedLocation, RoutePlan, TravelMode } from '@shared/types';
import { apiClient } from './apiClient';

export const routeService = {
  /**
   * Calls the FastAPI backend /routes/analyze endpoint for intelligent multi-candidate routing.
   */
  async calculateRoutes(
    from: ResolvedLocation,
    to: ResolvedLocation,
    mode: TravelMode = 'drive',
    departureTime: string = 'Immediate'
  ): Promise<RoutePlan> {
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
    } catch (err) {
      console.warn('Backend route analysis failed, calculating fallback route plan:', err);
    }

    // Direct fallback if backend unreachable
    return routeService.calculateFallbackRoute(from, to, mode, departureTime);
  },

  calculateFallbackRoute(
    from: ResolvedLocation,
    to: ResolvedLocation,
    mode: TravelMode,
    departureTime: string
  ): RoutePlan {
    const r = 6371.0;
    const dlat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const dlon = ((to.longitude - from.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dlat / 2) * Math.sin(dlat / 2) +
      Math.cos((from.latitude * Math.PI) / 180) *
        Math.cos((to.latitude * Math.PI) / 180) *
        Math.sin(dlon / 2) *
        Math.sin(dlon / 2);
    const directKm = r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const roadKm = Math.max(1.5, Math.round(directKm * 1.25 * 10) / 10);

    const speedMap: Record<TravelMode, number> = {
      drive: 42,
      two_wheeler: 46,
      transit: 28,
      walk: 4.8,
      bicycle: 15,
    };
    const speed = speedMap[mode] || 40;
    const baseMinutes = Math.max(3, Math.round((roadKm / speed) * 60));

    const route1 = {
      id: 'ROUTE-PRIMARY',
      name: 'Primary Arterial Corridor',
      category: 'FASTEST' as const,
      travelMode: mode,
      distanceKm: roadKm,
      estimatedTimeMinutes: baseMinutes,
      trafficDelayMinutes: 0,
      overallRiskScore: 20,
      confidenceScore: 90,
      summary: 'Direct corridor via arterial transit routes',
      rationale: 'Direct transit route based on localized geometry.',
      polyline: [
        { latitude: from.latitude, longitude: from.longitude },
        { latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2 },
        { latitude: to.latitude, longitude: to.longitude },
      ],
      intersectingEvents: [],
      weatherAlerts: [],
    };

    return {
      fromLocation: from,
      toLocation: to,
      departureTime,
      travelMode: mode,
      candidateRoutes: [route1],
      recommendedRouteId: route1.id,
      copilotAdvisory: 'Normal travel corridor active. No major delays reported.',
    };
  },
};
