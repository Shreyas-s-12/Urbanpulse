'use client';

import { useState, useEffect } from 'react';
import { AirQualitySummary } from '@shared/types';
import { airQualityService } from '@/services/airQualityService';

export function useAirQuality(
  latitude?: number | null,
  longitude?: number | null,
  scale?: string,
  countryCode?: string | null
) {
  const [airQuality, setAirQuality] = useState<AirQualitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset immediately on coordinate change to prevent any stale data leakage between locations
    setAirQuality(null);
    setError(null);

    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    airQualityService
      .getAirQuality(latitude, longitude, scale, countryCode || undefined)
      .then((data) => {
        if (isMounted) {
          setAirQuality(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load air quality');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, scale, countryCode]);

  return { airQuality, loading, error };
}
