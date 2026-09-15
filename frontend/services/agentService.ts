import {
  AgentInteractionRequest,
  AgentInteractionResponse,
  LocationChangesResponse,
  ExplainableUrbanScore,
  AnomalyDetectionResponse,
  ScenarioSimulationRequest,
  ScenarioSimulationResult,
  CityComparisonResponse,
  LocationMonitor,
  MonitorAlert,
} from '@shared/types';
import { apiClient } from './apiClient';

export const agentService = {
  async interact(request: AgentInteractionRequest): Promise<AgentInteractionResponse> {
    const response = await apiClient.post<AgentInteractionResponse>('/agent/interact', request);
    return response;
  },

  async getChanges(
    lat: number,
    lng: number,
    window: string = '24h',
    city?: string
  ): Promise<LocationChangesResponse> {
    return apiClient.get<LocationChangesResponse>('/intelligence/changes', {
      lat,
      lng,
      window,
      city,
    });
  },

  async getScore(
    lat: number,
    lng: number,
    city?: string,
    countryCode?: string
  ): Promise<ExplainableUrbanScore> {
    return apiClient.get<ExplainableUrbanScore>('/intelligence/score', {
      lat,
      lng,
      city,
      country_code: countryCode,
    });
  },

  async getAnomalies(
    lat: number,
    lng: number,
    city?: string
  ): Promise<AnomalyDetectionResponse> {
    return apiClient.get<AnomalyDetectionResponse>('/intelligence/anomalies', {
      lat,
      lng,
      city,
    });
  },

  async simulateScenario(
    request: ScenarioSimulationRequest
  ): Promise<ScenarioSimulationResult> {
    return apiClient.post<ScenarioSimulationResult>('/intelligence/simulate', request);
  },

  async compareLocations(
    locations: Array<{ name: string; latitude: number; longitude: number }>
  ): Promise<CityComparisonResponse> {
    return apiClient.post<CityComparisonResponse>('/intelligence/compare', { locations });
  },

  async getMonitors(): Promise<LocationMonitor[]> {
    return apiClient.get<LocationMonitor[]>('/monitoring');
  },

  async createMonitor(request: Partial<LocationMonitor>): Promise<LocationMonitor> {
    return apiClient.post<LocationMonitor>('/monitoring', request);
  },

  async deleteMonitor(monitorId: string): Promise<{ success: boolean; monitorId: string }> {
    return apiClient.delete<{ success: boolean; monitorId: string }>(`/monitoring/${monitorId}`);
  },

  async getMonitorAlerts(limit: number = 50): Promise<{ alerts: MonitorAlert[]; total: number }> {
    return apiClient.get<{ alerts: MonitorAlert[]; total: number }>('/monitoring/alerts', { limit });
  },

  async getRiskReport(
    lat: number,
    lng: number,
    radiusKm: number = 50,
    city?: string | null,
    countryCode?: string | null
  ): Promise<any> {
    return apiClient.get('/intelligence/risk', {
      lat,
      lng,
      radius_km: radiusKm,
      city: city || undefined,
      country_code: countryCode || undefined,
    });
  },

  async getPredictiveTraffic(lat: number, lng: number, radiusKm: number = 25): Promise<any> {
    return apiClient.get('/forecast/traffic', { lat, lng, radius_km: radiusKm });
  },

  async getRiskForecast(
    lat: number,
    lng: number,
    radiusKm: number = 50,
    city?: string,
    countryCode?: string
  ): Promise<any> {
    return apiClient.get('/forecast/risk', {
      lat,
      lng,
      radius_km: radiusKm,
      city: city || undefined,
      country_code: countryCode || undefined,
    });
  },

  async computeSmartRoutes(
    origin: { latitude: number; longitude: number; city?: string },
    destination: { latitude: number; longitude: number; city?: string },
    travelMode: string = 'drive',
    departureTime: string = 'Immediate'
  ): Promise<any> {
    return apiClient.post('/routes/smart', {
      origin,
      destination,
      travel_mode: travelMode,
      departure_time: departureTime,
    });
  },

  async planMission(
    origin: string,
    destination: string,
    preference: string = 'BALANCED',
    departureWindowStart?: string,
    departureWindowEnd?: string
  ): Promise<any> {
    return apiClient.post('/missions/plan', {
      origin,
      destination,
      preference,
      departureWindowStart,
      departureWindowEnd,
    });
  },

  async recommendPlaces(
    lat: number,
    lng: number,
    intent: string = 'peaceful',
    radiusKm: number = 15,
    limit: number = 5
  ): Promise<{ places: any[]; count: number; intent: string }> {
    return apiClient.get('/places/recommend', {
      lat,
      lng,
      intent,
      radius_km: radiusKm,
      limit,
    });
  },

  async detectCascades(lat: number, lng: number, radiusKm: number = 30, city?: string): Promise<any> {
    return apiClient.get('/cascade/chains', {
      lat,
      lng,
      radius_km: radiusKm,
      city,
    });
  },

  async updateAlertStatus(alertId: string, state: string): Promise<any> {
    return apiClient.patch(`/monitoring/alerts/${alertId}`, { state });
  },
};

