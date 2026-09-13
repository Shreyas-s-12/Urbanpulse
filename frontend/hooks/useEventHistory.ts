import { useState, useEffect } from 'react';
import { IntelligenceRadiusKm, UnifiedCityEvent } from '@shared/types';
import { eventService } from '@/services/eventService';

export type EventTimelineStatus = 'AVAILABLE' | 'EMPTY_VERIFIED' | 'NO_COVERAGE' | 'ERROR' | 'LOADING';

export function useEventHistory(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: IntelligenceRadiusKm = 50,
  category?: string,
  hours: number = 24
) {
  const [events, setEvents] = useState<UnifiedCityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<EventTimelineStatus>('LOADING');
  const [error, setError] = useState<string | null>(null);
  const [providersChecked, setProvidersChecked] = useState<string[]>([]);

  useEffect(() => {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      setEvents([]);
      setStatus('EMPTY_VERIFIED');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setStatus('LOADING');
    setError(null);

    eventService
      .getEventHistoryDetailed(latitude, longitude, radiusKm, category, hours)
      .then((data) => {
        if (isMounted) {
          setEvents(data.events);
          setStatus(data.status as EventTimelineStatus);
          setProvidersChecked(data.providersChecked || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch event history');
          setStatus('ERROR');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, radiusKm, category, hours]);

  return { events, loading, error, status, providersChecked };
}
