import { useState, useEffect, useRef } from 'react';
import { WeatherConditionSummary } from '@shared/types';
import { weatherClient } from '@/services/weatherClient';

export function useWeather(latitude: number | null | undefined, longitude: number | null | undefined) {
  const [weather, setWeather] = useState<WeatherConditionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    // Reset immediately to avoid stale data leakage when switching locations
    setWeather(null);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    setLoading(true);

    weatherClient
      .fetchWeather(latitude, longitude)
      .then((data) => {
        if (currentSeq === requestSeqRef.current) {
          setWeather(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (currentSeq === requestSeqRef.current) {
          setError(err?.message || 'Failed to load weather data');
          setLoading(false);
        }
      });

    return () => {
      // Incremented sequence protects against delayed asynchronous responses
    };
  }, [latitude, longitude]);

  return { weather, loading, error };
}
