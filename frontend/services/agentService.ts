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
};

