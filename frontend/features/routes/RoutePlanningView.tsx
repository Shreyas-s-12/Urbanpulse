'use client';
import React, { useState, useEffect } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { routeService } from '@/services/routeService';
import { CandidateRoute, ResolvedLocation, RoutePlan, TravelMode } from '@shared/types';
import SpatialMap from '@/components/map/SpatialMap';

export default function RoutePlanningView() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();

  const [fromQuery, setFromQuery] = useState(currentLocation ? `${currentLocation.city || 'Current Area'} Center` : 'Current Location');
  const [toQuery, setToQuery] = useState('Suburban Industrial Corridor');
  const [travelMode, setTravelMode] = useState<TravelMode>('drive');
  const [selectedRoute, setSelectedRoute] = useState<CandidateRoute | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(false);

  const fromLoc: ResolvedLocation = currentLocation || {
  latitude: 0,
  longitude: 0,
  city: null,
  displayName: 'Origin',
  isUserLocation: true,
  country: null,
};

  const toLoc: ResolvedLocation = {
    latitude: fromLoc.latitude + 0.12,
    longitude: fromLoc.longitude + 0.14,
    city: 'Destination Hub',
    country: fromLoc.country,
    displayName: `${toQuery}, ${yourCityOrRegion(fromLoc)}`,
    isUserLocation: false,
  };

  function yourCityOrRegion(loc: ResolvedLocation) {
    return loc.city || loc.region || loc.country || 'Local Corridor';
  }

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    routeService
      .calculateRoutes(fromLoc, toLoc, travelMode)
      .then((plan) => {
        if (isMounted) {
          setRoutePlan(plan);
          setSelectedRoute(plan.candidateRoutes[0] || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fromLoc.latitude, fromLoc.longitude, toLoc.latitude, toLoc.longitude, travelMode]);

  const candidates = routePlan?.candidateRoutes || [];
  const activeRoute = selectedRoute || candidates[0] || null;

  const travelModes: Array<{ mode: TravelMode; label: string }> = [
    { mode: 'drive', label: 'Drive' },
    { mode: 'two_wheeler', label: 'Two-wheeler' },
    { mode: 'transit', label: 'Transit' },
    { mode: 'bicycle', label: 'Bicycle' },
    { mode: 'walk', label: 'Walk' },
  ];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
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
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
            ROUTE&INTELLIGENCE&ENGINE
          </span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            Plan a Journey
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Traffic, weather, hazard intersection, and risk-scored candidate corridors.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>FROM (ORIGIN)</label>
            <input
              type="text"
              value={fromQuery}
              onChange={(e) => setFromQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                fontSize: '13px',
                marginTop: '4px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>TO (DESTINATION)</label>
            <input
              type="text"
              value={toQuery}
              onChange={(e) => setToQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                fontSize: '13px',
                marginTop: '4px',
              }}
            />
          </div>
        </div>

        <div>
          
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>TRAVELMODE</label>
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
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

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
            {loading ? 'Analyzing corridors and incident intersections...' : (routePlan?.copilotAdvisory || 'All corridors operational.')}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
            CANDIDATE CORRIDORS ({candidates.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {candidates.map((route) => {
              const isSelected = activeRoute?.id === route.id;
              const isRecommended = route.id === routePlan?.recommendedRouteId;

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
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {yourRouteName(route)}
                    </span>
                    {isRecommended && (
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--accent-primary-light)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                        RECOMMENDED
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {route.distanceKm} km • Est. {route.estimatedTimeMinutes} mins
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Risk Score: {route.overallRiskScore}</span>
                    <span>{route.intersectingEvents.length} Incident(s)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <SpatialMap
          center={fromLoc}
          radiusKm={selectedRadiusKm}
          events={activeRoute?.intersectingEvents || []}
          activeRoute={activeRoute}
          height="100%"
        />
      </div>
    </div>
  );
}

function yourRouteName(route: CandidateRoute): string {
  return route.name || route.category || 'Alternate Path';
}
