import { useState, useEffect, useRef } from 'react';
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
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    // Reset immediately to avoid stale condition score when switching locations
    setCondition(null);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    setLoading(true);

    urbanConditionService
      .getUrbanCondition(latitude, longitude, radiusKm)
      .then((data) => {
        if (currentSeq === requestSeqRef.current) {
          setCondition(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (currentSeq === requestSeqRef.current) {
          setError(err?.message || 'Failed to fetch urban condition index');
          setLoading(false);
        }
      });

    return () => {
      // Incremented sequence protects against delayed asynchronous responses
    };
  }, [latitude, longitude, radiusKm]);

  return { condition, loading, error };
}
