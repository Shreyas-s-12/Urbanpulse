'use client';

import { useState, useEffect, useRef } from 'react';
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
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    // Reset immediately on coordinate change to prevent any stale data leakage between locations
    setAirQuality(null);
    setError(null);

    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      setLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    setLoading(true);

    airQualityService
      .getAirQuality(latitude, longitude, scale, countryCode || undefined)
      .then((data) => {
        if (currentSeq === requestSeqRef.current) {
          setAirQuality(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (currentSeq === requestSeqRef.current) {
          setError(err?.message || 'Failed to load air quality');
          setLoading(false);
        }
      });

    return () => {
      // Incremented sequence protects against delayed asynchronous responses
    };
  }, [latitude, longitude, scale, countryCode]);

  return { airQuality, loading, error };
}
