'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { forecastService, MultiPillarForecastResponse } from '@/services/forecastService';

export function useForecast(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  horizon: '7_DAYS' | '30_DAYS' = '7_DAYS',
  city?: string | null,
  countryCode?: string | null
) {
  const [forecast, setForecast] = useState<MultiPillarForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'AVAILABLE' | 'PARTIAL' | 'NO_COVERAGE' | 'ERROR'>('IDLE');

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchForecast = useCallback(async () => {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setForecast(null);
      setStatus('IDLE');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setStatus('LOADING');

    try {
      const res = await forecastService.getForecast(
        latitude,
        longitude,
        horizon,
        city || undefined,
        countryCode || undefined,
        controller.signal
      );

      setForecast(res);
      setStatus(res.coverageStatus || 'AVAILABLE');
      setError(null);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.warn('[useForecast] Error fetching forecast:', err);
      setError(err?.message || 'Unable to load numerical forecast telemetry.');
      setStatus('ERROR');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [latitude, longitude, horizon, city, countryCode]);

  useEffect(() => {
    fetchForecast();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchForecast]);

  return { forecast, loading, error, status, refetch: fetchForecast };
}
