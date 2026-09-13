import { useState, useEffect } from 'react';
import { RoadsSummary } from '@shared/types';
import { roadService } from '@/services/roadService';

export function useRoads(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: number = 50
) {
  const [roads, setRoads] = useState<RoadsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state immediately on coordinates change to avoid showing stale data from previous city
    setRoads(null);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    roadService
      .getRoadIntelligence(latitude, longitude, radiusKm)
      .then((data) => {
        if (isMounted) {
          setRoads(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch road intelligence');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, radiusKm]);

  return { roads, loading, error };
}
