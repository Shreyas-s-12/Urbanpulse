'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { routeService } from '@/services/routeService';
import { locationService } from '@/services/locationService';
import { CandidateRoute, ResolvedLocation, RoutePlan, TravelMode } from '@shared/types';
import GoogleMapView from '@/components/map/GoogleMapView';

export default function RoutePlanningView() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();

  const defaultOrigin: ResolvedLocation = currentLocation || {
    latitude: 0,
    longitude: 0,
    city: null,
    displayName: 'Select Origin Location',
    isUserLocation: false,
    country: null,
  };

  const [fromLoc, setFromLoc] = useState<ResolvedLocation>(defaultOrigin);
  const [toLoc, setToLoc] = useState<ResolvedLocation>({
    latitude: defaultOrigin.latitude ? defaultOrigin.latitude + 0.065 : 0,
    longitude: defaultOrigin.longitude ? defaultOrigin.longitude + 0.045 : 0,
    city: defaultOrigin.city,
    displayName: defaultOrigin.city ? `Outbound Corridor, ${defaultOrigin.city}` : 'Select Destination',
    isUserLocation: false,
    country: defaultOrigin.country,
  });

  const [fromQuery, setFromQuery] = useState(defaultOrigin.city ? `${defaultOrigin.city} Center` : (currentLocation?.displayName || ''));
  const [toQuery, setToQuery] = useState(defaultOrigin.city ? `Destination in ${defaultOrigin.city}` : '');
  const [travelMode, setTravelMode] = useState<TravelMode>('drive');
  const [selectedRoute, setSelectedRoute] = useState<CandidateRoute | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [trafficEnabled, setTrafficEnabled] = useState(true);

  // Suggestions for destination & origin
  const [toSuggestions, setToSuggestions] = useState<ResolvedLocation[]>([]);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const toSearchRef = useRef<HTMLDivElement>(null);

  const [fromSuggestions, setFromSuggestions] = useState<ResolvedLocation[]>([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const fromSearchRef = useRef<HTMLDivElement>(null);

  // Sync fromLoc with currentLocation if changed by user in TopBar
  useEffect(() => {
    if (currentLocation && (fromLoc.latitude === 0 && fromLoc.longitude === 0)) {
      setFromLoc(currentLocation);
      setFromQuery(currentLocation.city ? `${currentLocation.city} Center` : currentLocation.displayName);
      setToLoc({
        latitude: currentLocation.latitude + 0.065,
        longitude: currentLocation.longitude + 0.045,
        city: currentLocation.city,
        displayName: `Outbound Corridor, ${currentLocation.city || 'Local Area'}`,
        isUserLocation: false,
        country: currentLocation.country,
      });
      setToQuery(currentLocation.city ? `Outbound Corridor, ${currentLocation.city}` : '');
    }
  }, [currentLocation]);

  // Fetch routes whenever origin, destination, or travelMode changes
  useEffect(() => {
    if (!fromLoc || !toLoc || (fromLoc.latitude === 0 && fromLoc.longitude === 0) || (toLoc.latitude === 0 && toLoc.longitude === 0)) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setRouteError(null);

    routeService
      .calculateRoutes(fromLoc, toLoc, travelMode)
      .then((plan) => {
        if (isMounted) {
          setRoutePlan(plan);
          setSelectedRoute(plan.candidateRoutes[0] || null);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setRouteError(err.message || 'Routes API error. Unable to load traffic-aware routes.');
          setRoutePlan(null);
          setSelectedRoute(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [fromLoc.latitude, fromLoc.longitude, toLoc.latitude, toLoc.longitude, travelMode]);

  // Handle origin search debounce
  useEffect(() => {
    if (!fromQuery.trim() || fromQuery.length < 3) {
      setFromSuggestions([]);
      return;
    }

    // Don't search if the query exactly matches current fromLoc display name
    if (fromLoc.displayName === fromQuery || (fromLoc.city && `${fromLoc.city} Center` === fromQuery)) {
      return;
    }

    const timer = setTimeout(async () => {
      const results = await locationService.searchLocation(fromQuery);
      setFromSuggestions(results);
      if (results.length > 0) setShowFromSuggestions(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [fromQuery, fromLoc.displayName, fromLoc.city]);

  // Handle destination search debounce
  useEffect(() => {
    if (!toQuery.trim() || toQuery.length < 3) {
      setToSuggestions([]);
      return;
    }

    // Don't search if the query exactly matches current toLoc display name
    if (toLoc.displayName === toQuery || (toLoc.city && `${toLoc.city} Center` === toQuery)) {
      return;
    }

    const timer = setTimeout(async () => {
      const results = await locationService.searchLocation(toQuery);
      setToSuggestions(results);
      if (results.length > 0) setShowToSuggestions(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [toQuery, toLoc.displayName, toLoc.city]);

  // Handle click outside to close suggestion popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fromSearchRef.current && !fromSearchRef.current.contains(e.target as Node)) {
        setShowFromSuggestions(false);
      }
      if (toSearchRef.current && !toSearchRef.current.contains(e.target as Node)) {
        setShowToSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const candidates = routePlan?.candidateRoutes || [];
  const activeRoute = selectedRoute || candidates[0] || null;

  const travelModes: Array<{ mode: TravelMode; label: string }> = [
    { mode: 'drive', label: 'Drive' },
    { mode: 'two_wheeler', label: 'Two-wheeler' },
    { mode: 'transit', label: 'Transit' },
    { mode: 'bicycle', label: 'Bicycle' },
    { mode: 'walk', label: 'Walk' },
  ];

  const handleSelectFromSuggestion = (loc: ResolvedLocation) => {
    setFromLoc(loc);
    setFromQuery(loc.displayName || loc.city || 'Selected Origin');
    setShowFromSuggestions(false);
  };

  const handleSelectToSuggestion = (loc: ResolvedLocation) => {
    setToLoc(loc);
    setToQuery(loc.displayName || loc.city || 'Selected Destination');
    setShowToSuggestions(false);
  };

  const handleSwapLocations = () => {
    const prevFrom = fromLoc;
    const prevFromQuery = fromQuery;
    setFromLoc(toLoc);
    setFromQuery(toQuery);
    setToLoc(prevFrom);
    setToQuery(prevFromQuery);
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      const loc = await locationService.requestDeviceLocation();
      setFromLoc(loc);
      setFromQuery(loc.city ? `${loc.city} Center` : loc.displayName);
    } catch {
      if (currentLocation) {
        setFromLoc(currentLocation);
        setFromQuery(currentLocation.city ? `${currentLocation.city} Center` : currentLocation.displayName);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Route Control Sidebar */}
      <div
        style={{
          width: '420px',
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '24px',
          gap: '20px',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
              REAL-TIME TRAFFIC & ROUTE INTELLIGENCE
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'rgba(54, 127, 242, 0.1)',
                color: 'var(--accent-blue)',
              }}
            >
              GOOGLE ROUTES V2
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            Plan a Journey
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Google live traffic congestion, genuine route ETA, and verified UrbanPulse incident risks.
          </p>
        </div>

        {/* Input Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* FROM Input */}
          <div style={{ position: 'relative' }} ref={fromSearchRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>FROM (ORIGIN)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {fromLoc.latitude !== 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                    {fromLoc.latitude.toFixed(4)}, {fromLoc.longitude.toFixed(4)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-blue)',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  My Location
                </button>
              </div>
            </div>
            <input
              type="text"
              value={fromQuery}
              onChange={(e) => setFromQuery(e.target.value)}
              onFocus={() => {
                if (fromSuggestions.length > 0) setShowFromSuggestions(true);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (fromSuggestions.length > 0) {
                    handleSelectFromSuggestion(fromSuggestions[0]);
                  } else if (fromQuery.trim()) {
                    const res = await locationService.searchLocation(fromQuery);
                    if (res.length > 0) handleSelectFromSuggestion(res[0]);
                  }
                }
              }}
              placeholder="Search origin city, address, or coordinates..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                fontSize: '13px',
                marginTop: '4px',
                color: 'var(--text-primary)',
              }}
            />

            {/* Origin Suggestions Dropdown */}
            {showFromSuggestions && fromSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '64px',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-panel)',
                  padding: '6px 0',
                  zIndex: 110,
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {fromSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectFromSuggestion(item)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      borderBottom: idx < fromSuggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-app)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.city || item.displayName}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.displayName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
            <button
              type="button"
              onClick={handleSwapLocations}
              title="Swap Origin and Destination"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-blue)';
                e.currentTarget.style.color = 'var(--accent-blue)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <span>⇄</span> Swap
            </button>
          </div>

          {/* TO Input */}
          <div style={{ position: 'relative' }} ref={toSearchRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>TO (DESTINATION)</label>
              {toLoc.latitude !== 0 && (
                <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  {toLoc.latitude.toFixed(4)}, {toLoc.longitude.toFixed(4)}
                </span>
              )}
            </div>
            <input
              type="text"
              value={toQuery}
              onChange={(e) => setToQuery(e.target.value)}
              onFocus={() => {
                if (toSuggestions.length > 0) setShowToSuggestions(true);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (toSuggestions.length > 0) {
                    handleSelectToSuggestion(toSuggestions[0]);
                  } else if (toQuery.trim()) {
                    const res = await locationService.searchLocation(toQuery);
                    if (res.length > 0) handleSelectToSuggestion(res[0]);
                  }
                }
              }}
              placeholder="Search destination city, landmark, or coordinates..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                fontSize: '13px',
                marginTop: '4px',
                color: 'var(--text-primary)',
              }}
            />

            {/* Destination Suggestions Dropdown */}
            {showToSuggestions && toSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '64px',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-panel)',
                  padding: '6px 0',
                  zIndex: 100,
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {toSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectToSuggestion(item)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      borderBottom: idx < toSuggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-app)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.city || item.displayName}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.displayName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Travel Mode Selector */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>TRAVEL MODE</label>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {travelModes.map((item) => (
              <button
                key={item.mode}
                onClick={() => setTravelMode(item.mode)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: travelMode === item.mode ? 'var(--accent-blue)' : 'var(--bg-app)',
                  color: travelMode === item.mode ? '#FFFFFF' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Copilot Advisory Banner */}
        <div
          style={{
            backgroundColor: 'rgba(54, 127, 242, 0.08)',
            border: '1px solid rgba(54, 127, 242, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)' }}>
              LIVE ROUTE COPILOT
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {loading ? (
              'Querying Google Routes API with TRAFFIC_AWARE_OPTIMAL and evaluating corridor risks...'
            ) : routeError ? (
              <span style={{ color: '#EF4444' }}>{routeError}</span>
            ) : (
              routePlan?.copilotAdvisory || 'All candidate transit corridors operational.'
            )}
          </div>
        </div>

        {/* Error Notification if Google Routes API failed */}
        {routeError && (
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            <strong>Routes API Error:</strong> {routeError}
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              UrbanPulse strictly refuses to substitute fake or simulated routes.
            </div>
          </div>
        )}

        {/* Candidate Corridors List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              CANDIDATE CORRIDORS ({candidates.length})
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Live Google Traffic
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {candidates.map((route) => {
              const isSelected = activeRoute?.id === route.id;
              const isRecommended = route.category === 'RECOMMENDED';
              const isFastest = route.category === 'FASTEST';
              const hasDelay = route.trafficDelayMinutes > 0;

              return (
                <div
                  key={route.id}
                  onClick={() => setSelectedRoute(route)}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--bg-app)',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {route.name}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {route.summary}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      {isRecommended && (
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'var(--accent-primary-light)',
                            color: 'var(--accent-primary)',
                            fontWeight: 700,
                          }}
                        >
                          RECOMMENDED
                        </span>
                      )}
                      {isFastest && !isRecommended && (
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'rgba(54, 127, 242, 0.1)',
                            color: 'var(--accent-blue)',
                            fontWeight: 700,
                          }}
                        >
                          FASTEST
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Real Google Metrics */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {route.estimatedTimeMinutes} mins
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{route.distanceKm} km</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: hasDelay ? '#F59E0B' : 'var(--accent-primary)',
                      }}
                    >
                      {hasDelay ? `+${route.trafficDelayMinutes}m traffic delay` : 'Free-flowing'}
                    </span>
                  </div>

                  {/* UrbanPulse Risk Metrics */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>
                      UrbanPulse Risk: <strong style={{ color: route.overallRiskScore > 50 ? '#EF4444' : 'var(--text-primary)' }}>{route.overallRiskScore}/100</strong>
                    </span>
                    <span>
                      {route.intersectingEvents.length} incident{route.intersectingEvents.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Map Area with Real Google Maps & TrafficLayer */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <GoogleMapView
          center={fromLoc}
          radiusKm={selectedRadiusKm}
          events={activeRoute?.intersectingEvents || []}
          activeRoute={activeRoute}
          routes={candidates}
          onSelectRoute={(r) => setSelectedRoute(r)}
          trafficEnabled={trafficEnabled}
          height="100%"
        />

        {/* Floating Map Controls in Route View */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 30,
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={trafficEnabled}
              onChange={(e) => setTrafficEnabled(e.target.checked)}
            />
            Live Google Traffic
          </label>
        </div>
      </div>
    </div>
  );
}
