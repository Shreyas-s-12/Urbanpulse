'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrafficConditionSummary } from '@shared/types';
import { trafficService } from '@/services/trafficService';

export function useTraffic(latitude?: number, longitude?: number, radiusKm: number = 50) {
  const [traffic, setTraffic] = useState<TrafficConditionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTraffic = useCallback(async () => {
    if (latitude === undefined || longitude === undefined) {
      setTraffic(null);
      setLoading(false);
      return;
    }

    // Immediately reset previous traffic to avoid stale data leakage
    setTraffic(null);
    setLoading(true);
    setError(null);

    try {
      const summary = await trafficService.getTrafficSummary(latitude, longitude, radiusKm);
      setTraffic(summary);
    } catch (err: any) {
      setError(err?.message || 'Failed to load traffic conditions.');
      setTraffic(null);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, radiusKm]);

  useEffect(() => {
    fetchTraffic();
  }, [fetchTraffic]);

  return { traffic, loading, error, refresh: fetchTraffic };
}
