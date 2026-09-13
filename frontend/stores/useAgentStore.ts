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
  activeMonitors: LocationMonitor[];
  monitorAlerts: MonitorAlert[];
  showMonitoringDrawer: boolean;

  // Layout Mode
  isMapExpanded: boolean;

  // Actions
  setIsMapExpanded: (expanded: boolean) => void;
  toggleMapExpanded: () => void;
  sendMessage: (query: string) => Promise<void>;
  setActiveLocation: (loc: ResolvedLocation | null) => void;
  setLayer: (layer: 'traffic' | 'aqi' | 'events' | 'boundary', enabled: boolean) => void;
  setShowForecastPanel: (open: boolean) => void;
  setShowLiveUpdatesDrawer: (open: boolean) => void;
  setShowChangesModal: (open: boolean) => void;
  setShowScoreModal: (open: boolean) => void;
  setShowAnomaliesModal: (open: boolean) => void;
  setShowScenarioModal: (open: boolean) => void;
  setShowComparisonModal: (open: boolean) => void;
  setShowMonitoringDrawer: (open: boolean) => void;
  fetchMonitors: () => Promise<void>;
  fetchMonitorAlerts: () => Promise<void>;
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
  activeMonitors: [],
  monitorAlerts: [],
  showMonitoringDrawer: false,

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
  setShowMonitoringDrawer: (open: boolean) => set({ showMonitoringDrawer: open }),

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

  setActiveLocation: (loc) => {
    set({ activeLocation: loc });
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
      const { activeLocation } = get();
      const locationStore = useLocationStore.getState();
      const currentLoc = activeLocation || locationStore.currentLocation;

      const history = get().messages.map((m) => ({
        sender: m.sender,
        content: m.content,
      }));

      const res: AgentInteractionResponse = await agentService.interact({
        query: q,
        currentLocation: currentLoc,
        selectedRadiusKm: locationStore.selectedRadiusKm,
        conversationHistory: history,
      });

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
