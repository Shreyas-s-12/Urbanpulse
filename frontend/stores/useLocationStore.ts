import { create } from 'zustand';
import {
  ResolvedLocation,
  LocationContext,
  LocationSource,
  ActiveLocationMode,
  RawDeviceLocation,
  SelectedSearchLocation,
  SelectedPoiLocation,
  MapClickLocation,
  AddressMetadata,
  LocationAccuracyState,
  IntelligenceRadiusKm,
  AppMode,
  UnitSystem,
  MapFollowMode,
  LocationConflictStatus,
  SavedFavoriteLocation,
  PlaceCategoryType,
} from '@shared/types';
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function getSavedRecents(): SelectedSearchLocation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('up_recent_searches');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function getSavedFavorites(): SavedFavoriteLocation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('up_favorites');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
interface LocationState {
  // 1. Four Strictly Unmixed State Objects
  currentDeviceLocation: RawDeviceLocation | null;
  selectedLocation: SelectedSearchLocation | null;
  selectedPOI: SelectedPoiLocation | null;
  mapClickLocation: MapClickLocation | null;
  // 2. Cache Only (never automatically presented as current device location without fresh fix)
  lastKnownLocation: RawDeviceLocation | null;
  // 3. Operating Mode & Active Coordinates
  activeLocationMode: ActiveLocationMode;
  activeSource: LocationSource;
  currentLocation: ResolvedLocation | null; // Canonical active location for all consumers
  activeLocationContext: LocationContext | null;
  // 4. Accuracy & Sequence Tracking (Race Condition Protection)
  locationAccuracyState: LocationAccuracyState;
  gpsAccuracyMeters: number | null;
  gpsTimestamp: number | null;
  locationSequenceNumber: number;
  overrideBlockCount: number;
  isLiveTracking: boolean;
  isStale: boolean;
  // 5. Modern 2026 Map Follow & Conflict State
  mapFollowMode: MapFollowMode;
  setMapFollowMode: (mode: MapFollowMode) => void;
  conflictStatus: LocationConflictStatus;
  setConflictStatus: (status: LocationConflictStatus) => void;
  // 6. Manual Pin Placement / Adjustment
  isAdjustingPin: boolean;
  manualDraftCoords: { latitude: number; longitude: number } | null;
  startPinAdjustment: () => void;
  updateDraftPinCoords: (coords: { latitude: number; longitude: number }) => void;
  confirmManualPin: () => void;
  cancelPinAdjustment: () => void;
  // 7. Search Drawer, Recents, and Favorites (Sections 66-76, 81)
  isSearchDrawerOpen: boolean;
  setSearchDrawerOpen: (open: boolean) => void;
  isChoosingOnMap: boolean;
  setIsChoosingOnMap: (choosing: boolean) => void;
  isSelectingMapLocation: boolean;
  setIsSelectingMapLocation: (selecting: boolean) => void;
  mapSelectedLocation: MapClickLocation | null;
  mapClickDraft: {
    latitude: number;
    longitude: number;
    source: 'MAP_CLICK' | 'MANUAL_ADJUSTMENT';
    timestamp: number;
    addressMetadata?: AddressMetadata;
    isAdjusted?: boolean;
    resolving?: boolean;
  } | null;
  setMapClickDraft: (draft: { latitude: number; longitude: number; source?: 'MAP_CLICK' | 'MANUAL_ADJUSTMENT'; isAdjusted?: boolean } | null) => void;
  setMapClickDraftMetadata: (meta: AddressMetadata) => void;
  confirmManualMapLocation: () => void;
  cancelMapSelection: () => void;
  recentLocations: SelectedSearchLocation[];
  savedFavorites: SavedFavoriteLocation[];
  addRecentLocation: (loc: SelectedSearchLocation) => void;
  clearRecentLocations: () => void;
  addFavoriteLocation: (fav: SavedFavoriteLocation) => void;
  removeFavoriteLocation: (id: string) => void;
  setManualMapLocation: (coords: { latitude: number; longitude: number }, meta?: AddressMetadata) => void;
  // Other UI & Intelligence State
  selectedMapPoint: { latitude: number; longitude: number; label?: string; city?: string; country?: string } | null;
  comparisonLocations: Array<{ name: string; latitude: number; longitude: number }>;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unsupported';
  selectedRadiusKm: IntelligenceRadiusKm;
  mode: AppMode;
  units: UnitSystem;
  isResolvingLocation: boolean;
  searchQuery: string;
  // Validation & Actions
  distanceFromRawDeviceLocation: (targetLat: number, targetLon: number) => number;
  getNextSequenceNumber: () => number;
  validateAndSetDeviceLocation: (raw: RawDeviceLocation, finalState?: LocationAccuracyState, seq?: number) => boolean;
  updateDeviceAddressMetadata: (meta: AddressMetadata) => void;
  setSelectedSearchLocation: (loc: SelectedSearchLocation, seq?: number) => void;
  setSelectedPOI: (poi: SelectedPoiLocation) => void;
  setMapClickLocation: (coords: { latitude: number; longitude: number }, meta?: AddressMetadata) => void;
  switchToDeviceLocation: () => void;
  setIsLiveTracking: (tracking: boolean) => void;
  // Backward compatibility actions
  setCurrentLocation: (location: ResolvedLocation | LocationContext) => void;
  setDeviceLocation: (location: LocationContext | RawDeviceLocation, state?: LocationAccuracyState) => void;
  setSearchedLocation: (location: ResolvedLocation | LocationContext | SelectedSearchLocation) => void;
  setLocationAccuracyState: (state: LocationAccuracyState) => void;
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
  isHeatmapActive: boolean;
  toggleHeatmap: () => void;
  setIsHeatmapActive: (active: boolean) => void;
}
export const useLocationStore = create<LocationState>((set, get) => ({
  currentDeviceLocation: null,
  selectedLocation: null,
  selectedPOI: null,
  mapClickLocation: null,
  lastKnownLocation: null,
  activeLocationMode: 'DEVICE',
  activeSource: 'BROWSER_GEOLOCATION',
  currentLocation: null,
  activeLocationContext: null,
  locationAccuracyState: 'IDLE',
  gpsAccuracyMeters: null,
  gpsTimestamp: null,
  locationSequenceNumber: 0,
  overrideBlockCount: 0,
  isLiveTracking: false,
  isStale: false,
  mapFollowMode: 'MY_LOCATION',
  setMapFollowMode: (mode: MapFollowMode) => set({ mapFollowMode: mode }),
  conflictStatus: { hasConflict: false },
  setConflictStatus: (status: LocationConflictStatus) => set({ conflictStatus: status }),
  isAdjustingPin: false,
  manualDraftCoords: null,
  startPinAdjustment: () => {
    const curr = get().currentLocation || get().currentDeviceLocation;
    set({
      isAdjustingPin: true,
      manualDraftCoords: curr ? { latitude: curr.latitude, longitude: curr.longitude } : null,
    });
  },
  updateDraftPinCoords: (coords: { latitude: number; longitude: number }) => {
    set({ manualDraftCoords: coords });
  },
  confirmManualPin: () => {
    const draft = get().manualDraftCoords;
    if (!draft) return;
    const resolved: ResolvedLocation = {
      latitude: draft.latitude,
      longitude: draft.longitude,
      city: `${draft.latitude.toFixed(4)}°N`,
      country: `${draft.longitude.toFixed(4)}°E`,
      displayName: `Manual Pin (${draft.latitude.toFixed(4)}, ${draft.longitude.toFixed(4)})`,
      isUserLocation: true,
      source: 'MANUAL',
    };
    const context: LocationContext = {
      ...resolved,
      source: 'MANUAL',
      accuracy: 5,
      accuracyMeters: 5,
      accuracyTier: 'EXCELLENT',
      confidence: 1.0,
      confidenceTier: 'HIGH',
      status: 'LOCKED',
      timestamp: Date.now(),
    };
    set({
      currentLocation: resolved,
      activeLocationContext: context,
      activeLocationMode: 'MANUAL',
      activeSource: 'MANUAL',
      isAdjustingPin: false,
      manualDraftCoords: null,
      mapFollowMode: 'EXPLORE',
    });
  },
  cancelPinAdjustment: () => {
    set({ isAdjustingPin: false, manualDraftCoords: null });
  },
  isSearchDrawerOpen: false,
  setSearchDrawerOpen: (open: boolean) => set({ isSearchDrawerOpen: open }),
  isChoosingOnMap: false,
  setIsChoosingOnMap: (choosing: boolean) =>
    set({
      isChoosingOnMap: choosing,
      isSelectingMapLocation: choosing,
      ...(choosing ? { mapClickDraft: null } : {}),
    }),
  isSelectingMapLocation: false,
  setIsSelectingMapLocation: (selecting: boolean) =>
    set({
      isSelectingMapLocation: selecting,
      isChoosingOnMap: selecting,
      ...(selecting ? { mapClickDraft: null } : {}),
    }),
  mapSelectedLocation: null,
  mapClickDraft: null,
  setMapClickDraft: (draft) => {
    if (!draft) {
      set({ mapClickDraft: null });
      return;
    }
    const current = get().mapClickDraft;
    const isAdjusted = draft.isAdjusted || draft.source === 'MANUAL_ADJUSTMENT' || false;
    const source = isAdjusted ? 'MANUAL_ADJUSTMENT' : 'MAP_CLICK';
    set({
      mapClickDraft: {
        latitude: draft.latitude,
        longitude: draft.longitude,
        source,
        timestamp: Date.now(),
        isAdjusted,
        addressMetadata:
          current?.latitude === draft.latitude && current?.longitude === draft.longitude
            ? current.addressMetadata
            : undefined,
        resolving: true,
      },
    });
  },
  setMapClickDraftMetadata: (meta: AddressMetadata) => {
    set((state) => {
      if (!state.mapClickDraft) return state;
      return {
        mapClickDraft: {
          ...state.mapClickDraft,
          addressMetadata: meta,
          resolving: false,
        },
      };
    });
  },
  confirmManualMapLocation: () => {
    const draft = get().mapClickDraft;
    if (!draft) return;
    const meta = draft.addressMetadata;
    const isAdjusted = draft.isAdjusted || draft.source === 'MANUAL_ADJUSTMENT';
    const source = isAdjusted ? 'MANUAL_ADJUSTMENT' : 'MAP_CLICK';
    const resolved: ResolvedLocation = {
      latitude: draft.latitude,
      longitude: draft.longitude,
      city: meta?.city || meta?.locality || `${draft.latitude.toFixed(4)}°, ${draft.longitude.toFixed(4)}°`,
      district: meta?.district || null,
      state: meta?.state || null,
      region: meta?.state || null,
      country: meta?.country || null,
      countryCode: meta?.countryCode || null,
      displayName:
        meta?.formattedAddress ||
        `Map Location (${draft.latitude.toFixed(4)}, ${draft.longitude.toFixed(4)})`,
      isUserLocation: false,
      source,
      rawLatitude: draft.latitude,
      rawLongitude: draft.longitude,
    };
    const context: LocationContext = {
      ...resolved,
      source,
      addressMetadata: meta,
    };
    const mapClickLoc: MapClickLocation = {
      latitude: draft.latitude,
      longitude: draft.longitude,
      source,
      timestamp: draft.timestamp,
      isAdjusted,
      addressMetadata: meta,
    };
    set({
      mapClickLocation: mapClickLoc,
      mapSelectedLocation: mapClickLoc,
      activeLocationMode: source,
      activeSource: source,
      currentLocation: resolved,
      activeLocationContext: context,
      isSelectingMapLocation: false,
      isChoosingOnMap: false,
      mapClickDraft: null,
      mapFollowMode: 'EXPLORE',
    });
  },
  cancelMapSelection: () => {
    set({
      isSelectingMapLocation: false,
      isChoosingOnMap: false,
      mapClickDraft: null,
    });
  },
  recentLocations: getSavedRecents(),
  savedFavorites: getSavedFavorites(),
  addRecentLocation: (loc: SelectedSearchLocation) => {
    set((state) => {
      const filtered = state.recentLocations.filter(
        (r) => (r.placeId && loc.placeId ? r.placeId !== loc.placeId : (r.latitude !== loc.latitude || r.longitude !== loc.longitude))
      );
      const updated = [loc, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('up_recent_searches', JSON.stringify(updated));
      } catch {}
      return { recentLocations: updated };
    });
  },
  clearRecentLocations: () => {
    try {
      localStorage.removeItem('up_recent_searches');
    } catch {}
    set({ recentLocations: [] });
  },
  addFavoriteLocation: (fav: SavedFavoriteLocation) => {
    set((state) => {
      const filtered = state.savedFavorites.filter((f) => f.id !== fav.id);
      const updated = [...filtered, fav];
      try {
        localStorage.setItem('up_favorites', JSON.stringify(updated));
      } catch {}
      return { savedFavorites: updated };
    });
  },
  removeFavoriteLocation: (id: string) => {
    set((state) => {
      const updated = state.savedFavorites.filter((f) => f.id !== id);
      try {
        localStorage.setItem('up_favorites', JSON.stringify(updated));
      } catch {}
      return { savedFavorites: updated };
    });
  },
  setManualMapLocation: (coords: { latitude: number; longitude: number }, meta?: AddressMetadata) => {
    const resolved: ResolvedLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      city: meta?.city || meta?.locality || `${coords.latitude.toFixed(4)}°, ${coords.longitude.toFixed(4)}°`,
      district: meta?.district || null,
      state: meta?.state || null,
      region: meta?.state || null,
      country: meta?.country || null,
      countryCode: meta?.countryCode || null,
      displayName: meta?.formattedAddress || `Map Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
      isUserLocation: false,
      source: 'MAP_CLICK',
      rawLatitude: coords.latitude,
      rawLongitude: coords.longitude,
    };
    const context: LocationContext = {
      ...resolved,
      source: 'MAP_CLICK',
      addressMetadata: meta,
    };
    const mapClickLoc: MapClickLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      source: 'MAP_CLICK',
      addressMetadata: meta,
    };
    set({
      mapClickLocation: mapClickLoc,
      activeLocationMode: 'MAP_CLICK',
      activeSource: 'MAP_CLICK',
      currentLocation: resolved,
      activeLocationContext: context,
      isChoosingOnMap: false,
    });
  },
  selectedMapPoint: null,
  comparisonLocations: [],
  permissionStatus: 'prompt',
  selectedRadiusKm: 50,
  mode: 'explore',
  units: 'metric',
  isResolvingLocation: false,
  searchQuery: '',
  isHeatmapActive: false,
  toggleHeatmap: () => {},
  setIsHeatmapActive: () => {},
  distanceFromRawDeviceLocation: (targetLat: number, targetLon: number) => {
    const dev = get().currentDeviceLocation;
    if (!dev) return 0;
    return haversineDistanceMeters(dev.latitude, dev.longitude, targetLat, targetLon);
  },
  getNextSequenceNumber: () => {
    const nextSeq = get().locationSequenceNumber + 1;
    set({ locationSequenceNumber: nextSeq });
    return nextSeq;
  },
  validateAndSetDeviceLocation: (raw: RawDeviceLocation, finalState: LocationAccuracyState = 'READY', seq?: number) => {
    const state = get();
    // 1. Race condition check: discard stale responses
    if (seq !== undefined && seq < state.locationSequenceNumber) {
      console.log(`[UrbanPulse] Discarded stale location sequence ${seq} (current: ${state.locationSequenceNumber})`);
      return false;
    }
    // 2. Distance guard against accidental overrides with derived/geocoded points
    if (raw.source !== 'BROWSER_GEOLOCATION' && raw.source !== 'DEVICE') {
      console.warn(
        `[UrbanPulse] CURRENT_LOCATION_OVERRIDE_BLOCKED: Attempted to set device location from invalid source '${raw.source}'`
      );
      set((s) => ({ overrideBlockCount: s.overrideBlockCount + 1 }));
      return false;
    }

    const canonicalDeviceLocation: RawDeviceLocation = {
      latitude: raw.latitude,
      longitude: raw.longitude,
      accuracyMeters: raw.accuracyMeters,
      timestamp: raw.timestamp,
      source: 'DEVICE',
      addressMetadata: raw.addressMetadata,
    };

    const resolvedObj: ResolvedLocation = {
      latitude: raw.latitude,
      longitude: raw.longitude,
      accuracy: raw.accuracyMeters,
      city: raw.addressMetadata?.city || `${raw.latitude.toFixed(4)}°N`,
      district: raw.addressMetadata?.district || null,
      state: raw.addressMetadata?.state || null,
      region: raw.addressMetadata?.state || null,
      country: raw.addressMetadata?.country || `${raw.longitude.toFixed(4)}°E`,
      countryCode: raw.addressMetadata?.countryCode || null,
      displayName:
        raw.addressMetadata?.formattedAddress ||
        `Device Location (${raw.latitude.toFixed(4)}, ${raw.longitude.toFixed(4)})`,
      isUserLocation: true,
      source: 'DEVICE',
      timestamp: raw.timestamp,
      rawLatitude: raw.latitude,
      rawLongitude: raw.longitude,
    };
    const contextObj: LocationContext = {
      ...resolvedObj,
      source: 'DEVICE',
      accuracyMeters: raw.accuracyMeters,
      addressMetadata: raw.addressMetadata,
      timestamp: raw.timestamp,
      status: finalState,
    };
    set({
      currentDeviceLocation: canonicalDeviceLocation,
      lastKnownLocation: canonicalDeviceLocation,
      activeLocationMode: 'DEVICE',
      activeSource: 'DEVICE',
      currentLocation: resolvedObj,
      activeLocationContext: contextObj,
      gpsAccuracyMeters: raw.accuracyMeters,
      gpsTimestamp: raw.timestamp,
      locationAccuracyState: finalState,
      isResolvingLocation: false,
    });
    return true;
  },
  updateDeviceAddressMetadata: (meta: AddressMetadata) => {
    set((state) => {
      if (!state.currentDeviceLocation) return state;
      const updatedRaw: RawDeviceLocation = {
        ...state.currentDeviceLocation,
        addressMetadata: meta,
      };
      const updatedResolved: ResolvedLocation = {
        ...state.currentLocation!,
        latitude: state.currentDeviceLocation.latitude, // Strictly unchanged
        longitude: state.currentDeviceLocation.longitude, // Strictly unchanged
        city: meta.city || state.currentLocation?.city || null,
        district: meta.district || state.currentLocation?.district || null,
        state: meta.state || state.currentLocation?.state || null,
        region: meta.state || state.currentLocation?.region || null,
        country: meta.country || state.currentLocation?.country || null,
        countryCode: meta.countryCode || state.currentLocation?.countryCode || null,
        displayName: meta.formattedAddress || state.currentLocation?.displayName || '',
      };
      const updatedContext: LocationContext = {
        ...updatedResolved,
        source: 'DEVICE',
        addressMetadata: meta,
      };
      return {
        currentDeviceLocation: updatedRaw,
        ...(state.activeLocationMode === 'DEVICE'
          ? {
              currentLocation: updatedResolved,
              activeLocationContext: updatedContext,
            }
          : {}),
      };
    });
  },
  setSelectedSearchLocation: (loc: SelectedSearchLocation, seq?: number) => {
    const state = get();
    if (seq !== undefined && seq < state.locationSequenceNumber) {
      console.log(`[UrbanPulse] Discarded stale search sequence ${seq} (current: ${state.locationSequenceNumber})`);
      return;
    }
    const resolved: ResolvedLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      city: loc.city || loc.displayName,
      district: loc.district || null,
      state: loc.state || null,
      region: loc.state || null,
      country: loc.country || null,
      countryCode: loc.countryCode || null,
      displayName: loc.formattedAddress || loc.displayName,
      isUserLocation: false,
      source: 'SEARCH',
    };
    const context: LocationContext = {
      ...resolved,
      source: 'SEARCH',
    };
    get().addRecentLocation(loc);
    set({
      selectedLocation: loc,
      activeLocationMode: 'SEARCH',
      activeSource: 'SEARCH',
      currentLocation: resolved,
      activeLocationContext: context,
      searchQuery: '',
      isSearchDrawerOpen: false,
    });
  },
  setSelectedPOI: (poi: SelectedPoiLocation) => {
    const resolved: ResolvedLocation = {
      latitude: poi.latitude,
      longitude: poi.longitude,
      city: poi.displayName,
      displayName: poi.formattedAddress ? `${poi.displayName} — ${poi.formattedAddress}` : poi.displayName,
      country: null,
      isUserLocation: false,
      source: 'POI',
      placeId: poi.placeId,
    };
    const context: LocationContext = {
      ...resolved,
      source: 'POI',
    };
    set({
      selectedPOI: poi,
      activeLocationMode: 'POI',
      activeSource: 'POI',
      currentLocation: resolved,
      activeLocationContext: context,
    });
  },
  setMapClickLocation: (coords: { latitude: number; longitude: number }, meta?: AddressMetadata) => {
    const mapClick: MapClickLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      source: 'MAP_CLICK',
      addressMetadata: meta,
    };
    const resolved: ResolvedLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      city: meta?.city || `${coords.latitude.toFixed(4)}°N`,
      district: meta?.district || null,
      state: meta?.state || null,
      country: meta?.country || `${coords.longitude.toFixed(4)}°E`,
      countryCode: meta?.countryCode || null,
      displayName: meta?.formattedAddress || `Map Point (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
      isUserLocation: false,
      source: 'MAP_CLICK',
    };
    const context: LocationContext = {
      ...resolved,
      source: 'MAP_CLICK',
    };
    set({
      mapClickLocation: mapClick,
      activeLocationMode: 'MAP_CLICK',
      activeSource: 'MAP_CLICK',
      currentLocation: resolved,
      activeLocationContext: context,
    });
  },
  switchToDeviceLocation: () => {
    const dev = get().currentDeviceLocation;
    if (!dev) return;
    const resolved: ResolvedLocation = {
      latitude: dev.latitude,
      longitude: dev.longitude,
      accuracy: dev.accuracyMeters,
      city: dev.addressMetadata?.city || `${dev.latitude.toFixed(4)}°N`,
      district: dev.addressMetadata?.district || null,
      state: dev.addressMetadata?.state || null,
      region: dev.addressMetadata?.state || null,
      country: dev.addressMetadata?.country || `${dev.longitude.toFixed(4)}°E`,
      countryCode: dev.addressMetadata?.countryCode || null,
      displayName: dev.addressMetadata?.formattedAddress || `Device Location (${dev.latitude.toFixed(4)}, ${dev.longitude.toFixed(4)})`,
      isUserLocation: true,
      source: 'DEVICE',
      timestamp: dev.timestamp,
    };
    const context: LocationContext = {
      ...resolved,
      source: 'DEVICE',
      accuracyMeters: dev.accuracyMeters,
    };
    set({
      activeLocationMode: 'DEVICE',
      activeSource: 'DEVICE',
      currentLocation: resolved,
      activeLocationContext: context,
      searchQuery: '',
    });
  },
  setIsLiveTracking: (tracking: boolean) => set({ isLiveTracking: tracking }),
  // Backward compatibility actions
  setCurrentLocation: (location) => {
    if (location.isUserLocation) {
      get().validateAndSetDeviceLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracy || 15,
        timestamp: (location as any).timestamp || Date.now(),
        source: 'BROWSER_GEOLOCATION',
      });
    } else {
      get().setSelectedSearchLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        displayName: location.displayName,
        formattedAddress: location.address || undefined,
        city: location.city,
        country: location.country,
        countryCode: location.countryCode,
        source: 'SEARCH',
      });
    }
  },
  setDeviceLocation: (location: any, accState: LocationAccuracyState = 'LOCKED') => {
    const raw: RawDeviceLocation = {
      latitude: location.rawLatitude ?? location.latitude,
      longitude: rawLongitude(location),
      accuracyMeters: location.accuracyMeters ?? location.accuracy ?? 15,
      timestamp: location.timestamp || Date.now(),
      source: 'BROWSER_GEOLOCATION',
      addressMetadata: location.addressMetadata,
    };
    get().validateAndSetDeviceLocation(raw, accState);
  },
  setSearchedLocation: (location: any) => {
    get().setSelectedSearchLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      displayName: location.displayName || location.city || 'Searched Location',
      formattedAddress: location.address,
      city: location.city,
      country: location.country,
      countryCode: location.countryCode,
      source: 'SEARCH',
    });
  },
  setLocationAccuracyState: (accState) => set({ locationAccuracyState: accState }),
  setSelectedMapPoint: (point) => set({ selectedMapPoint: point }),
  setComparisonLocations: (locations) => set({ comparisonLocations: locations }),
  addComparisonLocation: (location) =>
    set((state) => ({
      comparisonLocations:
        state.comparisonLocations.length < 5
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
function rawLongitude(loc: any): number {
  return loc.rawLongitude ?? loc.longitude;
}

if (typeof window !== 'undefined') {
  (window as any).__UP_LOCATION_STORE__ = useLocationStore;
  (window as any).__UP_LOCATION_DIAGNOSTICS__ = {
    getDiagnostics: () => {
      const store = useLocationStore.getState();
      const dev = store.currentDeviceLocation;
      const cur = store.currentLocation;
      const gmap = (window as any).__UP_GMAP_INSTANCE__;
      const marker = (window as any).__UP_USER_MARKER__;

      const gmapCenter = gmap?.getCenter?.();
      const gLat = gmapCenter ? gmapCenter.lat() : cur?.latitude ?? null;
      const gLng = gmapCenter ? gmapCenter.lng() : cur?.longitude ?? null;

      const mPos = marker?.getPosition?.();
      const mLat = mPos ? mPos.lat() : (store.activeLocationMode === 'DEVICE' ? dev?.latitude ?? null : cur?.latitude ?? null);
      const mLng = mPos ? mPos.lng() : (store.activeLocationMode === 'DEVICE' ? dev?.longitude ?? null : cur?.longitude ?? null);

      const dLat = dev?.latitude ?? null;
      const dLng = dev?.longitude ?? null;
      const fLat = cur?.latitude ?? null;
      const fLng = cur?.longitude ?? null;

      const rawToFinal = (dLat !== null && dLng !== null && fLat !== null && fLng !== null)
        ? haversineDistanceMeters(dLat, dLng, fLat, fLng)
        : null;
      const finalToMap = (fLat !== null && fLng !== null && gLat !== null && gLng !== null)
        ? haversineDistanceMeters(fLat, fLng, gLat, gLng)
        : null;
      const finalToMarker = (fLat !== null && fLng !== null && mLat !== null && mLng !== null)
        ? haversineDistanceMeters(fLat, fLng, mLat, mLng)
        : null;

      const isSupported = typeof window !== 'undefined' && 'geolocation' in navigator ? 'YES' : 'NO';
      const isSecure = typeof window !== 'undefined' ? (window.isSecureContext ? 'YES' : 'NO') : 'YES';
      const mapReady = Boolean(gmap) ? 'YES' : 'NO';
      const markerReady = Boolean(marker) ? 'YES' : 'NO';
      const requestStatus = (store.isResolvingLocation || store.locationAccuracyState === 'LOCATING') ? 'STARTED' : 'IDLE';
      const resultStatus = (store.locationAccuracyState === 'READY' || store.locationAccuracyState === 'LOCKED' || store.locationAccuracyState === 'FOUND')
        ? 'SUCCESS'
        : (store.locationAccuracyState === 'DENIED' || store.locationAccuracyState === 'TIMEOUT' || store.locationAccuracyState === 'UNAVAILABLE' || store.locationAccuracyState === 'ERROR')
        ? store.locationAccuracyState
        : 'IDLE';

      return {
        permission: store.permissionStatus || 'unknown',
        supported: isSupported,
        secureContext: isSecure,
        request: requestStatus,
        result: resultStatus,
        mapReady,
        marker: markerReady,
        deviceLat: dLat,
        deviceLng: dLng,
        finalLat: fLat,
        finalLng: fLng,
        accuracy: dev?.accuracyMeters ?? null,
        timestamp: dev?.timestamp ?? null,
        ageSeconds: dev?.timestamp ? Math.max(0, Math.floor((Date.now() - dev.timestamp) / 1000)) : null,
        mapLat: gLat,
        mapLng: gLng,
        markerLat: mLat,
        markerLng: mLng,
        rawToFinalDistanceMeters: rawToFinal,
        finalToMapDistanceMeters: finalToMap,
        finalToMarkerDistanceMeters: finalToMarker,
        activeLocationMode: store.activeLocationMode,
        locationAccuracyState: store.locationAccuracyState,
        formattedAddress: dev?.addressMetadata?.formattedAddress || cur?.displayName || null,
      };
    },
  };
}

