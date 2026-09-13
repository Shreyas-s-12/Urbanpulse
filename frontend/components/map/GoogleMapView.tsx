'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { ResolvedLocation, UnifiedCityEvent, CandidateRoute } from '@shared/types';

export interface MapLayersState {
  traffic?: boolean;
  aqi?: boolean;
  accidents?: boolean;
  disasters?: boolean;
  hazards?: boolean;
  boundary?: boolean;
}

interface GoogleMapViewProps {
  center: ResolvedLocation | null;
  radiusKm: number;
  events: UnifiedCityEvent[];
  layers?: MapLayersState;
  trafficEnabled?: boolean;
  aqiEnabled?: boolean;
  aqiData?: any;
  zoomOverride?: number;
  mapMode?: 'roadmap' | 'satellite' | 'terrain';
  activeRoute?: CandidateRoute | null;
  routes?: CandidateRoute[];
  onSelectRoute?: (route: CandidateRoute) => void;
  onSelectEvent?: (event: UnifiedCityEvent) => void;
  onMapClick?: (coords: { latitude: number; longitude: number }) => void;
  height?: string;
  showStatusBadge?: boolean;
}


// Global loader instance to prevent duplicate script injection across the app
let globalGoogleLoader: Loader | null = null;
const DEFAULT_MAPS_KEY = 'AIzaSyDU2vkyVUnqI5lYUOz8aYrKO6mnYtWVSTg';

function getGoogleMapsLoader(apiKey: string): Loader {
  const effectiveKey = apiKey || DEFAULT_MAPS_KEY;
  if (!globalGoogleLoader || (globalGoogleLoader as any).apiKey !== effectiveKey) {
    globalGoogleLoader = new Loader({
      apiKey: effectiveKey,
      version: 'weekly',
      libraries: ['places', 'maps', 'marker'],
    });
  }
  return globalGoogleLoader;
}

export default function GoogleMapView({
  center,
  radiusKm,
  events,
  layers,
  trafficEnabled,
  aqiEnabled,
  aqiData,
  zoomOverride,
  mapMode = 'roadmap',
  activeRoute,
  routes,
  onSelectRoute,
  onSelectEvent,
  onMapClick,
  height,
  showStatusBadge = true,
}: GoogleMapViewProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    (typeof window !== 'undefined' && (window as any).__UP_GMAPS_KEY ? (window as any).__UP_GMAPS_KEY : DEFAULT_MAPS_KEY);

  // DOM Container & Google Maps Object References
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    mapContainerRef.current = node;
    setContainerNode(node);
  }, []);

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const aqiCircleRef = useRef<google.maps.Circle | null>(null);
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

  // Determine trafficEnabled state from prop or layers object (defaults to true)
  const isTrafficActive = trafficEnabled !== undefined ? trafficEnabled : (layers?.traffic ?? true);
  const isAqiActive = aqiEnabled !== undefined ? aqiEnabled : (layers?.aqi ?? false);

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
          const loader = getGoogleMapsLoader(apiKey);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Google Maps script loading timed out. Please verify internet connectivity.')),
              10000
            )
          );

          const mapsLib = (await Promise.race([
            loader.importLibrary('maps'),
            timeoutPromise,
          ])) as google.maps.MapsLibrary;

          MapClass = mapsLib.Map || (window as any).google?.maps?.Map;
        }

        if (isCancelled) return;

        if (!MapClass) {
          throw new Error('Google Maps Map constructor is not available.');
        }

        // If map instance does not exist yet, create it against the mounted container
        if (!mapInstanceRef.current) {
          const map = new MapClass(containerNode, {
            center: mapCenter,
            zoom,
            mapTypeId: mapMode,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            styles:
              mapMode === 'roadmap'
                ? [
                    {
                      featureType: 'transit.station',
                      elementType: 'labels.icon',
                      stylers: [{ visibility: 'off' }],
                    },
                  ]
                : undefined,
          });

          // Arbitrary point selection directly on map (Requirement 2G)
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
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

  // Update map center/zoom on prop changes
  useEffect(() => {
    if (mapInstanceRef.current && mapReady) {
      mapInstanceRef.current.setCenter(mapCenter);
      mapInstanceRef.current.setZoom(zoom);
      mapInstanceRef.current.setMapTypeId(mapMode);
    }
  }, [mapCenter, zoom, mapMode, mapReady]);

  // Independent TrafficLayer Initialization (Failure NEVER breaks base map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    let isMounted = true;

    if (isTrafficActive) {
      setTrafficLoading(true);
      setTrafficError(false);

      const applyTraffic = (TrafficLayerClass: any) => {
        if (!isMounted) return;
        try {
          if (!trafficLayerRef.current) {
            trafficLayerRef.current = new TrafficLayerClass();
          }
          trafficLayerRef.current?.setMap(map);
          setTrafficReady(true);
          setTrafficLoading(false);
          setTrafficError(false);
        } catch (err) {
          console.warn('[UrbanPulse Traffic] failed to attach:', err);
          setTrafficError(true);
          setTrafficReady(false);
          setTrafficLoading(false);
        }
      };

      const existingClass = (window as any).google?.maps?.TrafficLayer;
      if (existingClass) {
        applyTraffic(existingClass);
      } else {
        const loader = getGoogleMapsLoader(apiKey);
        loader
          .importLibrary('maps')
          .then((mapsLib: any) => {
            const TrafficLayerClass = mapsLib.TrafficLayer || (window as any).google?.maps?.TrafficLayer;
            if (TrafficLayerClass) {
              applyTraffic(TrafficLayerClass);
            } else {
              throw new Error('TrafficLayer unavailable');
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            console.warn('[UrbanPulse Traffic] failed:', err);
            setTrafficError(true);
            setTrafficReady(false);
            setTrafficLoading(false);
          });
      }
    } else {
      if (trafficLayerRef.current) {
        try {
          trafficLayerRef.current.setMap(null);
        } catch (e) {}
      }
      setTrafficReady(false);
      setTrafficLoading(false);
      setTrafficError(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isTrafficActive, mapReady, apiKey]);

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
        const loader = getGoogleMapsLoader(apiKey);
        loader.importLibrary('maps').then((mapsLib: any) => {
          renderCircle(mapsLib.Circle || (window as any).google?.maps?.Circle);
        });
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
        const loader = getGoogleMapsLoader(apiKey);
        loader.importLibrary('maps').then((mapsLib: any) => {
          renderAqi(mapsLib.Circle || (window as any).google?.maps?.Circle);
        });
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
      const loader = getGoogleMapsLoader(apiKey);
      loader.importLibrary('marker').then((markerLib: any) => {
        renderMarkers(markerLib.Marker || (window as any).google?.maps?.Marker);
      });
    }
  }, [mapReady, events, onSelectEvent, apiKey]);

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
        const activePoly = new PolylineClass({
          map,
          path: active.polyline.map((p) => ({ lat: p.latitude, lng: p.longitude })),
          strokeColor: '#367FF2',
          strokeOpacity: 0.92,
          strokeWeight: 5.5,
          zIndex: 8,
        });
        polylinesRef.current.push(activePoly);

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
      const loader = getGoogleMapsLoader(apiKey);
      Promise.all([loader.importLibrary('maps'), loader.importLibrary('marker')]).then(([mapsLib, markerLib]: any) => {
        const PolylineClass = mapsLib.Polyline || (window as any).google?.maps?.Polyline;
        const MarkerClass = markerLib.Marker || (window as any).google?.maps?.Marker;
        renderRoutes(PolylineClass, MarkerClass);
      });
    }
  }, [mapReady, routes, activeRoute, onSelectRoute, apiKey]);

  // Clean cleanup on component unmount
  useEffect(() => {
    return () => {
      if (trafficLayerRef.current) {
        try {
          trafficLayerRef.current.setMap(null);
        } catch (e) {}
        trafficLayerRef.current = null;
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
      mapInstanceRef.current = null;
    };
  }, []);

  const handleRetry = () => {
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

      {/* Loading overlay: automatically disappears as soon as mapReady === true or mapError !== null */}
      {mapLoading && !mapReady && !mapError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0E1318',
            color: 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px solid var(--accent-primary)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
              marginRight: '10px',
            }}
          />
          Initializing Google Maps...
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
            backgroundColor: '#FFFFFF',
            color: '#DC2626',
            padding: '24px',
            textAlign: 'center',
            gap: '14px',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Map initialization failed</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.4 }}>
            {mapError}
          </div>
          <button
            onClick={handleRetry}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-primary)',
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
            left: '16px',
            zIndex: 25,
            pointerEvents: 'none',
          }}
        >
          {isTrafficActive && trafficReady && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '5px 11px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.4px',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
                }}
              />
              LIVE TRAFFIC
            </div>
          )}

          {isTrafficActive && trafficError && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '5px 11px',
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
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                }}
              />
              Live traffic unavailable
            </div>
          )}
        </div>
      )}
    </div>
  );
}
