'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ResolvedLocation, UnifiedCityEvent, CandidateRoute, MapMode, SpatialRiskZone } from '@shared/types';
import { GoogleTrafficLayerManager } from './traffic/GoogleTrafficLayer';
import PlaceDetailCard, { SelectedPlaceDetail } from './PlaceDetailCard';
import MapControlBar from './MapControlBar';
import MapLocationHUD from './MapLocationHUD';
import MapLegend from './MapLegend';
import StreetViewPanel from './StreetViewPanel';
import { UrbanPulse3DOverlay } from './three/UrbanPulse3DOverlay';

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
}

import { googleMapsLoader } from '@/services/googleMapsLoader';
import { GoogleMapErrorBoundary } from '@/components/common/ErrorBoundary';
import { useLocationStore } from '@/stores/useLocationStore';
import ModernLocationStatusBadge from './ModernLocationStatusBadge';

const DEFAULT_MAPS_KEY = 'AIzaSyDU2vkyVUnqI5lYUOz8aYrKO6mnYtWVSTg';


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
}: GoogleMapViewProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    (typeof window !== 'undefined' && (window as any).__UP_GMAPS_KEY ? (window as any).__UP_GMAPS_KEY : DEFAULT_MAPS_KEY);

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
  const setIsChoosingOnMap = useLocationStore((s) => s.setIsChoosingOnMap);
  const setManualMapLocation = useLocationStore((s) => s.setManualMapLocation);
  const setSelectedSearchLocation = useLocationStore((s) => s.setSelectedSearchLocation);
  const isHeatmapActive = useLocationStore((s) => s.isHeatmapActive);
  const isAdjustingPin = useLocationStore((s) => s.isAdjustingPin);
  const manualDraftCoords = useLocationStore((s) => s.manualDraftCoords);
  const updateDraftPinCoords = useLocationStore((s) => s.updateDraftPinCoords);

  const [chooseOnMapDraft, setChooseOnMapDraft] = useState<{ latitude: number; longitude: number } | null>(null);

  // Street View State
  const [streetViewActive, setStreetViewActive] = useState<boolean>(false);
  const [streetViewLocation, setStreetViewLocation] = useState<{ latitude: number; longitude: number; name?: string } | null>(null);

  // 3D WebGL Overlay Ref
  const overlay3DRef = useRef<UrbanPulse3DOverlay | null>(null);

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
  const aqiCircleRef = useRef<google.maps.Circle | null>(null);
  const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const userAccuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const searchedLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const draftPinMarkerRef = useRef<google.maps.Marker | null>(null);
  const heatmapLayerRef = useRef<any>(null);
  const heatmapFallbackCirclesRef = useRef<google.maps.Circle[]>([]);
  const currentAccuracyRadiusRef = useRef<number>(15);
  const haloAnimFrameRef = useRef<number | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const routeMarkersRef = useRef<google.maps.Marker[]>([]);

  // Explicit lifecycle states
  const [mapLoading, setMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficReady, setTrafficReady] = useState(false);
  const [trafficError, setTrafficError] = useState(false);

  const [retryKey, setRetryKey] = useState(0);

  // Synchronize internal mode with external prop changes
  useEffect(() => {
    if (mapMode) {
      setCurrentMode(mapMode.toUpperCase() as MapMode);
    }
  }, [mapMode]);


  // Determine trafficEnabled state from prop or layers object (defaults to true)
  const isTrafficActive = trafficEnabled !== undefined ? trafficEnabled : (layers?.traffic ?? true);
  const isAqiActive = aqiEnabled !== undefined ? aqiEnabled : (layers?.aqi ?? false);

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
    if (!containerNode) return;
    let isCancelled = false;

    const initMap = async () => {
      setMapLoading(true);
      setMapError(null);
      console.log('[UrbanPulse Map] Google Maps initializing');

      try {
        let MapClass: any = (window as any).google?.maps?.Map;

        if (!MapClass) {
          const mapsLib = await googleMapsLoader.loadMaps(apiKey);
          MapClass = mapsLib?.Map || (window as any).google?.maps?.Map;
        }

        if (isCancelled) return;

        if (!MapClass) {
          throw new Error('Google Maps Map constructor is not available.');
        }

        // If map instance does not exist yet, create it against the mounted container
        if (!mapInstanceRef.current) {
          const isInitial3D = currentMode === '3D';
          const typeMapping: Record<string, string> = {
            ROADMAP: 'roadmap',
            SATELLITE: 'satellite',
            HYBRID: 'hybrid',
            TERRAIN: 'terrain',
            '3D': 'roadmap',
          };
          const initialTypeId = typeMapping[currentMode] || 'roadmap';

          const map = new MapClass(containerNode, {
            center: mapCenter,
            zoom,
            mapTypeId: initialTypeId,
            tilt: isInitial3D ? 45 : 0,
            heading: isInitial3D ? 25 : 0,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
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

            // Choose on Map Mode: Clicking places a draft pin for user confirmation
            if (useLocationStore.getState().isChoosingOnMap) {
              if (e.latLng) {
                setChooseOnMapDraft({
                  latitude: e.latLng.lat(),
                  longitude: e.latLng.lng(),
                });
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
            if (e.latLng && onMapClickRef.current) {
              onMapClickRef.current({
                latitude: e.latLng.lat(),
                longitude: e.latLng.lng(),
              });
            }
          });

          mapInstanceRef.current = map;
          console.log('[UrbanPulse Map] map created');
        } else {
          mapInstanceRef.current.setCenter(mapCenter);
          mapInstanceRef.current.setZoom(zoom);
          mapInstanceRef.current.setMapTypeId(mapMode);
        }

        setMapReady(true);
        setMapLoading(false);
        setMapError(null);
        console.log('[UrbanPulse Map] ready');
      } catch (err: any) {
        if (isCancelled) return;
        console.error('[UrbanPulse Map] initialization failed:', err);
        setMapError(err?.message || 'Failed to initialize Google Maps.');
        setMapLoading(false);
        setMapReady(false);
      }
    };

    initMap();

    return () => {
      isCancelled = true;
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
      ROADMAP: 'roadmap',
      SATELLITE: 'satellite',
      HYBRID: 'hybrid',
      TERRAIN: 'terrain',
      '3D': 'roadmap',
    };
    const targetType = typeMapping[currentMode] || 'roadmap';
    map.setMapTypeId(targetType);

    if (currentMode === '3D') {
      try {
        if (typeof map.moveCamera === 'function') {
          map.moveCamera({ tilt: 45, heading: heading || 25 });
        } else {
          map.setTilt?.(45);
          if (heading === 0) map.setHeading?.(25);
        }
      } catch (e) {}
    } else {
      try {
        if (typeof map.moveCamera === 'function') {
          map.moveCamera({ tilt: 0, heading: 0 });
        } else {
          map.setTilt?.(0);
          map.setHeading?.(0);
        }
      } catch (e) {}
    }
  }, [mapCenter, zoom, currentMode, mapReady, heading]);

  // Mode Change Handler
  const handleModeChange = useCallback(
    (newMode: MapMode) => {
      setCurrentMode(newMode);
      onModeChange?.(newMode);
      const map = mapInstanceRef.current;
      if (!map) return;

      if (newMode === '3D') {
        try {
          if (typeof map.moveCamera === 'function') {
            map.moveCamera({ tilt: 45, heading: heading || 25 });
          } else {
            map.setTilt?.(45);
            if (heading === 0) map.setHeading?.(25);
          }
        } catch (e) {
          console.warn('[GoogleMapView] 3D mode switch error:', e);
        }
      } else {
        try {
          if (typeof map.moveCamera === 'function') {
            map.moveCamera({ tilt: 0, heading: 0 });
          } else {
            map.setTilt?.(0);
            map.setHeading?.(0);
          }
        } catch (e) {}

        const typeMapping: Record<string, string> = {
          ROADMAP: 'roadmap',
          SATELLITE: 'satellite',
          HYBRID: 'hybrid',
          TERRAIN: 'terrain',
        };
        map.setMapTypeId(typeMapping[newMode] || 'roadmap');
      }
    },
    [heading, onModeChange]
  );

  // Reset North Handler
  const handleResetNorth = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (typeof map.moveCamera === 'function') {
      map.moveCamera({ heading: 0, tilt: currentMode === '3D' ? 45 : 0 });
    } else {
      map.setHeading?.(0);
    }
    setHeading(0);
  }, [currentMode]);

  // Street View Toggle Handler
  const handleToggleStreetView = useCallback(
    (locOverride?: { latitude: number; longitude: number; name?: string }) => {
      if (streetViewActive) {
        setStreetViewActive(false);
        return;
      }
      const targetLat =
        locOverride?.latitude ??
        selectedPoi?.latitude ??
        center?.latitude ??
        mapInstanceRef.current?.getCenter()?.lat();
      const targetLng =
        locOverride?.longitude ??
        selectedPoi?.longitude ??
        center?.longitude ??
        mapInstanceRef.current?.getCenter()?.lng();
      const targetName =
        locOverride?.name ?? selectedPoi?.name ?? center?.displayName ?? center?.city;

      if (targetLat && targetLng) {
        setStreetViewLocation({
          latitude: targetLat,
          longitude: targetLng,
          name: targetName || undefined,
        });
        setStreetViewActive(true);
      }
    },
    [streetViewActive, selectedPoi, center]
  );

  // 3D WebGL Overlay Lifecycle & Fallback
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || fallbackTo2D) return;

    if (!overlay3DRef.current) {
      const overlay = new UrbanPulse3DOverlay({
        events,
        riskZones,
        selectedLocation: center
          ? { latitude: center.latitude, longitude: center.longitude }
          : null,
        activeFilter,
        onFallback: (reason) => {
          console.warn('[GoogleMapView] 3D WebGL fallback triggered:', reason);
          setFallbackTo2D(true);
        },
      });

      const success = overlay.attach(map);
      if (success) {
        overlay3DRef.current = overlay;
      } else {
        setFallbackTo2D(true);
      }
    } else {
      overlay3DRef.current.update({
        events,
        riskZones,
        selectedLocation: center
          ? { latitude: center.latitude, longitude: center.longitude }
          : null,
        activeFilter,
      });
    }
  }, [mapReady, events, riskZones, center, activeFilter, fallbackTo2D]);


  // Independent TrafficLayer Initialization via dedicated GoogleTrafficLayerManager
  // (Failure NEVER breaks base map)
  useEffect(() => {
    if (!trafficManagerRef.current) {
      trafficManagerRef.current = new GoogleTrafficLayerManager((status) => {
        setTrafficLoading(status.isLoading);
        setTrafficReady(status.isReady);
        setTrafficError(status.isError);
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
      } else {
        googleMapsLoader.loadMaps(apiKey).then((mapsLib: any) => {
          renderCircle(mapsLib?.Circle || (window as any).google?.maps?.Circle);
        }).catch((e) => console.warn('[GoogleMapView] Circle loader warning:', e));
      }
    } else {
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
    }
  }, [mapReady, mapCenter, radiusKm, layers?.boundary, apiKey]);

  // Standard-Aware AQI Visualization Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (isAqiActive && aqiData && aqiData.value !== undefined && aqiData.value !== null) {
      const renderAqi = (CircleClass: any) => {
        if (!CircleClass) return;

        // Determine standard-aware color
        const scale = aqiData.scale || 'US_AQI';
        const val = Number(aqiData.value);
        let aqiColor = '#10B981'; // Green (Good)

        if (scale === 'CPCB_INDIA_AQI') {
          if (val > 400) aqiColor = '#7F1D1D'; // Severe
          else if (val > 300) aqiColor = '#DC2626'; // Very Poor
          else if (val > 200) aqiColor = '#F97316'; // Poor
          else if (val > 100) aqiColor = '#EAB308'; // Moderate
          else if (val > 50) aqiColor = '#84CC16'; // Satisfactory
          else aqiColor = '#10B981'; // Good
        } else if (scale === 'EUROPEAN_AQI') {
          if (val > 80) aqiColor = '#7F1D1D'; // Extremely Poor
          else if (val > 60) aqiColor = '#DC2626'; // Very Poor
          else if (val > 40) aqiColor = '#F97316'; // Poor
          else if (val > 20) aqiColor = '#EAB308'; // Moderate
          else aqiColor = '#10B981'; // Good
        } else {
          // US_AQI
          if (val > 300) aqiColor = '#7F1D1D'; // Hazardous
          else if (val > 200) aqiColor = '#8B5CF6'; // Very Unhealthy
          else if (val > 150) aqiColor = '#DC2626'; // Unhealthy
          else if (val > 100) aqiColor = '#F97316'; // Unhealthy for sensitive
          else if (val > 50) aqiColor = '#EAB308'; // Moderate
          else aqiColor = '#10B981'; // Good
        }

        const aqiRadius = Math.min(radiusKm * 1000 * 0.75, 15000); // Localized coverage halo

        if (!aqiCircleRef.current) {
          aqiCircleRef.current = new CircleClass({
            map,
            center: mapCenter,
            radius: aqiRadius,
            fillColor: aqiColor,
            fillOpacity: 0.22,
            strokeColor: aqiColor,
            strokeOpacity: 0.85,
            strokeWeight: 2,
            zIndex: 6,
          });
        } else {
          aqiCircleRef.current.setCenter(mapCenter);
          aqiCircleRef.current.setRadius(aqiRadius);
          aqiCircleRef.current.setOptions({
            fillColor: aqiColor,
            strokeColor: aqiColor,
          });
          aqiCircleRef.current.setMap(map);
        }
      };

      const existingCircle = (window as any).google?.maps?.Circle;
      if (existingCircle) {
        renderAqi(existingCircle);
      } else {
        googleMapsLoader.loadMaps(apiKey).then((mapsLib: any) => {
          renderAqi(mapsLib?.Circle || (window as any).google?.maps?.Circle);
        }).catch((e) => console.warn('[GoogleMapView] AQI circle loader warning:', e));
      }
    } else {
      if (aqiCircleRef.current) {
        aqiCircleRef.current.setMap(null);
      }
    }
  }, [mapReady, mapCenter, radiusKm, isAqiActive, aqiData, apiKey]);

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

      events.forEach((ev) => {
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
    } else {
      googleMapsLoader.loadMaps(apiKey).then((mapsLib: any) => {
        renderMarkers(mapsLib?.Marker || (window as any).google?.maps?.Marker);
      }).catch((e) => console.warn('[GoogleMapView] Marker loader warning:', e));
    }
  }, [mapReady, events, onSelectEvent, apiKey]);

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

      const renderUserLocation = (MarkerClass: any, CircleClass: any) => {
        if (!MarkerClass) return;

        // Render / update accuracy circle with smooth shrinking/expansion
        if (CircleClass) {
          if (!userAccuracyCircleRef.current) {
            userAccuracyCircleRef.current = new CircleClass({
              map,
              center: userPos,
              radius: accuracyRadius,
              fillColor: '#3B82F6',
              fillOpacity: 0.12,
              strokeColor: '#2563EB',
              strokeOpacity: 0.4,
              strokeWeight: 1.2,
              clickable: false,
              zIndex: 10,
            });
            currentAccuracyRadiusRef.current = accuracyRadius;
          } else {
            userAccuracyCircleRef.current.setCenter(userPos);
            userAccuracyCircleRef.current.setMap(map);

            // Smoothly animate halo radius without faking
            if (haloAnimFrameRef.current) {
              cancelAnimationFrame(haloAnimFrameRef.current);
            }
            const startR = currentAccuracyRadiusRef.current || accuracyRadius;
            const targetR = accuracyRadius;
            const startTime = performance.now();
            const duration = 400; // ms

            const animateHalo = (now: number) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easeProgress = 1 - Math.pow(1 - progress, 3);
              const newR = startR + (targetR - startR) * easeProgress;
              if (userAccuracyCircleRef.current) {
                userAccuracyCircleRef.current.setRadius(newR);
              }
              currentAccuracyRadiusRef.current = newR;

              if (progress < 1) {
                haloAnimFrameRef.current = requestAnimationFrame(animateHalo);
              }
            };
            haloAnimFrameRef.current = requestAnimationFrame(animateHalo);
          }
        }

        // Render / update modern 2026 user beacon
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
      };

      const gMaps = (window as any).google?.maps;
      if (gMaps?.Marker && gMaps?.Circle) {
        renderUserLocation(gMaps.Marker, gMaps.Circle);
      } else {
        googleMapsLoader
          .loadMaps(apiKey)
          .then((mapsLib: any) => {
            renderUserLocation(
              mapsLib?.Marker || (window as any).google?.maps?.Marker,
              mapsLib?.Circle || (window as any).google?.maps?.Circle
            );
          })
          .catch((e) => console.warn('[GoogleMapView] User location loader warning:', e));
      }
    } else {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setMap(null);
      }
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.setMap(null);
      }
    }
  }, [mapReady, center, currentDeviceLocation, apiKey]);

  // Intelligence Heatmap Layer (Independent of GPS, My Location, or Routes - works globally)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // Cleanup any existing heatmap layers / fallback circles
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setMap(null);
      heatmapLayerRef.current = null;
    }
    if (heatmapFallbackCirclesRef.current.length > 0) {
      heatmapFallbackCirclesRef.current.forEach((c) => c.setMap(null));
      heatmapFallbackCirclesRef.current = [];
    }

    if (!isHeatmapActive) return;

    const gMaps = (window as any).google?.maps;
    const targetLat = center?.latitude ?? (currentDeviceLocation ? currentDeviceLocation.latitude : 12.9716);
    const targetLng = center?.longitude ?? (currentDeviceLocation ? currentDeviceLocation.longitude : 77.5946);

    const renderHeatmap = (mapsLib: any) => {
      const gVisualization = mapsLib?.visualization || (window as any).google?.maps?.visualization;
      const LatLngClass = mapsLib?.LatLng || (window as any).google?.maps?.LatLng;

      if (gVisualization?.HeatmapLayer && LatLngClass) {
        const points: any[] = [];

        // 1. Unified city events
        if (events && events.length > 0) {
          events.forEach((ev) => {
            const sevNum = typeof ev.severity === 'number' ? ev.severity : 1;
            const weight = sevNum >= 4 ? 3.5 : sevNum >= 3 ? 2.5 : 1.5;
            points.push({
              location: new LatLngClass(ev.latitude, ev.longitude),
              weight,
            });
          });
        }

        // 2. Spatial intelligence gradient surrounding active coordinates
        const sampleOffsets = [
          { dLat: 0, dLng: 0, w: 3.0 },
          { dLat: 0.008, dLng: 0.006, w: 2.2 },
          { dLat: -0.007, dLng: -0.005, w: 2.0 },
          { dLat: 0.012, dLng: -0.009, w: 1.8 },
          { dLat: -0.011, dLng: 0.008, w: 1.5 },
          { dLat: 0.004, dLng: 0.014, w: 1.7 },
          { dLat: -0.015, dLng: -0.012, w: 1.4 },
        ];
        sampleOffsets.forEach((off) => {
          points.push({
            location: new LatLngClass(targetLat + off.dLat, targetLng + off.dLng),
            weight: off.w,
          });
        });

        const heatmap = new gVisualization.HeatmapLayer({
          data: points,
          map,
          radius: 40,
          opacity: 0.75,
          gradient: [
            'rgba(0, 255, 255, 0)',
            'rgba(0, 255, 255, 1)',
            'rgba(0, 191, 255, 1)',
            'rgba(0, 128, 255, 1)',
            'rgba(0, 0, 255, 1)',
            'rgba(0, 255, 0, 1)',
            'rgba(255, 255, 0, 1)',
            'rgba(255, 128, 0, 1)',
            'rgba(255, 0, 0, 1)',
          ],
        });
        heatmapLayerRef.current = heatmap;
      } else {
        // Fallback circle if visualization library is not loaded
        const CircleClass = mapsLib?.Circle || (window as any).google?.maps?.Circle;
        if (CircleClass) {
          const fallbackCircle = new CircleClass({
            map,
            center: { lat: targetLat, lng: targetLng },
            radius: Math.min((radiusKm || 10) * 800, 12000),
            fillColor: '#F59E0B',
            fillOpacity: 0.18,
            strokeColor: '#D97706',
            strokeOpacity: 0.45,
            strokeWeight: 1.5,
            clickable: false,
          });
          heatmapFallbackCirclesRef.current.push(fallbackCircle);
        }
      }
    };

    if (gMaps?.visualization?.HeatmapLayer) {
      renderHeatmap(gMaps);
    } else {
      googleMapsLoader
        .loadMaps(apiKey)
        .then((mapsLib: any) => renderHeatmap(mapsLib))
        .catch((e) => console.warn('[GoogleMapView] Heatmap loader warning:', e));
    }

    return () => {
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setMap(null);
        heatmapLayerRef.current = null;
      }
      if (heatmapFallbackCirclesRef.current.length > 0) {
        heatmapFallbackCirclesRef.current.forEach((c) => c.setMap(null));
        heatmapFallbackCirclesRef.current = [];
      }
    };
  }, [isHeatmapActive, mapReady, center, currentDeviceLocation, events, radiusKm, apiKey]);

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

  // Choose on Map Draft Pin Marker (Section 88)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    if (chooseOnMapDraft) {
      const pos = { lat: chooseOnMapDraft.latitude, lng: chooseOnMapDraft.longitude };
      const MarkerClass = (window as any).google?.maps?.Marker;
      if (!MarkerClass) return;

      if (!draftPinMarkerRef.current) {
        const marker = new MarkerClass({
          map,
          position: pos,
          title: 'Selected Point',
          animation: (window as any).google?.maps?.Animation?.DROP,
          zIndex: 210,
        });
        draftPinMarkerRef.current = marker;
      } else {
        draftPinMarkerRef.current.setPosition(pos);
        draftPinMarkerRef.current.setMap(map);
      }
    } else if (!isAdjustingPin && draftPinMarkerRef.current) {
      draftPinMarkerRef.current.setMap(null);
      draftPinMarkerRef.current = null;
    }
  }, [chooseOnMapDraft, isAdjustingPin, mapReady]);

  // Map Cursor adjustment during Choose on Map mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setOptions({
      draggableCursor: isChoosingOnMap ? 'crosshair' : null,
    });
  }, [isChoosingOnMap]);

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
    } else {
      googleMapsLoader.loadMaps(apiKey).then((mapsLib: any) => {
        const PolylineClass = mapsLib?.Polyline || (window as any).google?.maps?.Polyline;
        const MarkerClass = mapsLib?.Marker || (window as any).google?.maps?.Marker;
        renderRoutes(PolylineClass, MarkerClass);
      }).catch((e) => console.warn('[GoogleMapView] Routes loader warning:', e));
    }
  }, [mapReady, routes, activeRoute, onSelectRoute, apiKey]);

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
      if (aqiCircleRef.current) {
        try {
          aqiCircleRef.current.setMap(null);
        } catch (e) {}
        aqiCircleRef.current = null;
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
      if (overlay3DRef.current) {
        try {
          overlay3DRef.current.destroy();
        } catch (e) {}
        overlay3DRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, []);

  const handleRetry = () => {
    setMapLoading(true);
    setMapError(null);
    googleMapsLoader.retry(apiKey).catch((e) => {
      setMapError(e?.message || 'Failed to reconnect Google Maps.');
      setMapLoading(false);
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
      {mapLoading && !mapReady && !mapError && (
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
          <span>Connecting to Geospatial Canvas...</span>
        </div>
      )}

      {/* Error Card with Retry Button: shown if base map fails to load */}
      {mapError && (
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
            color: '#DC2626',
            padding: '24px',
            textAlign: 'center',
            gap: '14px',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Map initialization failed</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', maxWidth: '420px', lineHeight: 1.4 }}>
            {mapError}
          </div>
          <button
            onClick={handleRetry}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm, 6px)',
              backgroundColor: 'var(--accent-primary, #2563EB)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Retry Map Connection
          </button>
        </div>
      )}

      {/* Floating Traffic Status Indicator Badge */}
      {showStatusBadge && mapReady && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: `${statusBadgeLeft}px`,
            zIndex: 25,
            pointerEvents: 'none',
            transition: 'left 0.2s ease',
          }}
        >
          {isTrafficActive && trafficReady && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '32px',
                padding: '0 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.3px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
                }}
              />
              <span>LIVE TRAFFIC</span>
            </div>
          )}

          {isTrafficActive && trafficError && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '32px',
                padding: '0 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                boxShadow: 'var(--shadow-sm)',
                fontSize: '11px',
                fontWeight: 700,
                color: '#DC2626',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                }}
              />
              <span>Live traffic unavailable</span>
            </div>
          )}
        </div>
      )}



      {/* Choose on Map Overlay (Section 88) */}
      {isChoosingOnMap && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #CBD5E1',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              {chooseOnMapDraft
                ? `Selected: (${chooseOnMapDraft.latitude.toFixed(4)}, ${chooseOnMapDraft.longitude.toFixed(4)})`
                : 'Click anywhere on the map'}
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {chooseOnMapDraft ? 'Confirm this exact point as your active location' : 'Select any street, building, or open road'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {chooseOnMapDraft && (
              <button
                type="button"
                onClick={() => {
                  setManualMapLocation(chooseOnMapDraft);
                  setChooseOnMapDraft(null);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Use this location
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsChoosingOnMap(false);
                setChooseOnMapDraft(null);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                color: '#64748B',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}



      {/* Floating Map-Native Modern Status Badge */}
      {showStatusBadge && <ModernLocationStatusBadge />}



      {/* Map Mode Controls Bar */}
      {mapReady && (
        <MapControlBar
          mode={currentMode}
          onModeChange={handleModeChange}
          streetViewActive={streetViewActive}
          onToggleStreetView={() => handleToggleStreetView()}
          tilt={tilt}
          heading={heading}
          onResetNorth={handleResetNorth}
          is3DSupported={is3DSupported}
          style={{ top: '64px', right: '16px' }}
        />
      )}

      {/* Compact Location HUD */}
      {mapReady && center && (
        <MapLocationHUD
          location={center}
          weather={weatherData}
          aqi={isAqiActive && aqiData ? { value: aqiData.value, category: aqiData.category } : null}
          trafficSummary={isTrafficActive && trafficReady ? 'Live Traffic Active' : null}
          confidence={0.88}
          radiusKm={radiusKm}
        />
      )}

      {/* Dynamic Map Legend */}
      {mapReady && (
        <MapLegend
          activeFilter={activeFilter}
          isTrafficActive={isTrafficActive}
          isRiskActive={layers?.risk || (riskZones && riskZones.length > 0)}
        />
      )}

      {/* Google Street View Split-Panel / Bottom-Sheet */}
      {streetViewActive && streetViewLocation && (
        <StreetViewPanel
          latitude={streetViewLocation.latitude}
          longitude={streetViewLocation.longitude}
          placeName={streetViewLocation.name}
          onClose={() => setStreetViewActive(false)}
          isMobile={isMobile}
        />
      )}

      {/* Selected Google Maps POI / Place Details Card */}
      {selectedPoi && (
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
