import { IntelligenceRadiusKm, UnifiedCityEvent } from '@shared/types';
import { apiClient } from './apiClient';

export const eventService = {
  async getEventsWithinRadius(
    centerLat: number,
    centerLon: number,
    radiusKm: IntelligenceRadiusKm
  ): Promise<UnifiedCityEvent[]> {
    try {
      const res: any = await apiClient.get('/events/nearby', {
        latitude: centerLat,
        longitude: centerLon,
        radius_km: radiusKm,
      });
      if (Array.isArray(res)) {
        return res;
      }
      if (res && Array.isArray(res.events)) {
        return res.events;
      }
    } catch (err) {
      console.warn('Backend event fetch failed, fallback to empty list:', err);
    }
    return [];
  },

  async getEventHistory(
    centerLat: number,
    centerLon: number,
    radiusKm: IntelligenceRadiusKm = 50,
    category?: string,
    hours: number = 24
  ): Promise<UnifiedCityEvent[]> {
    try {
      const res: any = await apiClient.get('/events/history', {
        latitude: centerLat,
        longitude: centerLon,
        radius_km: radiusKm,
        category: category || '',
        hours,
      });
      if (Array.isArray(res)) {
        return res;
      }
      if (res && Array.isArray(res.events)) {
        return res.events;
      }
    } catch (err) {
      console.warn('Backend event history fetch failed:', err);
    }
    return [];
  },

  async getEventHistoryDetailed(
    centerLat: number,
    centerLon: number,
    radiusKm: IntelligenceRadiusKm = 50,
    category?: string,
    hours: number = 24
  ): Promise<{
    events: UnifiedCityEvent[];
    status: 'AVAILABLE' | 'EMPTY_VERIFIED' | 'NO_COVERAGE' | 'ERROR';
    count: number;
    providersChecked?: string[];
  }> {
    try {
      const res: any = await apiClient.get('/events/history', {
        latitude: centerLat,
        longitude: centerLon,
        radius_km: radiusKm,
        category: category || '',
        hours,
      });
      if (res && typeof res === 'object') {
        const events = Array.isArray(res.events) ? res.events : (Array.isArray(res) ? res : []);
        const status = res.status || (events.length > 0 ? 'AVAILABLE' : 'EMPTY_VERIFIED');
        return {
          events,
          status,
          count: typeof res.count === 'number' ? res.count : events.length,
          providersChecked: res.providersChecked || [],
        };
      }
    } catch (err) {
      console.warn('Backend event history detailed fetch failed:', err);
      return {
        events: [],
        status: 'ERROR',
        count: 0,
        providersChecked: [],
      };
    }
    return {
      events: [],
      status: 'NO_COVERAGE',
      count: 0,
      providersChecked: [],
    };
  },

  subscribeToLiveEvents(
    centerLat: number,
    centerLon: number,
    radiusKm: IntelligenceRadiusKm,
    onEvent: (event: UnifiedCityEvent) => void
  ): () => void {
    if (typeof window === 'undefined' || !window.EventSource) {
      return () => {};
    }
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';
    const sseUrl = baseUrl + '/events/stream?latitude=' + centerLat + '&longitude=' + centerLon + '&radius_km=' + radiusKm;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed && parsed.eventId) {
            onEvent(parsed as UnifiedCityEvent);
          }
        } catch {}
      };
      eventSource.onerror = () => {};
    } catch (err) {
      console.warn('SSE subscription error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  },

  calculateUrbanConditionScore(events: UnifiedCityEvent[]): number {
    if (events.length === 0) return 92;
    const avgSeverity = events.reduce((acc, e) => acc + e.severity, 0) / events.length;
    return Math.max(10, Math.min(98, Math.round(100 - avgSeverity * 0.45 - events.length * 2.2)));
  },
};
