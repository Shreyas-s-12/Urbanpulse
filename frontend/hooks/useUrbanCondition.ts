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
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setCondition(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

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
