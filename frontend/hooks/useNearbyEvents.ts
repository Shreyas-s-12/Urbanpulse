import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setEvents([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    eventService
      .getEventsWithinRadius(latitude, longitude, radiusKm)
      .then((data) => {
        if (isMounted) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch nearby events');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, radiusKm]);

  return { events, setEvents, loading, error };
}
