import { useState, useEffect } from 'react';
import { IntelligenceRadiusKm, UnifiedCityEvent } from '@shared/types';
import { eventService } from '@/services/eventService';

export function useLiveUpdates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  radiusKm: IntelligenceRadiusKm = 50,
  onNewEvent?: (event: UnifiedCityEvent) => void
) {
  const [lastEvent, setLastEvent] = useState<UnifiedCityEvent | null>(null);

  useEffect(() => {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      return;
    }

    const unsubscribe = eventService.subscribeToLiveEvents(
      latitude,
      longitude,
      radiusKm,
      (newEvent) => {
        setLastEvent(newEvent);
        if (onNewEvent) onNewEvent(newEvent);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [latitude, longitude, radiusKm, onNewEvent]);

  return { lastEvent };
}
