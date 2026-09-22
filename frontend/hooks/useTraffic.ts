import { useState, useEffect, useRef } from 'react';
import { TrafficConditionSummary } from '@shared/types';
import { trafficService } from '@/services/trafficService';

export function useTraffic(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: number = 50
) {
  const [traffic, setTraffic] = useState<TrafficConditionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    // Reset state immediately on coordinates change to avoid showing stale data from previous city
    setTraffic(null);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    setLoading(true);

    trafficService
      .getTrafficSummary(latitude, longitude, radiusKm)
      .then((data) => {
        if (currentSeq === requestSeqRef.current) {
          setTraffic(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (currentSeq === requestSeqRef.current) {
          setError(err?.message || 'Failed to fetch traffic summary');
          setLoading(false);
        }
      });

    return () => {
      // Incremented sequence protects against delayed asynchronous responses
    };
  }, [latitude, longitude, radiusKm]);

  return { traffic, loading, error };
}
