import { create } from 'zustand';
import {
  ResolvedLocation,
  AgentInteractionResponse,
  AgentToolActivity,
  AgentMapAction,
  AirQualitySummary,
  LocationChangesResponse,
  ExplainableUrbanScore,
  AnomalyDetectionResponse,
  ScenarioSimulationResult,
  CityComparisonResponse,
  LocationMonitor,
  MonitorAlert,
  NexusStructuredResponse,
} from '@shared/types';
import { agentService } from '@/services/agentService';
import { useLocationStore } from './useLocationStore';

export interface AgentChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: string;
  intent?: string;
  sources?: Array<{
    type: string;
    source: string;
    detail: string;
    observedAt?: string;
    freshness?: string;
  }>;
  confidence?: number;
  data?: any;
  location?: ResolvedLocation | null;
  structuredResponse?: NexusStructuredResponse;
}

interface AgentState {
  messages: AgentChatMessage[];
  activeLocation: ResolvedLocation | null;
  activeLayers: {
    traffic: boolean;
    aqi: boolean;
    events: boolean;
    boundary: boolean;
  };
  aqiOverlayData: AirQualitySummary | null;
  toolActivities: AgentToolActivity[];
  isProcessing: boolean;
  mapCenter: { lat: number; lng: number } | null;
  mapZoom: number;

  // Forecasting & Live Updates Panels
  activeForecast: any | null;
  showForecastPanel: boolean;
  liveUpdates: any[] | null;
  ragBulletins: any[] | null;
  showLiveUpdatesDrawer: boolean;

  // Master Intelligence Features
  activeChanges: LocationChangesResponse | null;
  showChangesModal: boolean;
  activeScore: ExplainableUrbanScore | null;
  showScoreModal: boolean;
  activeAnomalies: AnomalyDetectionResponse | null;
  showAnomaliesModal: boolean;
  activeScenario: ScenarioSimulationResult | null;
  showScenarioModal: boolean;
  activeComparison: CityComparisonResponse | null;
  showComparisonModal: boolean;
  activeRisk: any | null;
  showRiskModal: boolean;
  activeMonitors: LocationMonitor[];
  monitorAlerts: MonitorAlert[];
  showMonitoringDrawer: boolean;

  // Phase 3 Predictive & Decision Engines
  activeMission: any | null;
  showMissionModal: boolean;
  activeSmartRoutes: any | null;
  activeRiskHorizon: string;

  // Nexus Global Ranking Intelligence
  activeRanking: any | null;
  showRankedMarkers: boolean;
  setActiveRanking: (ranking: any | null) => void;
  setShowRankedMarkers: (show: boolean) => void;

  // Canonical Phase 1 Context
  nexusContextVersion: number;
  selectedMapEntity: {
    type: 'POI' | 'EVENT' | 'COORDINATE' | 'NONE';
    id?: string;
    name?: string;
    coordinates?: { latitude: number; longitude: number };
    meta?: Record<string, any>;
  } | null;
  activeFilter: 'ALL' | 'CRIME' | 'WEATHER' | 'TRAFFIC' | 'HAZARD' | 'MUNICIPAL' | 'LIVE' | 'RECENT' | 'FORECAST' | 'ALERTS';

  // Layout Mode
  isMapExpanded: boolean;

  // Actions
  setIsMapExpanded: (expanded: boolean) => void;
  toggleMapExpanded: () => void;
  sendMessage: (query: string) => Promise<void>;
  setActiveLocation: (loc: ResolvedLocation | null) => void;
  setSelectedMapEntity: (entity: any | null) => void;
  setActiveFilter: (filter: 'ALL' | 'CRIME' | 'WEATHER' | 'TRAFFIC' | 'HAZARD' | 'MUNICIPAL' | 'LIVE' | 'RECENT' | 'FORECAST' | 'ALERTS') => void;
  setLayer: (layer: 'traffic' | 'aqi' | 'events' | 'boundary', enabled: boolean) => void;
  setShowForecastPanel: (open: boolean) => void;
  setShowLiveUpdatesDrawer: (open: boolean) => void;
  setShowChangesModal: (open: boolean) => void;
  setShowScoreModal: (open: boolean) => void;
  setShowAnomaliesModal: (open: boolean) => void;
  setShowScenarioModal: (open: boolean) => void;
  setShowComparisonModal: (open: boolean) => void;
  setShowRiskModal: (open: boolean) => void;
  setShowMonitoringDrawer: (open: boolean) => void;
  setShowMissionModal: (open: boolean) => void;
  setActiveMission: (mission: any | null) => void;
  setActiveSmartRoutes: (routes: any | null) => void;
  setActiveRiskHorizon: (horizon: string) => void;
  fetchMonitors: () => Promise<void>;
  fetchMonitorAlerts: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  clearMessages: () => void;
  resetContext: () => void;
}


export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  activeLocation: null,
  activeLayers: {
    traffic: true,
    aqi: false,
    events: true,
    boundary: true,
  },
  aqiOverlayData: null,
  toolActivities: [],
  isProcessing: false,
  mapCenter: null,
  mapZoom: 12,

  activeForecast: null,
  showForecastPanel: false,
  liveUpdates: null,
  ragBulletins: null,
  showLiveUpdatesDrawer: false,

  activeChanges: null,
  showChangesModal: false,
  activeScore: null,
  showScoreModal: false,
  activeAnomalies: null,
  showAnomaliesModal: false,
  activeScenario: null,
  showScenarioModal: false,
  activeComparison: null,
  showComparisonModal: false,
  activeRisk: null,
  showRiskModal: false,
  activeMonitors: [],
  monitorAlerts: [],
  showMonitoringDrawer: false,

  // Phase 3 State
  activeMission: null,
  showMissionModal: false,
  activeSmartRoutes: null,
  activeRiskHorizon: 'NOW',

  // Nexus Global Ranking Intelligence
  activeRanking: null,
  showRankedMarkers: false,
  setActiveRanking: (ranking) => set({ activeRanking: ranking }),
  setShowRankedMarkers: (show) => set({ showRankedMarkers: show }),

  // Canonical Phase 1 Context
  nexusContextVersion: 1,
  selectedMapEntity: null,
  activeFilter: 'ALL',

  isMapExpanded: false,
  setIsMapExpanded: (expanded: boolean) => set({ isMapExpanded: expanded }),
  toggleMapExpanded: () => set((state) => ({ isMapExpanded: !state.isMapExpanded })),

  setShowForecastPanel: (open: boolean) => set({ showForecastPanel: open }),
  setShowLiveUpdatesDrawer: (open: boolean) => set({ showLiveUpdatesDrawer: open }),
  setShowChangesModal: (open: boolean) => set({ showChangesModal: open }),
  setShowScoreModal: (open: boolean) => set({ showScoreModal: open }),
  setShowAnomaliesModal: (open: boolean) => set({ showAnomaliesModal: open }),
  setShowScenarioModal: (open: boolean) => set({ showScenarioModal: open }),
  setShowComparisonModal: (open: boolean) => set({ showComparisonModal: open }),
  setShowRiskModal: (open: boolean) => set({ showRiskModal: open }),
  setShowMonitoringDrawer: (open: boolean) => set({ showMonitoringDrawer: open }),
  setShowMissionModal: (open: boolean) => set({ showMissionModal: open }),
  setActiveMission: (mission) => set({ activeMission: mission }),
  setActiveSmartRoutes: (routes) => set({ activeSmartRoutes: routes }),
  setActiveRiskHorizon: (horizon) => set({ activeRiskHorizon: horizon }),

  setSelectedMapEntity: (entity) => {
    set((state) => ({
      selectedMapEntity: entity,
      nexusContextVersion: state.nexusContextVersion + 1,
    }));
  },

  setActiveFilter: (filter) => {
    set((state) => ({
      activeFilter: filter,
      nexusContextVersion: state.nexusContextVersion + 1,
    }));
  },

  fetchMonitors: async () => {
    try {
      const monitors = await agentService.getMonitors();
      set({ activeMonitors: monitors });
    } catch (e) {
      console.error('Failed to fetch monitors:', e);
    }
  },

  fetchMonitorAlerts: async () => {
    try {
      const res = await agentService.getMonitorAlerts();
      set({ monitorAlerts: res.alerts || [] });
    } catch (e) {
      console.error('Failed to fetch monitor alerts:', e);
    }
  },

  acknowledgeAlert: async (alertId: string) => {
    try {
      await agentService.updateAlertStatus(alertId, 'ACKNOWLEDGED');
      set((state) => ({
        monitorAlerts: state.monitorAlerts.map((a: any) =>
          a.id === alertId ? { ...a, state: 'ACKNOWLEDGED' } : a
        ),
      }));
    } catch (e) {
      console.error('Failed to acknowledge alert:', e);
    }
  },

  resolveAlert: async (alertId: string) => {
    try {
      await agentService.updateAlertStatus(alertId, 'RESOLVED');
      set((state) => ({
        monitorAlerts: state.monitorAlerts.map((a: any) =>
          a.id === alertId ? { ...a, state: 'RESOLVED' } : a
        ),
      }));
    } catch (e) {
      console.error('Failed to resolve alert:', e);
    }
  },

  setActiveLocation: (loc) => {
    set((state) => ({
      activeLocation: loc,
      nexusContextVersion: state.nexusContextVersion + 1,
    }));
    if (loc) {
      useLocationStore.getState().setCurrentLocation(loc);
    }
  },

  setLayer: (layer, enabled) => {
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        [layer]: enabled,
      },
    }));
  },

  clearMessages: () => set({ messages: [], toolActivities: [] }),

  resetContext: () =>
    set({
      messages: [],
      activeLocation: null,
      toolActivities: [],
      aqiOverlayData: null,
      activeRanking: null,
      showRankedMarkers: false,
      activeLayers: { traffic: true, aqi: false, events: true, boundary: true },
    }),

  sendMessage: async (query: string) => {
    const q = query.trim();
    if (!q || get().isProcessing) return;

    const userMsg: AgentChatMessage = {
      id: `USER-${Date.now()}`,
      sender: 'user',
      content: q,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      isProcessing: true,
      toolActivities: [
        {
          step: `Processing request: "${q}"`,
          status: 'IN_PROGRESS',
          timestamp: new Date().toISOString(),
        },
      ],
    }));

    try {
      const { activeLocation, selectedMapEntity, activeFilter, nexusContextVersion } = get();
      const locationStore = useLocationStore.getState();
      const baseLoc = activeLocation || locationStore.currentLocation;
      const currentLoc = {
        ...(baseLoc || {}),
        selectedMapEntity: selectedMapEntity,
        activeFilter: activeFilter,
      };

      const history = get().messages.map((m) => ({
        sender: m.sender,
        content: m.content,
      }));

      const sendVersion = nexusContextVersion;

      const res: AgentInteractionResponse = await agentService.interact({
        query: q,
        currentLocation: currentLoc,
        selectedRadiusKm: locationStore.selectedRadiusKm,
        conversationHistory: history,
      });

      // Discard response if location or entity context was switched while in-flight
      if (get().nexusContextVersion !== sendVersion) {
        return;
      }

      // Update active activities
      set({ toolActivities: res.toolActivities || (res as any).tool_activities || [] });

      // Execute Map Actions
      if (res.actions && res.actions.length > 0) {
        res.actions.forEach((action: AgentMapAction) => {
          if (action.type === 'CENTER_MAP' && action.payload) {
            const { latitude, longitude, zoom } = action.payload;
            if (latitude !== undefined && longitude !== undefined) {
              set({
                mapCenter: { lat: latitude, lng: longitude },
                mapZoom: zoom || 12,
              });
            }
          } else if (action.type === 'SHOW_TRAFFIC_LAYER') {
            set((state) => ({
              activeLayers: { ...state.activeLayers, traffic: true },
            }));
          } else if (action.type === 'HIDE_TRAFFIC_LAYER') {
            set((state) => ({
              activeLayers: { ...state.activeLayers, traffic: false },
            }));
          } else if (action.type === 'SHOW_AQI_LAYER') {
            set((state) => ({
              activeLayers: { ...state.activeLayers, aqi: true },
              aqiOverlayData: action.payload?.data || res.data.airQuality || null,
            }));
          } else if (action.type === 'HIDE_AQI_LAYER') {
            set((state) => ({
              activeLayers: { ...state.activeLayers, aqi: false },
            }));
          } else if (action.type === 'SHOW_RANKING') {
            set({
              activeRanking: action.payload?.ranking || res.data?.ranking || null,
              showRankedMarkers: false,
            });
          } else if (action.type === 'SHOW_RANKED_MARKERS') {
            set({
              activeRanking: action.payload?.ranking || res.data?.ranking || null,
              showRankedMarkers: true,
            });
            if (action.payload?.center) {
              set({
                mapCenter: { lat: action.payload.center.latitude, lng: action.payload.center.longitude },
                mapZoom: action.payload.zoom || 5,
              });
            }
          } else if (action.type === 'CLEAR_RANKING') {
            set({
              activeRanking: null,
              showRankedMarkers: false,
            });
          } else if (action.type === 'FOCUS_RANKED_ENTITY') {
            if (action.payload?.latitude && action.payload?.longitude) {
              set({
                mapCenter: { lat: action.payload.latitude, lng: action.payload.longitude },
                mapZoom: action.payload.zoom || 12,
              });
            }
          } else if (action.type === 'SHOW_EVENTS_LAYER') {
            set((state) => ({
              activeLayers: { ...state.activeLayers, events: true },
            }));
          } else if (action.type === 'SHOW_FORECAST') {
            set({
              activeForecast: action.payload?.forecast || res.data?.forecast || null,
              showForecastPanel: true,
            });
          } else if (action.type === 'SHOW_LIVE_UPDATES') {
            set({
              liveUpdates: action.payload?.updates || res.data?.liveUpdates || null,
              ragBulletins: action.payload?.bulletins || (res.data as any)?.ragBulletins || null,
              showLiveUpdatesDrawer: true,
            });
          } else if (action.type === 'SET_ZOOM' && action.payload?.zoom) {
            set({ mapZoom: action.payload.zoom });
          } else if (action.type === 'SHOW_CHANGES') {
            set({
              activeChanges: (action.payload as any)?.changes || res.data?.changes || null,
              showChangesModal: true,
            });
          } else if (action.type === 'SHOW_SCORE') {
            set({
              activeScore: (action.payload as any)?.score || res.data?.explainableScore || null,
              showScoreModal: true,
            });
          } else if (action.type === 'SHOW_ANOMALIES') {
            set({
              activeAnomalies: (action.payload as any)?.anomalies || res.data?.anomalies || null,
              showAnomaliesModal: true,
            });
          } else if (action.type === 'SHOW_SCENARIO') {
            set({
              activeScenario: (action.payload as any)?.simulation || res.data?.scenario || (res.data as any)?.simulation || null,
              showScenarioModal: true,
            });
          } else if (action.type === 'SHOW_COMPARISON') {
            set({
              activeComparison: (action.payload as any)?.comparison || res.data?.cityComparison || null,
              showComparisonModal: true,
            });
          } else if (action.type === 'SHOW_RISK') {
            set({
              activeRisk: (action.payload as any)?.riskReport || res.data?.riskRadar || null,
              showRiskModal: true,
            });
          } else if (action.type === 'SHOW_RISK_FORECAST') {
            set({
              activeRisk: (action.payload as any)?.data || (action.payload as any)?.riskReport || (res.data as any)?.riskForecast || null,
              showRiskModal: true,
            });
          } else if (action.type === 'SHOW_ROUTE' || action.type === 'SHOW_ALTERNATIVE_ROUTES') {
            set({
              activeSmartRoutes: (action.payload as any)?.data || (res.data as any)?.smartRoutes || null,
            });
          } else if (action.type === 'OPEN_MISSION') {
            set({
              activeMission: (action.payload as any)?.data || (res.data as any)?.mission || null,
              showMissionModal: true,
            });
          } else if (action.type === 'OPEN_MONITOR') {
            set({ showMonitoringDrawer: true });
          } else if (action.type === 'FOCUS_ALERT') {
            if (action.payload?.latitude && action.payload?.longitude) {
              set({
                mapCenter: { lat: action.payload.latitude, lng: action.payload.longitude },
                mapZoom: 15,
              });
            }
          } else if (action.type === 'SET_RADIUS' && action.payload?.radiusKm) {
            useLocationStore.getState().setSelectedRadiusKm(action.payload.radiusKm as any);
          } else if (action.type === 'SET_EVENT_FILTER' && action.payload?.filter) {
            set({ activeFilter: action.payload.filter as any });
          }
        });
      }

      // Update location context if new location was resolved
      if (res.location) {
        set({ activeLocation: res.location });
        useLocationStore.getState().setCurrentLocation(res.location);
      }

      if (res.data?.airQuality) {
        set({ aqiOverlayData: res.data.airQuality });
      }

      const agentMsg: AgentChatMessage = {
        id: res.id || `AGENT-${Date.now()}`,
        sender: 'agent',
        content: res.message,
        timestamp: res.timestamp,
        intent: res.intent,
        sources: res.sources,
        confidence: res.confidence,
        data: res.data,
        location: res.location,
        structuredResponse: res.structured_response || res.structuredResponse || (res as any).structured_response || undefined,
      };

      set((state) => ({
        messages: [...state.messages, agentMsg],
      }));
    } catch (err: any) {
      console.error('Agent interaction failed:', err);
      const errorMsg: AgentChatMessage = {
        id: `ERROR-${Date.now()}`,
        sender: 'agent',
        content: `I encountered a communication error while querying intelligence providers. Please try asking again.`,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, errorMsg],
      }));
    } finally {
      set({ isProcessing: false });
    }
  },
}));
