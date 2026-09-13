import { useState, useEffect } from 'react';
import { UrbanConditionBreakdown } from '@shared/types';
import { urbanConditionService } from '@/services/urbanConditionService';

export function useUrbanCondition(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: number = 50
) {
  const [condition, setCondition] = useState<UrbanConditionBreakdown | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset immediately to avoid stale condition score when switching locations
    setCondition(null);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    urbanConditionService
      .getUrbanCondition(latitude, longitude, radiusKm)
      .then((data) => {
        if (isMounted) {
          setCondition(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch urban condition index');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, radiusKm]);

  return { condition, loading, error };
}
