import { create } from 'zustand';
import { ResolvedLocation, IntelligenceRadiusKm, AppMode, UnitSystem } from '@shared/types';

interface LocationState {
  currentLocation: ResolvedLocation | null;
  selectedMapPoint: { latitude: number; longitude: number; label?: string; city?: string; country?: string } | null;
  comparisonLocations: Array<{ name: string; latitude: number; longitude: number }>;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unsupported';
  selectedRadiusKm: IntelligenceRadiusKm;
  mode: AppMode;
  units: UnitSystem;
  isResolvingLocation: boolean;
  searchQuery: string;

  // Actions
  setCurrentLocation: (location: ResolvedLocation) => void;
  setSelectedMapPoint: (point: { latitude: number; longitude: number; label?: string; city?: string; country?: string } | null) => void;
  setComparisonLocations: (locations: Array<{ name: string; latitude: number; longitude: number }>) => void;
  addComparisonLocation: (location: { name: string; latitude: number; longitude: number }) => void;
  removeComparisonLocation: (index: number) => void;
  clearComparisonLocations: () => void;
  setPermissionStatus: (status: 'prompt' | 'granted' | 'denied' | 'unsupported') => void;
  setSelectedRadiusKm: (radius: IntelligenceRadiusKm) => void;
  setMode: (mode: AppMode) => void;
  setUnits: (units: UnitSystem) => void;
  setIsResolvingLocation: (resolving: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  selectedMapPoint: null,
  comparisonLocations: [],
  permissionStatus: 'prompt',
  selectedRadiusKm: 50,
  mode: 'explore',
  units: 'metric',
  isResolvingLocation: false,
  searchQuery: '',

  setCurrentLocation: (location) => set({ currentLocation: location }),
  setSelectedMapPoint: (point) => set({ selectedMapPoint: point }),
  setComparisonLocations: (locations) => set({ comparisonLocations: locations }),
  addComparisonLocation: (location) =>
    set((state) => ({
      comparisonLocations: state.comparisonLocations.length < 5
        ? [...state.comparisonLocations, location]
        : state.comparisonLocations,
    })),
  removeComparisonLocation: (index) =>
    set((state) => ({
      comparisonLocations: state.comparisonLocations.filter((_, i) => i !== index),
    })),
  clearComparisonLocations: () => set({ comparisonLocations: [] }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setSelectedRadiusKm: (radius) => set({ selectedRadiusKm: radius }),
  setMode: (mode) => set({ mode }),
  setUnits: (units) => set({ units }),
  setIsResolvingLocation: (resolving) => set({ isResolvingLocation: resolving }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));

