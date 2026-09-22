import { useState, useEffect, useRef } from 'react';
import { IntelligenceRadiusKm, UnifiedCityEvent } from '@shared/types';
import { eventService } from '@/services/eventService';

export function useNearbyEvents(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: IntelligenceRadiusKm = 50
) {
  const [events, setEvents] = useState<UnifiedCityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    // Reset immediately to avoid stale events when switching locations
    setEvents([]);
    setError(null);

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setLoading(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    setLoading(true);

    eventService
      .getEventsWithinRadius(latitude, longitude, radiusKm)
      .then((data) => {
        if (currentSeq === requestSeqRef.current) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (currentSeq === requestSeqRef.current) {
          setError(err?.message || 'Failed to fetch nearby events');
          setLoading(false);
        }
      });

    return () => {
      // Incremented sequence protects against delayed asynchronous responses
    };
  }, [latitude, longitude, radiusKm]);

  return { events, setEvents, loading, error };
}
