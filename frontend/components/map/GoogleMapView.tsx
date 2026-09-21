'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ResolvedLocation, UnifiedCityEvent, CandidateRoute, MapMode, SpatialRiskZone } from '@shared/types';
import { GoogleTrafficLayerManager } from './traffic/GoogleTrafficLayer';
import PlaceDetailCard, { SelectedPlaceDetail } from './PlaceDetailCard';
import MapControlBar from './MapControlBar';
import MapLocationHUD from './MapLocationHUD';
import MapLegend from './MapLegend';

export type MapStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'timeout'
  | 'unavailable';

export interface MapLayersState {
  traffic?: boolean;
  aqi?: boolean;
  accidents?: boolean;
  disasters?: boolean;
  hazards?: boolean;
  boundary?: boolean;
  risk?: boolean;
}

export interface GoogleMapViewProps {
  center: ResolvedLocation | null;
  radiusKm: number;
  events: UnifiedCityEvent[];
  layers?: MapLayersState;
  trafficEnabled?: boolean;
  aqiEnabled?: boolean;
  aqiData?: any;
  zoomOverride?: number;
  mapMode?: MapMode | 'roadmap' | 'satellite' | 'terrain' | 'hybrid' | '3D';
  onModeChange?: (mode: MapMode) => void;
  activeRoute?: CandidateRoute | null;
  routes?: CandidateRoute[];
  weatherData?: { tempC?: number; condition?: string } | null;
  riskZones?: SpatialRiskZone[];
  activeFilter?: string;
  onSelectRoute?: (route: CandidateRoute) => void;
  onSelectEvent?: (event: UnifiedCityEvent) => void;
  onMapClick?: (coords: { latitude: number; longitude: number }) => void;
  onSelectPoi?: (place: SelectedPlaceDetail) => void;
  onAskAgentPoi?: (place: SelectedPlaceDetail) => void;
  onNearbyActivitiesPoi?: (place: SelectedPlaceDetail) => void;
  height?: string;
  showStatusBadge?: boolean;
  statusBadgeLeft?: number;
  isMobile?: boolean;
  showLocationHud?: boolean;
  showLegend?: boolean;
}

import { googleMapsLoader } from '@/services/googleMapsLoader';
import { GoogleMapErrorBoundary, SubsystemErrorBoundary } from '@/components/common/ErrorBoundary';
import { formatDisplayValue } from '@/components/common/displayUtils';
import { useLocationStore } from '@/stores/useLocationStore';
import { useAgentStore } from '@/stores/useAgentStore';
import ModernLocationStatusBadge from './ModernLocationStatusBadge';
import ResearchModePanel from '@/components/research/ResearchModePanel';
import MapLocationPicker from './MapLocationPicker';
import { locationService } from '@/services/locationService';


function GoogleMapViewInner({
  center,
  radiusKm,
  events,
  layers,
  trafficEnabled,
  aqiEnabled,
  aqiData,
  zoomOverride,
  mapMode = 'ROADMAP',
  onModeChange,
  activeRoute,
  routes,
  weatherData,
  riskZones = [],
  activeFilter = 'ALL',
  onSelectRoute,
  onSelectEvent,
  onMapClick,
  onSelectPoi,
  onAskAgentPoi,
  onNearbyActivitiesPoi,
  height,
  showStatusBadge = true,
  statusBadgeLeft = 16,
  isMobile = false,
  showLocationHud = false,
  showLegend = true,
}: GoogleMapViewProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    (typeof window !== 'undefined' && (window as any).__UP_GMAPS_KEY ? (window as any).__UP_GMAPS_KEY : '');

  // Canonical Map Mode & 3D Vector Tilt/Heading State
  const initialMode = (mapMode?.toUpperCase() as MapMode) || 'ROADMAP';
  const [currentMode, setCurrentMode] = useState<MapMode>(initialMode);
  const [tilt, setTilt] = useState<number>(0);
  const [heading, setHeading] = useState<number>(0);
  const [is3DSupported, setIs3DSupported] = useState<boolean>(true);
  const [fallbackTo2D, setFallbackTo2D] = useState<boolean>(false);
  const currentDeviceLocation = useLocationStore((s) => s.currentDeviceLocation);
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const activeLocationMode = useLocationStore((s) => s.activeLocationMode);
  const isChoosingOnMap = useLocationStore((s) => s.isChoosingOnMap);
  const isSelectingMapLocation = useLocationStore((s) => s.isSelectingMapLocation || s.isChoosingOnMap);
  const mapClickDraft = useLocationStore((s) => s.mapClickDraft);
  const setIsChoosingOnMap = useLocationStore((s) => s.setIsChoosingOnMap);
  const setManualMapLocation = useLocationStore((s) => s.setManualMapLocation);
  const setSelectedSearchLocation = useLocationStore((s) => s.setSelectedSearchLocation);
  const isAdjustingPin = useLocationStore((s) => s.isAdjustingPin);
  const manualDraftCoords = useLocationStore((s) => s.manualDraftCoords);
  const updateDraftPinCoords = useLocationStore((s) => s.updateDraftPinCoords);

  const mapSelectionSeqRef = useRef<number>(0);
  const handleCoordinateSelectionRef = useRef<(lat: number, lng: number, isAdjusted?: boolean) => void>();

  const handleCoordinateSelection = useCallback((lat: number, lng: number, isAdjusted = false) => {
    const seq = ++mapSelectionSeqRef.current;
    console.log(`[UrbanPulse Map] Map click coordinate captured: (${lat}, ${lng}), isAdjusted: ${isAdjusted}, seq: ${seq}`);

    // Immediate synchronous coordinate extraction & state update
    useLocationStore.getState().setMapClickDraft({
      latitude: lat,
      longitude: lng,
      source: isAdjusted ? 'MANUAL_ADJUSTMENT' : 'MAP_CLICK',
      isAdjusted,
    });

    // Asynchronous address enrichment with sequence race protection
    locationService
      .reverseGeocodeMetadata(lat, lng)
      .then((meta) => {
        if (seq === mapSelectionSeqRef.current) {
          useLocationStore.getState().setMapClickDraftMetadata(meta);
        }
      })
      .catch((err) => {
        console.warn('[GoogleMapView] Reverse geocode metadata non-fatal warning:', err);
      });
  }, []);

  useEffect(() => {
    handleCoordinateSelectionRef.current = handleCoordinateSelection;
  }, [handleCoordinateSelection]);

  // Street View State & Non-Blocking Error Isolation
  const [streetViewActive, setStreetViewActive] = useState<boolean>(false);
  const [streetViewLocation, setStreetViewLocation] = useState<{ latitude: number; longitude: number; name?: string } | null>(null);
  const [streetViewNotice, setStreetViewNotice] = useState<string | null>(null);
  const [streetViewErrorType, setStreetViewErrorType] = useState<'NONE' | 'UNAVAILABLE' | 'API_ERROR'>('NONE');

  // DOM Container & Google Maps Object References
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    mapContainerRef.current = node;
    setContainerNode(node);
  }, []);

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficManagerRef = useRef<GoogleTrafficLayerManager | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const searchedLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const draftPinMarkerRef = useRef<google.maps.Marker | null>(null);

  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const routeMarkersRef = useRef<google.maps.Marker[]>([]);
  const rankedMarkersRef = useRef<google.maps.Marker[]>([]);

  // Nexus Global Ranking State
  const { activeRanking, showRankedMarkers } = useAgentStore();

  // Unified Map State Machine (User requirements 2 & 10)
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);

  // Derived backward-compatible booleans for internal subcomponents
  const mapReady = mapStatus === 'ready';
  const mapLoading = mapStatus === 'loading';
  const mapError = (mapStatus === 'error' || mapStatus === 'timeout' || mapStatus === 'unavailable') ? (mapErrorMessage || 'Map unavailable') : null;
  const [googleServiceStatus, setGoogleServiceStatus] = useState<'AVAILABLE' | 'UNAVAILABLE_FOR_DEMO_KEY' | 'ERROR'>('AVAILABLE');
  const [placesStatus, setPlacesStatus] = useState<'AVAILABLE' | 'UNAVAILABLE_FOR_DEMO_KEY' | 'ERROR'>('AVAILABLE');
  const [streetViewStatus, setStreetViewStatus] = useState<'DISABLED' | 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR'>('AVAILABLE');
  const [streetViewError, setStreetViewError] = useState<{ code: string; message: string; source: 'streetview' } | null>(null);
  const lastStreetViewToastRef = useRef<number>(0);
  const [trafficLayerStatus, setTrafficLayerStatus] = useState<'AVAILABLE' | 'UNAVAILABLE_FOR_DEMO_KEY' | 'ERROR'>('AVAILABLE');

  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficReady, setTrafficReady] = useState(false);
  const [trafficError, setTrafficError] = useState(false);

  const [retryKey, setRetryKey] = useState(0);
  const initGenRef = useRef<number>(0);
  const lastRetryTimeRef = useRef<number>(0);
  const [retryCooldown, setRetryCooldown] = useState(false);
  const [loadSlow, setLoadSlow] = useState(false);

  // Synchronize internal mode with external prop changes
  useEffect(() => {
    if (mapMode) {
      setCurrentMode(mapMode.toUpperCase() as MapMode);
    }
  }, [mapMode]);


  // Synchronize TrafficLayer and AQI layers directly from props / layers state
  const isTrafficActive = trafficEnabled !== undefined ? trafficEnabled : (layers?.traffic ?? false);
  const isAqiActive = aqiEnabled !== undefined ? aqiEnabled : (layers?.aqi ?? false);

  // Clean event pass-through
  const filteredEvents = useMemo(() => events, [events]);

  // POI Selection state & race condition guard
  const [selectedPoi, setSelectedPoi] = useState<SelectedPlaceDetail | null>(null);
  const poiRequestIdRef = useRef<number>(0);
  const onSelectPoiRef = useRef(onSelectPoi);
  useEffect(() => {
    onSelectPoiRef.current = onSelectPoi;
  }, [onSelectPoi]);

  // Keep ref to onMapClick callback
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Compute map center (Never hardcode a city default)
  const mapCenter = useMemo(() => {
    if (center && (center.latitude !== 0 || center.longitude !== 0)) {
      return { lat: center.latitude, lng: center.longitude };
    }
    // Neutral global overview fallback when no location is selected yet
    return { lat: 20.0, lng: 0.0 };
  }, [center]);

  const zoom = useMemo(() => {
    if (zoomOverride !== undefined) return zoomOverride;
    if (!center || (center.latitude === 0 && center.longitude === 0)) {
      return 2; // Wide global view
    }
    return Math.max(5, Math.min(15, 12 - Math.log2(Math.max(radiusKm, 1) / 10)));
  }, [radiusKm, center, zoomOverride]);

  // Base Map Initialization: Google Maps -> render map immediately
  useEffect(() => {
    // 1. Unconditional 7-second hard watchdog timer: Guarantees map CAN NEVER stay in 'loading' forever!
    const watchdogTimer = setTimeout(() => {
      setMapStatus((prev) => {
        if (prev === 'loading') {
          console.warn('[UrbanPulse Map] 7-second watchdog timeout fired. Transitioning to timeout state.');
          setMapErrorMessage('Interactive map connection timed out. All location search, site analysis, weather, traffic, and intelligence systems remain fully active.');
          return 'timeout';
        }
        return prev;
      });
    }, 7000);

    if (!containerNode) {
      return () => clearTimeout(watchdogTimer);
    }
    const currentGen = ++initGenRef.current;

    // Timer to detect slow loading (> 2.5s)
    const slowTimer = setTimeout(() => {
      if (currentGen === initGenRef.current && mapStatus === 'loading') {
        setLoadSlow(true);
      }
    }, 2500);

    const initMap = async () => {
      setMapStatus('loading');
      setMapErrorMessage(null);
      setLoadSlow(false);
      console.log(`[UrbanPulse Map] MAP STATUS: LOADING (generation ${currentGen})`);

      try {
        // If map instance already exists, reuse it and mark ready immediately
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.setCenter(mapCenter);
            mapInstanceRef.current.setZoom(zoom);
            if (mapMode) {
              const typeMapping: Record<string, string> = {
                ROADMAP: 'roadmap',
                SATELLITE: 'satellite',
                HYBRID: 'hybrid',
                TERRAIN: 'terrain',
                '2D': 'roadmap',
              };
              mapInstanceRef.current.setMapTypeId(typeMapping[currentMode] || 'roadmap');
            }
          } catch (_) {}
          clearTimeout(watchdogTimer);
          clearTimeout(slowTimer);
          setMapStatus('ready');
          setMapErrorMessage(null);
          setGoogleServiceStatus('AVAILABLE');
          console.log('[UrbanPulse Map] MAP STATUS: READY (reused instance)');
          return;
        }

        // Non-blocking container size check (never freeze UI thread)
        if (containerNode.offsetWidth === 0 || containerNode.offsetHeight === 0) {
          console.log('[UrbanPulse Map] MAP CONTAINER: initial zero size, yielding brief frame tick');
          await new Promise((r) => setTimeout(r, 100));
          if (currentGen !== initGenRef.current) return;
        }

        console.log('[UrbanPulse Map] MAP LOADER: START');
        let MapClass: any = (window as any).google?.maps?.Map;

        if (!MapClass) {
          const mapsLib = await googleMapsLoader.loadMaps(apiKey);
          MapClass = mapsLib?.Map || (window as any).google?.maps?.Map;
        }

        if (currentGen !== initGenRef.current) return;

        if (!MapClass) {
          console.error('[UrbanPulse Map] MAP LOADER: ERROR - Map constructor missing');
          throw new Error('Google Maps Map constructor is not available.');
        }
        console.log('[UrbanPulse Map] MAP LOADER: READY');

        // Construct Map & Transition to READY
        if (!mapInstanceRef.current) {
          const typeMapping: Record<string, string> = {
            ROADMAP: 'roadmap',
            SATELLITE: 'satellite',
            HYBRID: 'hybrid',
            TERRAIN: 'terrain',
            '2D': 'roadmap',
          };
          const initialTypeId = typeMapping[currentMode] || 'roadmap';

          console.log('[UrbanPulse Map] MAP CONSTRUCTOR: START');
          const map = new MapClass(containerNode, {
            center: mapCenter,
            zoom,
            mapTypeId: initialTypeId,
            tilt: 0,
            heading: 0,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: true,
            streetViewControlOptions: {
              position: (window as any).google?.maps?.ControlPosition?.RIGHT_BOTTOM,
            },
            mapTypeControl: false,
            fullscreenControl: false,
            styles:
              initialTypeId === 'roadmap'
                ? [
                    {
                      featureType: 'transit.station',
                      elementType: 'labels.icon',
                      stylers: [{ visibility: 'off' }],
                    },
                  ]
                : undefined,
          });
          console.log('[UrbanPulse Map] MAP CONSTRUCTOR: SUCCESS');

          mapInstanceRef.current = map;
          if (typeof window !== 'undefined') {
            (window as any).__UP_GMAP_INSTANCE__ = map;
            (window as any).__UP_MAP_STATUS__ = 'ready';
            (window as any).__UP_STREET_VIEW_STATUS__ = streetViewStatus;
          }

          clearTimeout(watchdogTimer);
          clearTimeout(slowTimer);
          setMapStatus('ready');
          setMapErrorMessage(null);
          setGoogleServiceStatus('AVAILABLE');
          console.log('[UrbanPulse Map] MAP STATUS: READY');

          // Section 7, 18: Safe, passive tracking of native Pegman visibility (zero dynamic launch)
          try {
            const sv = map.getStreetView();
            if (sv) {
              sv.addListener('visible_changed', () => {
                const isVisible = Boolean(sv.getVisible?.());
                setStreetViewActive(isVisible);
              });
            }
          } catch (e) {
            console.warn('[GoogleMapView] Safe Pegman listener attach:', e);
          }

          // Track orientation changes
          map.addListener('tilt_changed', () => {
            setTilt(map.getTilt() || 0);
          });
          map.addListener('heading_changed', () => {
            setHeading(map.getHeading() || 0);
          });

          // Transition to EXPLORE mode when the user manually drags the map
          map.addListener('dragstart', () => {
            if (useLocationStore.getState().mapFollowMode === 'LOCKED_ON_USER') {
              useLocationStore.getState().setMapFollowMode('EXPLORE');
            }
          });

          // Map Click & Dedicated Google Maps POI Click Navigation Pipeline
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            // Pin Adjuster Mode: Clicking repositions the manual draft pin
            if (useLocationStore.getState().isAdjustingPin) {
              if (e.latLng) {
                useLocationStore.getState().updateDraftPinCoords({
                  latitude: e.latLng.lat(),
                  longitude: e.latLng.lng(),
                });
              }
              return;
            }

            // Choose on Map / Manual Selection Mode: Clicking places a draft pin for user confirmation
            const isSelectingMap =
              useLocationStore.getState().isSelectingMapLocation ||
              useLocationStore.getState().isChoosingOnMap;

            if (isSelectingMap) {
              const iconEvent = e as any;
              iconEvent.stop?.();
              if (e.latLng) {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                handleCoordinateSelectionRef.current?.(lat, lng, false);
              }
              return;
            }

            const iconEvent = e as any;
            if (iconEvent.placeId) {
              // POI detected on Google Maps!
              iconEvent.stop?.();
              const placeId = iconEvent.placeId;
              const fallbackLatLng = e.latLng;
              const currentRequestId = ++poiRequestIdRef.current;

              try {
                const placesLib = (window as any).google?.maps?.places;
                if (placesLib) {
                  const service = new placesLib.PlacesService(map);
                  service.getDetails(
                    {
                      placeId,
                      fields: [
                        'place_id',
                        'name',
                        'formatted_address',
                        'vicinity',
                        'geometry',
                        'photos',
                        'rating',
                        'user_ratings_total',
                        'types',
                        'url',
                        'utc_offset_minutes',
                        'website',
                        'formatted_phone_number',
                      ],
                    },
                    (place: any, status: any) => {
                      if (currentRequestId !== poiRequestIdRef.current) {
                        // Discard stale response from fast sequential clicks
                        return;
                      }

                      if (status === placesLib.PlacesServiceStatus.OK && place && place.geometry) {
                        const lat = place.geometry.location.lat();
                        const lng = place.geometry.location.lng();

                        // Viewport-based fitting when available, panTo + zoom 16 fallback
                        if (place.geometry.viewport) {
                          map.fitBounds(place.geometry.viewport);
                        } else {
                          map.panTo({ lat, lng });
                          map.setZoom(16);
                        }

                        // Maintain active traffic visualization
                        if (isTrafficActive && trafficManagerRef.current) {
                          trafficManagerRef.current.update(map, true);
                        }

                        const photos: string[] = [];
                        if (place.photos && Array.isArray(place.photos)) {
                          place.photos.slice(0, 5).forEach((p: any) => {
                            try {
                              const u = typeof p.getUrl === 'function'
                                ? p.getUrl({ maxWidth: 800, maxHeight: 600 })
                                : p;
                              if (u) photos.push(u);
                            } catch {}
                          });
                        }

                        const detail: SelectedPlaceDetail = {
                          placeId: place.place_id || placeId,
                          name: place.name || 'Selected Place',
                          address: place.formatted_address || place.vicinity || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                          latitude: lat,
                          longitude: lng,
                          rating: place.rating,
                          userRatingsTotal: place.user_ratings_total,
                          photos,
                          types: place.types || [],
                          googleUrl: place.url,
                          utcOffsetMinutes: place.utc_offset_minutes,
                          website: place.website,
                          formattedPhoneNumber: place.formatted_phone_number,
                          viewport: place.geometry.viewport,
                        };

                        setSelectedPoi(detail);
                        onSelectPoiRef.current?.(detail);
                        return;
                      }

                      // Fallback if Place details rate limited
                      if (fallbackLatLng) {
                        const lat = fallbackLatLng.lat();
                        const lng = fallbackLatLng.lng();
                        map.panTo({ lat, lng });
                        onMapClickRef.current?.({ latitude: lat, longitude: lng });
                      }
                    }
                  );
                  return;
                }
              } catch (err) {
                console.warn('[GoogleMapView] POI PlacesService error:', err);
              }
            }

            // Normal coordinate map click
            setSelectedPoi(null);
            if (e.latLng) {
              const clickedLat = e.latLng.lat();
              const clickedLng = e.latLng.lng();

              if (onMapClickRef.current) {
                onMapClickRef.current({
                  latitude: clickedLat,
                  longitude: clickedLng,
                });
              }
            }
          });

        }
      } catch (err: any) {
        clearTimeout(watchdogTimer);
        clearTimeout(slowTimer);
        if (currentGen !== initGenRef.current) return;
        console.error('[UrbanPulse Map] MAP STATUS: ERROR - initialization failed:', err);
        const isTimeout =
          err?.name === 'MapsTimeoutError' ||
          err?.message?.includes('timeout') ||
          err?.message?.includes('Timed out');
        setMapStatus(isTimeout ? 'timeout' : 'error');
        setMapErrorMessage(
          err?.message || 'Google Maps could not be initialized.'
        );
        setGoogleServiceStatus('ERROR');
      }
    };

    initMap();

    return () => {
      clearTimeout(watchdogTimer);
      clearTimeout(slowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerNode, apiKey, retryKey]);

  // Handle container resizing (e.g. Map Expansion toggle or window resize) without reinitializing map
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || !containerNode) return;

    const triggerResize = () => {
      if (mapInstanceRef.current && (window as any).google?.maps?.event) {
        (window as any).google.maps.event.trigger(mapInstanceRef.current, 'resize');
      }
    };

    window.addEventListener('resize', triggerResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        triggerResize();
      });
      ro.observe(containerNode);
    }

    return () => {
      window.removeEventListener('resize', triggerResize);
      ro?.disconnect();
    };
  }, [containerNode, mapReady]);

  // Update map center/zoom and mode on prop changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    map.setCenter(mapCenter);
    map.setZoom(zoom);

    const typeMapping: Record<string, string> = {
      '2D': 'roadmap',
      ROADMAP: 'roadmap',
      SATELLITE: 'satellite',
      HYBRID: 'hybrid',
      TERRAIN: 'terrain',
    };
    const targetType = typeMapping[currentMode] || 'roadmap';
    map.setMapTypeId(targetType);

    try {
      if (typeof map.moveCamera === 'function') {
        map.moveCamera({ tilt: 0, heading: 0 });
      } else {
        map.setTilt?.(0);
        map.setHeading?.(0);
      }
    } catch (e) {}
  }, [mapCenter, zoom, currentMode, mapReady, heading]);

  // Mode Change Handler
  const handleModeChange = useCallback(
    (newMode: MapMode) => {
      setCurrentMode(newMode);
      onModeChange?.(newMode);
      const map = mapInstanceRef.current;
      if (!map) return;

      try {
        if (typeof map.moveCamera === 'function') {
          map.moveCamera({ tilt: 0, heading: 0 });
        } else {
          map.setTilt?.(0);
          map.setHeading?.(0);
        }
      } catch (e) {}

      const typeMapping: Record<string, string> = {
        '2D': 'roadmap',
        ROADMAP: 'roadmap',
        SATELLITE: 'satellite',
        HYBRID: 'hybrid',
        TERRAIN: 'terrain',
      };
      map.setMapTypeId(typeMapping[newMode] || 'roadmap');
    },
    [onModeChange]
  );

  // Reset North Handler
  const handleResetNorth = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (typeof map.moveCamera === 'function') {
      map.moveCamera({ heading: 0, tilt: 0 });
    } else {
      map.setHeading?.(0);
    }
    setHeading(0);
  }, []);

  // Native Street View Notification & Non-Blocking Safe Delegation Handler
  const handleToggleStreetView = useCallback(
    (_locOverride?: { latitude: number; longitude: number; name?: string }) => {
      const now = Date.now();
      // Section 57: Debounce repeated clicks to prevent toast spam
      if (now - lastStreetViewToastRef.current < 2500) return;
      lastStreetViewToastRef.current = now;

      // Section 10, 56: Truthful non-blocking status notice (zero dynamic launch)
      if (streetViewStatus === 'DISABLED') {
        setStreetViewNotice('Street View disabled in this prototype configuration.');
      } else if (streetViewStatus === 'UNAVAILABLE' || streetViewStatus === 'ERROR') {
        setStreetViewNotice('Street View is unavailable in this configuration.');
      } else {
        setStreetViewNotice('Street View is available via Google\'s Pegman control on the map.');
      }
      setTimeout(() => setStreetViewNotice(null), 3500);
    },
    [streetViewStatus]
  );

  // 2D Planar Mode Camera Leveling & Tilt Reset
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    if (map && currentMode === '2D') {
      try {
        if (typeof map.moveCamera === 'function') {
          map.moveCamera({ tilt: 0, heading: 0 });
        } else {
          map.setTilt?.(0);
          map.setHeading?.(0);
        }
      } catch (e) {}
    }
  }, [currentMode, mapReady]);


  // Independent TrafficLayer Initialization via dedicated GoogleTrafficLayerManager
  // (Failure NEVER breaks base map)
  useEffect(() => {
    if (!trafficManagerRef.current) {
      trafficManagerRef.current = new GoogleTrafficLayerManager((status) => {
        setTrafficLoading(status.isLoading);
        setTrafficReady(status.isReady);
        setTrafficError(status.isError);
        setTrafficLayerStatus(status.isError ? 'UNAVAILABLE_FOR_DEMO_KEY' : status.isReady ? 'AVAILABLE' : 'AVAILABLE');
      });
    }

    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    trafficManagerRef.current.update(map, isTrafficActive);
  }, [isTrafficActive, mapMode, mapReady]);

  // Radial Boundary Circle Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (layers?.boundary !== false) {
      const renderCircle = (CircleClass: any) => {
        if (!CircleClass) return;
        if (!circleRef.current) {
          circleRef.current = new CircleClass({
            map,
            center: mapCenter,
            radius: radiusKm * 1000,
            fillColor: '#2563EB',
            fillOpacity: 0.04,
            strokeColor: '#2563EB',
            strokeOpacity: 0.6,
            strokeWeight: 1.5,
          });
        } else {
          circleRef.current.setCenter(mapCenter);
          circleRef.current.setRadius(radiusKm * 1000);
          circleRef.current.setMap(map);
        }
      };

      const existingCircle = (window as any).google?.maps?.Circle;
      if (existingCircle) {
        renderCircle(existingCircle);
      }
    } else {
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
    }
  }, [mapReady, mapCenter, radiusKm, layers?.boundary]);



  // UrbanPulse Event Markers Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // Clear previous markers
    markersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch (e) {}
    });
    markersRef.current = [];

    const renderMarkers = (MarkerClass: any) => {
      if (!MarkerClass) return;

      filteredEvents.forEach((ev) => {
        let markerColor = ev.severity >= 75 ? '#EF4444' : ev.severity >= 55 ? '#F59E0B' : '#10B981';
        let strokeColor = '#FFFFFF';

        if (ev.eventType === 'POTHOLE' || ev.eventType === 'ROAD_CLOSURE') {
          markerColor = '#EA580C';
        } else if (ev.eventType === 'POLICE_INCIDENT') {
          markerColor = '#2563EB';
          strokeColor = '#DBEAFE';
        } else if (ev.eventType === 'EARTHQUAKE') {
          markerColor = '#DC2626';
        }

        const marker = new MarkerClass({
          map,
          position: { lat: ev.latitude, lng: ev.longitude },
          title: `[${ev.eventType}] ${ev.title}`,
          icon: {
            path: (window as any).google?.maps?.SymbolPath?.CIRCLE || 0,
            scale: ev.severity >= 75 ? 9 : ev.severity >= 55 ? 7 : 5,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: strokeColor,
          },
        });

        marker.addListener('click', () => {
          onSelectEvent?.(ev);
        });

        markersRef.current.push(marker);
      });
    };

    const existingMarker = (window as any).google?.maps?.Marker;
    if (existingMarker) {
      renderMarkers(existingMarker);
    }
  }, [mapReady, filteredEvents, onSelectEvent]);

  // Nexus Global Ranking Pin Overlay: Clean numbered badges (#1, #2, #3...) only when explicitly requested
  useEffect(() => {
    const map = mapInstanceRef.current;

    // Always clear previous ranked markers
    rankedMarkersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch (_) {}
    });
    rankedMarkersRef.current = [];

    if (!map || !mapReady || !showRankedMarkers || !activeRanking?.results || activeRanking.results.length === 0) {
      return;
    }

    const MarkerClass = (window as any).google?.maps?.Marker;
    if (!MarkerClass) return;

    const bounds = new (window as any).google.maps.LatLngBounds();

    activeRanking.results.forEach((item: any) => {
      if (!item.geography || typeof item.geography.lat !== 'number' || typeof item.geography.lon !== 'number') {
        return;
      }
      const pos = { lat: item.geography.lat, lng: item.geography.lon };
      bounds.extend(pos);

      // Clean, modern SVG numbered badge marker - zero heat blobs
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
          <path d="M19 0C8.5 0 0 8.5 0 19C0 30.5 19 46 19 46C19 46 38 30.5 38 19C38 8.5 29.5 0 19 0Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
          <circle cx="19" cy="19" r="14" fill="#1e293b"/>
          <text x="19" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">#${item.rank}</text>
        </svg>
      `;
      const iconUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim());

      const marker = new MarkerClass({
        position: pos,
        map: map,
        title: `#${item.rank} ${item.name} (${item.value} ${item.unit})`,
        icon: {
          url: iconUrl,
          scaledSize: new (window as any).google.maps.Size(38, 46),
          anchor: new (window as any).google.maps.Point(19, 46),
        },
        zIndex: 1000 - item.rank,
      });

      const infoWindow = new (window as any).google.maps.InfoWindow({
        content: `
          <div style="font-family: system-ui, sans-serif; padding: 6px 10px; color: #0f172a; min-width: 160px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">#${item.rank} ${item.name}</div>
            <div style="font-size: 13px; color: #0284c7; font-weight: 600;">${item.value} ${item.unit} (${item.category})</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Source: ${item.source}</div>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      rankedMarkersRef.current.push(marker);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }

    return () => {
      rankedMarkersRef.current.forEach((m) => {
        try {
          m.setMap(null);
        } catch (_) {}
      });
      rankedMarkersRef.current = [];
    };
  }, [mapReady, showRankedMarkers, activeRanking]);

  // User GPS Location Marker & Precise Accuracy Radius Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // Determine device coordinates (prioritize authoritative currentDeviceLocation)
    const devLat = currentDeviceLocation?.latitude ?? (center?.isUserLocation ? center.latitude : null);
    const devLon = currentDeviceLocation?.longitude ?? (center?.isUserLocation ? center.longitude : null);
    const accuracyRadius = Math.max(Number(currentDeviceLocation?.accuracyMeters ?? center?.accuracy ?? 15), 5); // meters

    if (devLat !== null && devLon !== null) {
      const userPos = { lat: devLat, lng: devLon };

      const renderUserLocation = (MarkerClass: any) => {
        if (!MarkerClass) return;

        // Render / update modern 2026 clean user beacon pin (clean point marker pin only, no accuracy circle or halo)
        if (!userLocationMarkerRef.current) {
          userLocationMarkerRef.current = new MarkerClass({
            map,
            position: userPos,
            title: `Your Device Location (±${Math.round(accuracyRadius)}m)`,
            zIndex: 100,
            icon: {
              path: (window as any).google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 7,
              fillColor: '#2563EB',
              fillOpacity: 1,
              strokeWeight: 2.5,
              strokeColor: '#FFFFFF',
            },
          });
        } else {
          userLocationMarkerRef.current.setPosition(userPos);
          userLocationMarkerRef.current.setTitle(`Your Device Location (±${Math.round(accuracyRadius)}m)`);
          userLocationMarkerRef.current.setMap(map);
        }
        if (typeof window !== 'undefined') {
          (window as any).__UP_USER_MARKER__ = userLocationMarkerRef.current;
        }
      };

      const gMaps = (window as any).google?.maps;
      if (gMaps?.Marker) {
        renderUserLocation(gMaps.Marker);
      }
    } else {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
      }
      if (typeof window !== 'undefined') {
        (window as any).__UP_USER_MARKER__ = null;
      }
    }
  }, [mapReady, center, currentDeviceLocation]);

  // Manual Draft Pin Marker during Pin Adjustment Mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (isAdjustingPin && manualDraftCoords) {
      const draftPos = { lat: manualDraftCoords.latitude, lng: manualDraftCoords.longitude };
      const MarkerClass = (window as any).google?.maps?.Marker;
      if (!MarkerClass) return;

      if (!draftPinMarkerRef.current) {
        const marker = new MarkerClass({
          map,
          position: draftPos,
          draggable: true,
          title: 'Drag to adjust your exact location',
          animation: (window as any).google?.maps?.Animation?.DROP,
          zIndex: 200,
        });

        marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            updateDraftPinCoords({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
          }
        });

        draftPinMarkerRef.current = marker;
      } else {
        draftPinMarkerRef.current.setPosition(draftPos);
        draftPinMarkerRef.current.setMap(map);
      }
    } else {
      if (draftPinMarkerRef.current) {
        draftPinMarkerRef.current.setMap(null);
        draftPinMarkerRef.current = null;
      }
    }
  }, [isAdjustingPin, manualDraftCoords, mapReady, updateDraftPinCoords]);

  // Distinct Searched Location Pin Marker (Sections 85, 86, 90)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const searchTarget = selectedLocation || (center && !center.isUserLocation && activeLocationMode !== 'DEVICE' ? center : null);

    if (searchTarget && searchTarget.latitude && searchTarget.longitude) {
      const pos = { lat: searchTarget.latitude, lng: searchTarget.longitude };
      const MarkerClass = (window as any).google?.maps?.Marker;
      if (!MarkerClass) return;

      if (!searchedLocationMarkerRef.current) {
        const marker = new MarkerClass({
          map,
          position: pos,
          title: searchTarget.displayName || 'Searched Location',
          draggable: false,
          zIndex: 110,
        });

        searchedLocationMarkerRef.current = marker;
      } else {
        searchedLocationMarkerRef.current.setPosition(pos);
        searchedLocationMarkerRef.current.setTitle(searchTarget.displayName || 'Searched Location');
        searchedLocationMarkerRef.current.setMap(map);
      }
    } else {
      if (searchedLocationMarkerRef.current) {
        searchedLocationMarkerRef.current.setMap(null);
        searchedLocationMarkerRef.current = null;
      }
    }
  }, [selectedLocation, center, activeLocationMode, mapReady]);

  // Dedicated Manual Location Draft Marker (Section 10, 19)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (mapClickDraft && isSelectingMapLocation) {
      const pos = { lat: mapClickDraft.latitude, lng: mapClickDraft.longitude };
      const gMaps = (window as any).google?.maps;
      if (!gMaps?.Marker) return;

      const markerTitle = mapClickDraft.isAdjusted
        ? `Adjusted Location (${mapClickDraft.latitude.toFixed(4)}, ${mapClickDraft.longitude.toFixed(4)})`
        : `Selected Location (${mapClickDraft.latitude.toFixed(4)}, ${mapClickDraft.longitude.toFixed(4)})`;

      if (!draftPinMarkerRef.current) {
        // High-visibility custom SVG pin marker for manual location
        const pinSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.35"/>
              </filter>
            </defs>
            <path d="M18 0 C8.06 0 0 8.06 0 18 C0 31.5 18 48 18 48 C18 48 36 31.5 36 18 C36 8.06 27.94 0 18 0 Z" fill="#2563EB" filter="url(#shadow)"/>
            <circle cx="18" cy="18" r="7" fill="#FFFFFF"/>
            <circle cx="18" cy="18" r="3.5" fill="#1E40AF"/>
          </svg>
        `)}`;

        const marker = new gMaps.Marker({
          map,
          position: pos,
          title: markerTitle,
          draggable: true,
          animation: gMaps.Animation.DROP,
          zIndex: 250,
          icon: {
            url: pinSvg,
            scaledSize: new gMaps.Size(36, 48),
            anchor: new gMaps.Point(18, 48),
          },
        });

        // Listen for dragend event to allow user to adjust pin
        marker.addListener('dragend', (evt: google.maps.MapMouseEvent) => {
          if (evt.latLng) {
            const newLat = evt.latLng.lat();
            const newLng = evt.latLng.lng();
            handleCoordinateSelectionRef.current?.(newLat, newLng, true);
          }
        });

        draftPinMarkerRef.current = marker;
      } else {
        draftPinMarkerRef.current.setPosition(pos);
        draftPinMarkerRef.current.setTitle(markerTitle);
        draftPinMarkerRef.current.setDraggable(true);
        draftPinMarkerRef.current.setMap(map);
      }
    } else if (!isAdjustingPin && draftPinMarkerRef.current) {
      draftPinMarkerRef.current.setMap(null);
      draftPinMarkerRef.current = null;
    }
  }, [mapClickDraft, isSelectingMapLocation, isAdjustingPin, mapReady]);

  // Map Cursor adjustment during Manual Map Selection mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setOptions({
      draggableCursor: isSelectingMapLocation ? 'crosshair' : null,
    });
  }, [isSelectingMapLocation]);

  // Candidate Route Polylines and Route Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // Clear previous polylines & route markers
    polylinesRef.current.forEach((p) => {
      try {
        p.setMap(null);
      } catch (e) {}
    });
    polylinesRef.current = [];
    routeMarkersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch (e) {}
    });
    routeMarkersRef.current = [];

    const candidateList = routes && routes.length > 0 ? routes : activeRoute ? [activeRoute] : [];
    if (candidateList.length === 0) return;

    const renderRoutes = (PolylineClass: any, MarkerClass: any) => {
      if (!PolylineClass) return;

      const activeRouteId = activeRoute?.id || candidateList[0]?.id;

      // Draw alternate routes
      candidateList
        .filter((r) => r.id !== activeRouteId)
        .forEach((r) => {
          const poly = new PolylineClass({
            map,
            path: r.polyline.map((p) => ({ lat: p.latitude, lng: p.longitude })),
            strokeColor: '#94A3B8',
            strokeOpacity: 0.65,
            strokeWeight: 4.5,
            zIndex: 4,
          });
          poly.addListener('click', () => onSelectRoute?.(r));
          polylinesRef.current.push(poly);
        });

      // Draw active route
      const active = candidateList.find((r) => r.id === activeRouteId);
      if (active && active.polyline.length > 0) {
        // Base route polyline
        const activePoly = new PolylineClass({
          map,
          path: active.polyline.map((p) => ({ lat: p.latitude, lng: p.longitude })),
          strokeColor: '#367FF2',
          strokeOpacity: 0.88,
          strokeWeight: 5.5,
          zIndex: 8,
        });
        polylinesRef.current.push(activePoly);

        // When traffic-aware polyline info is supported and returned, render actual traffic speed intervals from Google
        if (active.speedReadingIntervals && active.speedReadingIntervals.length > 0) {
          active.speedReadingIntervals.forEach((interval) => {
            const start = interval.startPolylinePointIndex ?? 0;
            const end = interval.endPolylinePointIndex ?? 0;
            if (end > start && start < active.polyline.length) {
              const segmentPoints = active.polyline.slice(start, end + 1);
              if (segmentPoints.length > 1) {
                let segmentColor = '#3B82F6'; // NORMAL
                if (interval.speed === 'TRAFFIC_JAM') {
                  segmentColor = '#DC2626'; // Severe Jam
                } else if (interval.speed === 'SLOW') {
                  segmentColor = '#F59E0B'; // Moderate Slowdown
                }

                const segmentPoly = new PolylineClass({
                  map,
                  path: segmentPoints.map((p) => ({ lat: p.latitude, lng: p.longitude })),
                  strokeColor: segmentColor,
                  strokeOpacity: 0.95,
                  strokeWeight: 6.0,
                  zIndex: 9,
                });
                polylinesRef.current.push(segmentPoly);
              }
            }
          });
        }

        // Frame corridor seamlessly within map viewport
        try {
          const LatLngBoundsClass = (window as any).google?.maps?.LatLngBounds;
          if (LatLngBoundsClass) {
            const bounds = new LatLngBoundsClass();
            active.polyline.forEach((pt) => {
              bounds.extend({ lat: pt.latitude, lng: pt.longitude });
            });
            map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
          }
        } catch {}

        // Add origin & destination pins if MarkerClass available
        if (MarkerClass) {
          const originMarker = new MarkerClass({
            map,
            position: {
              lat: active.polyline[0].latitude,
              lng: active.polyline[0].longitude,
            },
            title: 'Origin',
            icon: {
              path: (window as any).google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 7,
              fillColor: '#2563EB',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#FFFFFF',
            },
          });

          const destMarker = new MarkerClass({
            map,
            position: {
              lat: active.polyline[active.polyline.length - 1].latitude,
              lng: active.polyline[active.polyline.length - 1].longitude,
            },
            title: 'Destination',
            icon: {
              path: (window as any).google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 7,
              fillColor: '#EF4444',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#FFFFFF',
            },
          });

          routeMarkersRef.current.push(originMarker, destMarker);
        }
      }
    };

    const existingPolyline = (window as any).google?.maps?.Polyline;
    const existingMarker = (window as any).google?.maps?.Marker;
    if (existingPolyline && existingMarker) {
      renderRoutes(existingPolyline, existingMarker);
    }
  }, [mapReady, routes, activeRoute, onSelectRoute]);

  // Clean cleanup on component unmount
  useEffect(() => {
    return () => {
      if (trafficManagerRef.current) {
        try {
          trafficManagerRef.current.destroy();
        } catch (e) {}
        trafficManagerRef.current = null;
      }
      if (circleRef.current) {
        try {
          circleRef.current.setMap(null);
        } catch (e) {}
        circleRef.current = null;
      }

      markersRef.current.forEach((m) => {
        try {
          m.setMap(null);
        } catch (e) {}
      });
      markersRef.current = [];
      polylinesRef.current.forEach((p) => {
        try {
          p.setMap(null);
        } catch (e) {}
      });
      polylinesRef.current = [];
      routeMarkersRef.current.forEach((m) => {
        try {
          m.setMap(null);
        } catch (e) {}
      });
      routeMarkersRef.current = [];
      mapInstanceRef.current = null;
    };
  }, []);

  const handleRetry = () => {
    const now = Date.now();
    if (now - lastRetryTimeRef.current < 1500) return;
    lastRetryTimeRef.current = now;
    setRetryCooldown(true);
    setTimeout(() => setRetryCooldown(false), 1500);

    setMapStatus('loading');
    setMapErrorMessage(null);
    googleMapsLoader.retry(apiKey).catch((e) => {
      const isTimeout =
        e?.name === 'MapsTimeoutError' ||
        e?.message?.includes('timeout') ||
        e?.message?.includes('Timed out');
      setMapStatus(isTimeout ? 'timeout' : 'error');
      setMapErrorMessage(e?.message || 'Failed to reconnect Google Maps.');
    });
    setRetryKey((k) => k + 1);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: height ?? '100%', overflow: 'hidden' }}>
      {/* Real Google Maps Container DOM element */}
      <div
        ref={containerCallbackRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#EEF2F6',
          display: 'block',
        }}
      />

      {/* Loading overlay: Clean light-mode high-tech radar pulse */}
      {mapStatus === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            color: 'var(--text-secondary, #64748B)',
            fontSize: '13px',
            fontWeight: 600,
            gap: '12px',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid var(--accent-primary, #2563EB)',
                opacity: 0.25,
                animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
              }}
            />
            <span
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid var(--accent-primary, #2563EB)',
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
          <span>Loading map canvas...</span>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
            Workspace and location intelligence remain fully accessible
          </span>
          {loadSlow && (
            <button
              onClick={handleRetry}
              disabled={retryCooldown}
              style={{
                marginTop: '4px',
                padding: '4px 10px',
                background: 'transparent',
                border: '1px solid var(--border-subtle, #CBD5E1)',
                borderRadius: '4px',
                color: 'var(--text-secondary, #64748B)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: retryCooldown ? 'not-allowed' : 'pointer',
              }}
            >
              Taking longer than expected? Retry connection
            </button>
          )}
        </div>
      )}

      {/* Terminal Failure / Timeout / Offline Fallback Card */}
      {(mapStatus === 'error' || mapStatus === 'timeout' || mapStatus === 'unavailable') && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 15,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            padding: '24px',
            textAlign: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: mapStatus === 'timeout' ? '#FEF3C7' : '#FEE2E2',
              color: mapStatus === 'timeout' ? '#B45309' : '#DC2626',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: mapStatus === 'timeout' ? '#D97706' : '#EF4444',
              }}
            />
            {mapStatus === 'timeout' ? 'Connection Timeout' : 'Map Temporarily Unavailable'}
          </div>

          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
            {mapStatus === 'timeout' ? 'Interactive Map Connection Timed Out' : 'Interactive Map Offline'}
          </div>

          <div style={{ fontSize: '12px', color: '#64748B', maxWidth: '460px', lineHeight: 1.5 }}>
            {mapErrorMessage || 'The map canvas could not be loaded. Location search, site analysis, weather, traffic layers, coordinates, and RAG modules remain fully operational.'}
          </div>

          {selectedLocation && (
            <div
              style={{
                fontSize: '11px',
                color: '#475569',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                padding: '6px 12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600 }}>Active Target: {selectedLocation.displayName || selectedLocation.city || 'Selected Site'}</span>
              <span style={{ color: '#94A3B8' }}>
                {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              onClick={handleRetry}
              disabled={retryCooldown}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm, 6px)',
                backgroundColor: retryCooldown ? '#94A3B8' : 'var(--accent-primary, #2563EB)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: retryCooldown ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {retryCooldown ? 'Retrying…' : 'Retry Connection'}
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && (
            <div
              style={{
                marginTop: '10px',
                fontSize: '10px',
                fontFamily: 'monospace',
                color: '#64748B',
                background: '#F1F5F9',
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #E2E8F0',
                maxWidth: '90%',
                wordBreak: 'break-all',
              }}
            >
              MAP STATUS: {mapStatus} | LOADER: {googleMapsLoader.getStatus()} | KEY: {apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'CONFIGURED' : 'MISSING'} | CONTAINER: {containerNode ? `${containerNode.offsetWidth}x${containerNode.offsetHeight}` : 'NULL'} | INSTANCE: {mapInstanceRef.current ? 'CREATED' : 'NOT CREATED'}
            </div>
          )}
        </div>
      )}

      {/* Dedicated Map Location Selection & Confirmation Overlay (Sections 11, 35) */}
      <SubsystemErrorBoundary name="MapLocationPicker" silent>
        <MapLocationPicker />
      </SubsystemErrorBoundary>

      {/* Floating Map-Native Modern Status Badge */}
      {showStatusBadge && (
        <SubsystemErrorBoundary name="ModernLocationStatusBadge" silent>
          <ModernLocationStatusBadge />
        </SubsystemErrorBoundary>
      )}

      {/* Research Mode Workbench (Non-Causal Multimodal Spatial Intelligence) */}
      <SubsystemErrorBoundary name="ResearchModePanel" silent>
        <ResearchModePanel />
      </SubsystemErrorBoundary>

      {/* Map Mode Controls Bar (Top-Right Zone 1) */}
      <SubsystemErrorBoundary name="MapControlBar" silent>
        <MapControlBar
          mode={currentMode}
          onModeChange={handleModeChange}
          streetViewActive={streetViewActive}
          tilt={tilt}
          heading={heading}
          onResetNorth={handleResetNorth}
          isStreetViewAvailable={streetViewStatus === 'AVAILABLE'}
          style={{ top: '16px', right: '16px' }}
        />
      </SubsystemErrorBoundary>

      {/* Compact Location HUD */}
      {mapReady && showLocationHud && center && (
        <SubsystemErrorBoundary name="MapLocationHUD" silent>
          <MapLocationHUD
            location={center}
            weather={weatherData}
            aqi={isAqiActive && aqiData ? { value: aqiData.value, category: aqiData.category } : null}
            trafficSummary={isTrafficActive && trafficReady ? 'Live Traffic Active' : null}
            confidence={0.88}
            radiusKm={radiusKm}
          />
        </SubsystemErrorBoundary>
      )}

      {/* Dynamic Map Legend & Top Hotspots (Bottom-Right Stack) */}
      {mapReady && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '16px',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column-reverse',
            alignItems: 'flex-end',
            gap: '10px',
            pointerEvents: 'none',
            maxWidth: '380px',
          }}
        >
          {showLegend && (
            <div style={{ pointerEvents: 'auto' }}>
              <SubsystemErrorBoundary name="MapLegend" silent>
                <MapLegend
                  activeFilter={activeFilter}
                  isTrafficActive={isTrafficActive}
                  isRiskActive={layers?.risk || (riskZones && riskZones.length > 0)}
                />
              </SubsystemErrorBoundary>
            </div>
          )}
        </div>
      )}

      {/* Non-Blocking Street View Availability Notice (Requirement 34) */}
      {streetViewNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            color: '#F8FAFC',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            borderRadius: '24px',
            padding: '8px 18px',
            fontSize: '12.5px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#F59E0B',
            }}
          />
          <span>{streetViewNotice}</span>
        </div>
      )}

      {/* Selected Google Maps POI / Place Details Card */}
      {selectedPoi && (
        <SubsystemErrorBoundary name="PlaceDetailCard" silent>
          <PlaceDetailCard
            place={selectedPoi}
            onClose={() => setSelectedPoi(null)}
            onAskAgent={(p) => onAskAgentPoi?.(p)}
            onExploreTraffic={(p) => {
              mapInstanceRef.current?.panTo({ lat: p.latitude, lng: p.longitude });
              mapInstanceRef.current?.setZoom(16);
              if (trafficManagerRef.current) {
                trafficManagerRef.current.update(mapInstanceRef.current, true);
              }
            }}
            onNearbyActivities={(p) => onNearbyActivitiesPoi?.(p)}
            onStreetView={(p) =>
              handleToggleStreetView({ latitude: p.latitude, longitude: p.longitude, name: p.name })
            }
          />
        </SubsystemErrorBoundary>
      )}
    </div>
  );
}

export default function GoogleMapView(props: GoogleMapViewProps) {
  return (
    <GoogleMapErrorBoundary onRetry={() => googleMapsLoader.retry()}>
      <GoogleMapViewInner {...props} />
    </GoogleMapErrorBoundary>
  );
}
