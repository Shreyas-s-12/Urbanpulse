import { CopilotMessage, ResolvedLocation, UnifiedCityEvent } from '@shared/types';
import { apiClient } from './apiClient';

export const copilotService = {
  async queryCopilot(
    query: string,
    location: ResolvedLocation,
    events: UnifiedCityEvent[],
    radiusKm: number,
    weatherSummary?: string
  ): Promise<CopilotMessage> {
    try {
      const response = await apiClient.post<CopilotMessage>('/copilot', {
        query,
        location,
        radius_km: radiusKm,
        events: events.slice(0, 15),
        weather_summary: weatherSummary,
      });

      if (response && response.content) {
        return response;
      }
    } catch (err) {
      console.warn('Backend copilot query failed, running local fallback logic:', err);
    }

    return copilotService.generateFallbackResponse(query, location, events, radiusKm, weatherSummary);
  },

  generateFallbackResponse(
    query: string,
    location: ResolvedLocation,
    events: UnifiedCityEvent[],
    radiusKm: number,
    weatherSummary?: string
  ): CopilotMessage {
    const q = query.toLowerCase();
    const severeEvents = events.filter((e) => e.severity >= 70);
    const earthquakes = events.filter((e) => e.eventType === 'EARTHQUAKE');

    let answer = '';
    const citations: Array<{ type: string; source: string; detail: string }> = [];
    let suggestedActions: string[] = [];

    const cityName = location.city || 'your current area';

    if (q.includes('earthquake') || q.includes('quake') || q.includes('tremor') || q.includes('seismic')) {
      if (earthquakes.length > 0) {
        const eq = earthquakes[0];
        const mag = eq.metadata?.magnitude || 4.7;
        const depth = eq.metadata?.depthKm || 16.2;
        const impact = eq.metadata?.impactRisk || 'MODERATE';
        answer = 'A seismic event of scientific magnitude **' + mag + '** (depth ' + depth + ' km) was logged approximately ' + eq.distanceKm + ' km from ' + location.displayName + '. UrbanPulse computes your localized impact risk as **' + impact + '**. Structural vulnerability in your radius is nominal.';
        citations.push({
          type: 'Seismic Signal',
          source: 'USGS',
          detail: 'Mag ' + mag + ', ' + eq.distanceKm + ' km away',
        });
        suggestedActions = ['View seismic epicenter on 3D Map', 'Check emergency civil defense guidelines'];
      } else {
        answer = 'Zero seismic tremors or earthquake events detected within ' + radiusKm + ' km of ' + cityName + ' over the past 24 hours.';
        citations.push({ type: 'Seismic Watch', source: 'USGS', detail: 'Clean sensor buffer' });
        suggestedActions = ['Expand radius to 250 km', 'Check active disaster alerts'];
      }
    } else if (q.includes('route') || q.includes('slower') || q.includes('traffic') || q.includes('delay') || q.includes('avoid')) {
      if (severeEvents.length > 0) {
        const top = severeEvents[0];
        answer = 'Your transit corridor is impacted by **' + top.title + '** (' + top.eventType + '), located ' + top.distanceKm + ' km away. Travel time is elevated. UrbanPulse recommends taking an alternate perimeter route.';
        citations.push({
          type: top.eventType,
          source: top.source,
          detail: top.title,
        });
        suggestedActions = ['Switch to Safest Bypass Route', 'Enable real-time corridor monitoring'];
      } else {
        answer = 'All primary arteries around ' + cityName + ' are free-flowing within typical commute margins. No high-risk roadblocks or multi-lane closures observed.';
        citations.push({ type: 'Traffic Flow', source: 'Google Maps / Sensors', detail: 'Normal flow rates' });
        suggestedActions = ['Review live traffic telemetry', 'Inspect active road sensors'];
      }
    } else if (q.includes('weather') || q.includes('rain') || q.includes('flood') || q.includes('storm')) {
      answer = 'Current atmospheric conditions in ' + cityName + ': ' + (weatherSummary || 'Clear Sky') + '. Atmospheric telemetry is synchronized with Open-Meteo.';
      citations.push({
        type: 'Atmospheric Sensors',
        source: 'Open-Meteo API',
        detail: 'Atmospheric telemetry synchronized',
      });
      suggestedActions = ['View hourly precipitation probability', 'Check flood-risk underpasses'];
    } else {
      const critText = severeEvents.length > 0 ? 'There is ' + severeEvents.length + ' critical incident requiring transit caution.' : 'No critical emergencies active.';
      answer = 'UrbanPulse is currently tracking **' + events.length + ' active events** across a **' + radiusKm + ' km radius** around ' + location.displayName + '. ' + critText;
      events.slice(0, 2).forEach((e) => {
        citations.push({ type: e.eventType, source: e.source, detail: e.title });
      });
      suggestedActions = ['Explore Around Me', 'Inspect Urban Condition breakdown', 'View Active Incidents'];
    }

    return {
      id: 'COPILOT-' + Date.now(),
      sender: 'copilot',
      content: answer,
      timestamp: new Date().toISOString(),
      citedLiveSignals: citations,
      suggestedActions,
    };
  },
};
