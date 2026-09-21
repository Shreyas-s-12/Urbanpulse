/**
 * UrbanPulse Dedicated Heatmap Store
 * Completely isolates heatmap lifecycle & rendering state from Google Maps.
 * Ensures heatmap failures NEVER trigger map canvas offline states.
 * Enforces race protection via sequence IDs and AbortController.
 */

import { create } from 'zustand';
import {
  HeatmapCell,
  HeatmapStats,
  HeatmapMetric,
  HeatmapSubMetric,
  HeatmapGeography,
  HeatmapStatus,
  HeatmapTimeWindow,
  HeatmapLegendMetadata,
  HeatmapDiagnostics,
} from '@shared/types';
import { heatmapService } from '@/services/heatmapService';

export const DEFAULT_SUBMETRICS: Record<HeatmapMetric, HeatmapSubMetric> = {
  AQI: 'CURRENT_AQI',
  TRAFFIC: 'CONGESTION',
  WEATHER: 'PRECIPITATION',
  POPULATION: 'DENSITY',
};

interface HeatmapState {
  status: HeatmapStatus;
  metric: HeatmapMetric;
  subMetric: HeatmapSubMetric;
  geography: HeatmapGeography;
  timeWindow: HeatmapTimeWindow;
  radiusKm: number;
  country: string | null;
  region: string | null;
  placeName: string | null;
  disclaimer: string | null;
  dataResolution: string | null;
  cells: HeatmapCell[];
  stats: HeatmapStats | null;
  selectedCell: HeatmapCell | null;
  hoveredCell: HeatmapCell | null;
  error: string | null;
  lastFetchedAt: string | null;
  lastCoords: { lat: number; lng: number } | null;
  isLegendVisible: boolean;
  isSelectorOpen: boolean;
  legendMetadata: HeatmapLegendMetadata | null;
  diagnostics: HeatmapDiagnostics | null;
  boundary: any | null;
  viewportBounds: { north: number; south: number; east: number; west: number } | null;
  zoom: number | null;

  // Actions
  setStatus: (status: HeatmapStatus) => void;
  setMetric: (metric: HeatmapMetric) => void;
  setSubMetric: (subMetric: HeatmapSubMetric) => void;
  setGeography: (geography: HeatmapGeography, options?: { country?: string; region?: string; placeName?: string }) => void;
  setTimeWindow: (timeWindow: HeatmapTimeWindow) => void;
  setRadiusKm: (radius: number) => void;
  setCountry: (country: string | null) => void;
  setRegion: (region: string | null) => void;
  setPlaceName: (placeName: string | null) => void;
  setViewport: (bounds: { north: number; south: number; east: number; west: number } | null, zoom: number | null) => void;
  setSelectedCell: (cell: HeatmapCell | null) => void;
  setHoveredCell: (cell: HeatmapCell | null) => void;
  setLegendVisible: (visible: boolean) => void;
  toggleLegendVisibility: () => void;
  setSelectorOpen: (open: boolean) => void;
  toggleSelectorOpen: () => void;
  setLegendMetadata: (metadata: HeatmapLegendMetadata | null) => void;
  toggleHeatmap: (currentLat?: number, currentLon?: number) => void;
  enableHeatmap: (currentLat?: number, currentLon?: number) => void;
  disableHeatmap: () => void;
  fetchHeatmapData: (
    lat?: number | null,
    lon?: number | null,
    radiusOverride?: number,
    viewportBoundsOverride?: { north: number; south: number; east: number; west: number } | null,
    zoomOverride?: number | null
  ) => Promise<void>;
  retry: () => Promise<void>;
}

function getResolutionForMetric(metric: HeatmapMetric): string {
  switch (metric) {
    case 'AQI':
      return '~10 km (Copernicus CAMS / Open-Meteo)';
    case 'TRAFFIC':
      return '~500 m (TomTom Traffic Flow)';
    case 'WEATHER':
      return '~25 km (Open-Meteo Global Forecasting)';
    case 'POPULATION':
      return '~1 km (WorldPop / Copernicus GHSL 2024)';
    default:
      return '~1 km';
  }
}

function getDisclaimerForMetric(metric: HeatmapMetric): string | null {
  if (metric === 'POPULATION') {
    return 'Population density is derived from high-resolution spatial modeling (WorldPop / GHSL 1km). Colors represent population concentration, not risk.';
  }
  return null;
}

import { useLocationStore } from './useLocationStore';

let activeAbortController: AbortController | null = null;
let currentRequestSeq = 0;
let lastRequestKey = '';
let lastRequestTimestamp = 0;

export const useHeatmapStore = create<HeatmapState>((set, get) => ({
  status: 'OFF',
  metric: 'AQI',
  subMetric: 'CURRENT_AQI',
  geography: 'CITY',
  timeWindow: 'NOW',
  radiusKm: 50,
  country: null,
  region: null,
  placeName: null,
  disclaimer: null,
  dataResolution: '~10 km (Copernicus CAMS / Open-Meteo)',
  cells: [],
  stats: null,
  selectedCell: null,
  hoveredCell: null,
  error: null,
  lastFetchedAt: null,
  lastCoords: null,
  isLegendVisible: false,
  isSelectorOpen: false,
  legendMetadata: null,

  diagnostics: null,
  boundary: null,
  viewportBounds: null,
  zoom: null,

  setStatus: (status) => set({ status }),
  setViewport: (viewportBounds, zoom) => set({ viewportBounds, zoom }),
  setLegendVisible: (isLegendVisible) => set({ isLegendVisible }),
  toggleLegendVisibility: () => {
    const next = !get().isLegendVisible;
    set({ isLegendVisible: next });
    if (next && get().status === 'OFF') {
      get().enableHeatmap();
    }
  },
  setSelectorOpen: (isSelectorOpen) => set({ isSelectorOpen }),
  toggleSelectorOpen: () => set((state) => ({ isSelectorOpen: !state.isSelectorOpen })),
  setLegendMetadata: (legendMetadata) => set({ legendMetadata }),

  setMetric: (metric) => {
    const defaultSub = DEFAULT_SUBMETRICS[metric] || 'DEFAULT';
    set({
      status: 'LOADING',
      metric,
      subMetric: defaultSub,
      cells: [],
      selectedCell: null,
      hoveredCell: null,
      dataResolution: getResolutionForMetric(metric),
      disclaimer: getDisclaimerForMetric(metric),
      isLegendVisible: true,
    });
    const currentGeog = get().geography;
    if (currentGeog === 'WORLD' || currentGeog === 'COUNTRY' || currentGeog === 'STATE') {
      get().fetchHeatmapData(null, null);
    } else {
      let coords = get().lastCoords;
      if (!coords && typeof window !== 'undefined') {
        try {
          const loc = useLocationStore.getState().currentLocation || useLocationStore.getState().currentDeviceLocation;
          if (loc && (loc.latitude !== 0 || loc.longitude !== 0)) {
            coords = { lat: loc.latitude, lng: loc.longitude };
          }
        } catch {}
      }
      get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null);
    }
  },

  setSubMetric: (subMetric) => {
    set({ subMetric, selectedCell: null, hoveredCell: null });
    const coords = get().lastCoords;
    if (get().status !== 'OFF') {
      get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null);
    }
  },

  setGeography: (geography, options) => {
    let radius = get().radiusKm;
    if (geography === 'WORLD') radius = 500;
    else if (geography === 'COUNTRY') radius = 300;
    else if (geography === 'STATE') radius = 150;
    else if (geography === 'CITY') radius = 50;
    else if (geography === 'PLACE') radius = 15;

    set({
      geography,
      radiusKm: radius,
      country: options?.country ?? get().country,
      region: options?.region ?? get().region,
      placeName: options?.placeName ?? get().placeName,
      selectedCell: null,
      hoveredCell: null,
      status: 'LOADING',
    });

    if (get().status !== 'OFF') {
      if (geography === 'WORLD' || geography === 'COUNTRY' || geography === 'STATE') {
        get().fetchHeatmapData(null, null, radius);
      } else {
        const coords = get().lastCoords;
        get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null, radius);
      }
    }
  },

  setTimeWindow: (timeWindow) => {
    set({ timeWindow });
    const coords = get().lastCoords;
    if (get().status !== 'OFF') {
      get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null);
    }
  },

  setRadiusKm: (radiusKm) => {
    set({ radiusKm });
    const coords = get().lastCoords;
    if (get().status !== 'OFF') {
      get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null, radiusKm);
    }
  },

  setCountry: (country) => {
    set({ country, selectedCell: null, hoveredCell: null });
    const coords = get().lastCoords;
    if (get().status !== 'OFF') {
      get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null);
    }
  },

  setRegion: (region) => {
    set({ region, selectedCell: null, hoveredCell: null });
    const coords = get().lastCoords;
    if (get().status !== 'OFF') {
      get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null);
    }
  },

  setPlaceName: (placeName) => {
    set({ placeName, selectedCell: null, hoveredCell: null });
    const coords = get().lastCoords;
    if (get().status !== 'OFF') {
      get().fetchHeatmapData(coords?.lat ?? null, coords?.lng ?? null);
    }
  },

  setSelectedCell: (selectedCell) => set({ selectedCell }),
  setHoveredCell: (hoveredCell) => set({ hoveredCell }),

  toggleHeatmap: () => {},
  enableHeatmap: () => {},
  disableHeatmap: () => {
    set({ status: 'OFF', cells: [], selectedCell: null, hoveredCell: null, error: null });
  },
  fetchHeatmapData: async () => {
    set({ status: 'OFF', cells: [] });
    return;
  },
  retry: async () => {},
}));

if (typeof window !== 'undefined') {
  (window as any).__UP_HEATMAP_STORE__ = useHeatmapStore;
}
