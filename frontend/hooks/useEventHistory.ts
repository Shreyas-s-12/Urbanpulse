import { useState, useEffect } from 'react';
import { IntelligenceRadiusKm, UnifiedCityEvent } from '@shared/types';
import { eventService } from '@/services/eventService';

export function useEventHistory(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: IntelligenceRadiusKm = 50,
  category?: string,
  hours: number = 24
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
      .getEventHistory(latitude, longitude, radiusKm, category, hours)
      .then((data) => {
        if (isMounted) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch event history');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, radiusKm, category, hours]);

  return { events, loading, error };
}
