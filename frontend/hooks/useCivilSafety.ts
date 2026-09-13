import { useState, useEffect } from 'react';
import { CivilSafetySummary } from '@shared/types';
import { civilSafetyService } from '@/services/civilSafetyService';

export function useCivilSafety(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: number = 50,
  countryCode?: string | null,
  city?: string | null
) {
  const [civilSafety, setCivilSafety] = useState<CivilSafetySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state immediately on coordinates change to avoid showing stale data from previous city
    setCivilSafety(null);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    civilSafetyService
      .getCivilSafety(latitude, longitude, radiusKm, countryCode, city)
      .then((data) => {
        if (isMounted) {
          setCivilSafety(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch civil safety feeds');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, radiusKm, countryCode, city]);

  return { civilSafety, loading, error };
}
