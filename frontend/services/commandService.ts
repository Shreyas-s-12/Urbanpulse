/**
 * UrbanPulse Phase 5 Command Center API Client
 */

import {
  CommandOverview,
  CrossDomainGraph,
  IncidentDossier,
  CityHealthResponse,
  DecisionSupportResponse,
  ComparisonResponse,
  ProviderHealthItem,
  DataQualityDomain,
  ReplayTimelineResponse,
  ReportResponse,
} from '@/types/command';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

export const commandService = {
  async getCommandOverview(
    lat: number,
    lng: number,
    radiusKm: number = 30.0,
    city?: string
  ): Promise<CommandOverview> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius_km: radiusKm.toString(),
    });
    if (city) params.append('city', city);

    const res = await fetch(`${API_BASE_URL}/command-center/overview?${params.toString()}`);
    if (!res.ok) throw new Error(`Command overview failed: ${res.statusText}`);
    return res.json();
  },

  async getUnifiedIntelligence(
    lat: number,
    lng: number,
    radiusKm: number = 30.0,
    city?: string,
    timeWindow: string = '24h'
  ): Promise<any> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius_km: radiusKm.toString(),
      time_window: timeWindow,
    });
    if (city) params.append('city', city);

    const res = await fetch(`${API_BASE_URL}/urban-intelligence?${params.toString()}`);
    if (!res.ok) throw new Error(`Unified intelligence failed: ${res.statusText}`);
    return res.json();
  },

  async getCrossDomainGraph(
    lat: number,
    lng: number,
    radiusKm: number = 30.0,
    city?: string,
    focusEventId?: string
  ): Promise<CrossDomainGraph> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius_km: radiusKm.toString(),
    });
    if (city) params.append('city', city);
    if (focusEventId) params.append('focus_event_id', focusEventId);

    const res = await fetch(`${API_BASE_URL}/command-center/graph?${params.toString()}`);
    if (!res.ok) throw new Error(`Graph query failed: ${res.statusText}`);
    return res.json();
  },

  async getIncidentDossier(
    incidentId: string,
    lat: number,
    lng: number,
    radiusKm: number = 5.0,
    city?: string,
    eventType?: string,
    title?: string
  ): Promise<IncidentDossier> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius_km: radiusKm.toString(),
    });
    if (city) params.append('city', city);
    if (eventType) params.append('event_type', eventType);
    if (title) params.append('title', title);

    const res = await fetch(`${API_BASE_URL}/command-center/incident/${incidentId}?${params.toString()}`);
    if (!res.ok) throw new Error(`Incident dossier failed: ${res.statusText}`);
    return res.json();
  },

  async updateIncidentState(
    incidentId: string,
    newState: string,
    evidenceNote?: string
  ): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/command-center/incident/${incidentId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_state: newState, evidence_note: evidenceNote }),
    });
    if (!res.ok) throw new Error(`Incident transition failed: ${res.statusText}`);
    return res.json();
  },

  async getCityHealth(
    lat: number,
    lng: number,
    radiusKm: number = 30.0,
    city?: string
  ): Promise<CityHealthResponse> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radius_km: radiusKm.toString(),
    });
    if (city) params.append('city', city);

    const res = await fetch(`${API_BASE_URL}/command-center/city-health?${params.toString()}`);
    if (!res.ok) throw new Error(`City health failed: ${res.statusText}`);
    return res.json();
  },

  async evaluateDecision(
    lat: number,
    lng: number,
    objective: string = 'transit_efficiency',
    constraints?: string[],
    cityName?: string
  ): Promise<DecisionSupportResponse> {
    const res = await fetch(`${API_BASE_URL}/command-center/decision-support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        objective,
        constraints,
        city_name: cityName,
      }),
    });
    if (!res.ok) throw new Error(`Decision support failed: ${res.statusText}`);
    return res.json();
  },

  async compareEntities(
    queries: Array<{ name: string; geographyType?: string; latitude?: number; longitude?: number }>,
    timeWindow: string = 'NOW'
  ): Promise<ComparisonResponse> {
    const res = await fetch(`${API_BASE_URL}/command-center/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries, time_window: timeWindow }),
    });
    if (!res.ok) throw new Error(`Comparison failed: ${res.statusText}`);
    return res.json();
  },

  async getObservability(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/command-center/observability`);
    if (!res.ok) throw new Error(`Observability query failed: ${res.statusText}`);
    return res.json();
  },

  async getProviderHealth(): Promise<{ systemStatus: string; providers: ProviderHealthItem[] }> {
    const res = await fetch(`${API_BASE_URL}/command-center/providers`);
    if (!res.ok) throw new Error(`Provider health query failed: ${res.statusText}`);
    return res.json();
  },

  async getDataQuality(lat: number, lng: number): Promise<{ compositeCoveragePercent: number; domains: DataQualityDomain[] }> {
    const res = await fetch(`${API_BASE_URL}/command-center/data-quality?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error(`Data quality query failed: ${res.statusText}`);
    return res.json();
  },

  async getReplayTimeline(
    lat: number,
    lng: number,
    window: string = '24H',
    steps: number = 8
  ): Promise<ReplayTimelineResponse> {
    const res = await fetch(
      `${API_BASE_URL}/command-center/replay?lat=${lat}&lng=${lng}&window=${window}&steps=${steps}`
    );
    if (!res.ok) throw new Error(`Replay timeline failed: ${res.statusText}`);
    return res.json();
  },

  async generateReport(
    lat: number,
    lng: number,
    radiusKm: number = 30.0,
    cityName?: string,
    reportMode: string = 'EXECUTIVE',
    focusDomain?: string
  ): Promise<ReportResponse> {
    const res = await fetch(`${API_BASE_URL}/command-center/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        radius_km: radiusKm,
        city_name: cityName,
        report_mode: reportMode,
        focus_domain: focusDomain,
      }),
    });
    if (!res.ok) throw new Error(`Report generation failed: ${res.statusText}`);
    return res.json();
  },

  async adaptMission(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/command-center/mission-adapt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });
    if (!res.ok) throw new Error(`Mission adaptation failed: ${res.statusText}`);
    return res.json();
  },
};
