import { useState, useEffect } from 'react';
import { WeatherConditionSummary } from '@shared/types';
import { weatherClient } from '@/services/weatherClient';

export function useWeather(latitude: number | null | undefined, longitude: number | null | undefined) {
  const [weather, setWeather] = useState<WeatherConditionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset immediately to avoid stale data leakage when switching locations
    setWeather(null);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    weatherClient
      .fetchWeather(latitude, longitude)
      .then((data) => {
        if (isMounted) {
          setWeather(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load weather data');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude]);

  return { weather, loading, error };
}
