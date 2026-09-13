import { create } from 'zustand';
import { ResolvedLocation, IntelligenceRadiusKm, AppMode, UnitSystem } from '@shared/types';

interface LocationState {
  currentLocation: ResolvedLocation | null;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unsupported';
  selectedRadiusKm: IntelligenceRadiusKm;
  mode: AppMode;
  units: UnitSystem;
  isResolvingLocation: boolean;
  searchQuery: string;

  // Actions
  setCurrentLocation: (location: ResolvedLocation) => void;
  setPermissionStatus: (status: 'prompt' | 'granted' | 'denied' | 'unsupported') => void;
  setSelectedRadiusKm: (radius: IntelligenceRadiusKm) => void;
  setMode: (mode: AppMode) => void;
  setUnits: (units: UnitSystem) => void;
  setIsResolvingLocation: (resolving: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  permissionStatus: 'prompt',
  selectedRadiusKm: 50,
  mode: 'explore',
  units: 'metric',
  isResolvingLocation: false,
  searchQuery: '',

  setCurrentLocation: (location) => set({ currentLocation: location }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setSelectedRadiusKm: (radius) => set({ selectedRadiusKm: radius }),
  setMode: (mode) => set({ mode }),
  setUnits: (units) => set({ units }),
  setIsResolvingLocation: (resolving) => set({ isResolvingLocation: resolving }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
