import { useState, useCallback } from 'react';
import { ResolvedLocation, RoutePlan, TravelMode } from '@shared/types';
import { routeService } from '@/services/routeService';

export function useRouteAnalysis() {
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRoute = useCallback(
    async (
      from: ResolvedLocation,
      to: ResolvedLocation,
      mode: TravelMode = 'drive',
      departureTime: string = 'Immediate'
    ) => {
      setLoading(true);
      setError(null);
      try {
        const plan = await routeService.calculateRoutes(from, to, mode, departureTime);
        setRoutePlan(plan);
        return plan;
      } catch (err: any) {
        setError(err?.message || 'Failed to calculate route plan');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { routePlan, calculateRoute, loading, error };
}
