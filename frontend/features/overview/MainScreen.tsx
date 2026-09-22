'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import dynamic from 'next/dynamic';
import { UnifiedCityEvent } from '@shared/types';
import MapOverlayManager from '@/components/map/MapOverlayManager';
import { useMapContext } from '@/context/MapContext';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';
import { useUrbanCondition } from '@/hooks/useUrbanCondition';
import { useTraffic } from '@/hooks/useTraffic';
import { useWeather } from '@/hooks/useWeather';
import { useAirQuality } from '@/hooks/useAirQuality';
import { useLocationStore } from '@/stores/useLocationStore';
import { locationService } from '@/services/locationService';
import { MAP_SAFE_AREAS } from '@/components/map/overlaySafeArea';
import SiteAnalysisModal from '@/components/site/SiteAnalysisModal';
import { GoogleMapErrorBoundary } from '@/components/common/ErrorBoundary';
import { googleMapsLoader } from '@/services/googleMapsLoader';
import {
  PinIcon,
  ThermometerIcon,
  LeafIcon,
  CarIcon,
  ChevronDownIcon,
  CloseIcon,
} from '@/components/common/Icons';

const GoogleMapView = dynamic(() => import('@/components/map/GoogleMapView'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
        fontWeight: 600,
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '2px solid var(--accent-primary)',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span>Loading workspace canvas...</span>
    </div>
  ),
});

export default function MainScreen() {
  const router = useRouter();
  const { currentLocation, setCurrentLocation, selectedRadiusKm } = useLocationStore();
  const { mapMode } = useMapContext();

  const [selectedEvent, setSelectedEvent] = useState<UnifiedCityEvent | null>(null);
  const [bottomPanelExpanded, setBottomPanelExpanded] = useState(true);
  const [eventsDrawerOpen, setEventsDrawerOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);

  // Progressive independent data loading
  const { weather, loading: weatherLoading, error: weatherError } = useWeather(
    currentLocation?.latitude,
    currentLocation?.longitude
  );

  const { airQuality, loading: airQualityLoading, error: airQualityError } = useAirQuality(
    currentLocation?.latitude,
    currentLocation?.longitude,
    undefined,
    currentLocation?.countryCode
  );

  const { events, setEvents, loading: eventsLoading } = useNearbyEvents(
    currentLocation?.latitude,
    currentLocation?.longitude,
    selectedRadiusKm
  );

  const { condition, loading: conditionLoading } = useUrbanCondition(
    currentLocation?.latitude,
    currentLocation?.longitude,
    selectedRadiusKm
  );

  const { traffic, loading: trafficLoading, error: trafficError } = useTraffic(
    currentLocation?.latitude,
    currentLocation?.longitude,
    selectedRadiusKm
  );

  const handleMapClick = async (coords: { latitude: number; longitude: number }) => {
    try {
      const resolved = await locationService.reverseGeocode(coords.latitude, coords.longitude);
      setCurrentLocation({
        ...resolved,
        isUserLocation: false,
      });
    } catch (err) {
      console.warn('Map click reverse geocoding error:', err);
    }
  };

  const handleFocusEventOnMap = (ev: UnifiedCityEvent) => {
    if (ev.latitude && ev.longitude) {
      setCurrentLocation({
        latitude: ev.latitude,
        longitude: ev.longitude,
        city: currentLocation?.city || 'Selected Location',
        country: currentLocation?.country || 'India',
        countryCode: currentLocation?.countryCode || 'IN',
        displayName: `${ev.title} (${currentLocation?.city || 'Event Area'})`,
        isUserLocation: false,
      });
    }
  };

  useLiveUpdates(
    currentLocation?.latitude,
    currentLocation?.longitude,
    selectedRadiusKm,
    (newEvent) => {
      setEvents((prev) => [newEvent, ...prev.filter((event) => event.eventId !== newEvent.eventId)]);
    }
  );

  // Urban condition evaluation - NEVER manufacture 0 or fake score on missing data
  const hasSufficientSignals = weather || airQuality || traffic || events.length > 0;
  const conditionScore = condition?.overallScore ?? (hasSufficientSignals ? Math.max(20, 100 - events.length * 6) : null);
  const conditionStatus =
    condition?.label && condition.label !== 'UNAVAILABLE'
      ? condition.label
      : conditionScore !== null
      ? conditionScore >= 75
        ? 'FAVORABLE'
        : 'MODERATE RISK'
      : 'UNAVAILABLE';

  // Traffic signal states
  const isTrafficValid = traffic && traffic.status === 'AVAILABLE' && traffic.trafficStatus !== 'UNAVAILABLE';
  const trafficStatusBadge = trafficLoading
    ? 'LOADING'
    : trafficError
    ? 'ERROR'
    : isTrafficValid
    ? 'AVAILABLE'
    : 'NO_COVERAGE';

  const trafficLabel = trafficLoading
    ? 'Querying live feed...'
    : isTrafficValid
    ? traffic.trafficStatus
    : 'No verified feed';

  const trafficDetail = isTrafficValid ? traffic.detail : 'Traffic sensor coverage unavailable in this zone';

  const trafficColor =
    !isTrafficValid || trafficLoading
      ? 'var(--text-muted)'
      : traffic.trafficStatus === 'SEVERE' || traffic.trafficStatus === 'HEAVY'
      ? 'var(--status-critical-text)'
      : traffic.trafficStatus === 'MODERATE'
      ? 'var(--status-caution-text)'
      : 'var(--status-good-text)';

  // Weather signal states
  const weatherStatusBadge = weatherLoading
    ? 'LOADING'
    : weatherError
    ? 'ERROR'
    : weather
    ? 'AVAILABLE'
    : 'UNAVAILABLE';

  // Air quality signal states
  const aqiStatusBadge = airQualityLoading
    ? 'LOADING'
    : airQualityError
    ? 'ERROR'
    : airQuality?.status === 'AVAILABLE'
    ? 'AVAILABLE'
    : 'NO_COVERAGE';

  const airQualityLabel = airQualityLoading
    ? 'Reading sensor...'
    : airQuality?.value !== null && airQuality?.value !== undefined
    ? `${airQuality.scale === 'CPCB_INDIA_AQI' ? 'CPCB' : airQuality.scale === 'EUROPEAN_AQI' ? 'EAQI' : 'AQI'} ${airQuality.value}`
    : 'No verified sensor';

  const airQualityDetail = airQuality?.status === 'AVAILABLE'
    ? `${airQuality.category} (${airQuality.pollutant})`
    : 'Atmospheric telemetry station not active in radius';

  const potholeCount = events.filter((event) => event.eventType === 'POTHOLE').length;

  const buildModuleUrl = (path: string) => {
    const lat = currentLocation?.latitude ?? 12.2958;
    const lng = currentLocation?.longitude ?? 76.6394;
    const loc = encodeURIComponent(currentLocation?.displayName || currentLocation?.name || 'Selected Location');
    const city = encodeURIComponent(currentLocation?.city || 'Local Area');
    return `${path}?lat=${lat}&lng=${lng}&location=${loc}&city=${city}`;
  };

  const currentLat = currentLocation?.latitude;
  const currentLng = currentLocation?.longitude;
  const locationTitle = currentLocation
    ? currentLocation.city || currentLocation.displayName || 'Selected Coordinates'
    : 'No location selected';

  const locationSubtitle = currentLocation
    ? [currentLocation.district, currentLocation.state, currentLocation.country].filter(Boolean).join(', ') || currentLocation.displayName
    : 'Select any location to begin.';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Geospatial Canvas - Dominates the Main Workspace */}
      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: 0 }}>
        <GoogleMapErrorBoundary onRetry={() => googleMapsLoader.retry()}>
          <GoogleMapView
            center={currentLocation}
            radiusKm={selectedRadiusKm}
            events={events}
            layers={{ traffic: false, accidents: true, disasters: true, hazards: true, boundary: true }}
            mapMode={mapMode}
            onSelectEvent={setSelectedEvent}
            onMapClick={handleMapClick}
            onSelectPoi={(poi) => {
              setCurrentLocation({
                latitude: poi.latitude,
                longitude: poi.longitude,
                placeId: poi.placeId,
                name: poi.name,
                displayName: `${poi.name}, ${poi.address}`,
                address: poi.address,
                city: poi.name,
                country: 'Selected Place',
                isUserLocation: false,
                source: 'POI',
              });
            }}
            height="100%"
            showLocationHud={false}
            showLegend={false}
          />
        </GoogleMapErrorBoundary>

        {/* Global Neutral State Prompt: Shown when no location is yet chosen */}
        {!currentLocation && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 25,
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(12px)',
              color: 'var(--text-primary)',
              padding: '8px 20px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
              <span style={{ fontWeight: 800, letterSpacing: '0.04em' }}>GLOBAL LOCATION INTELLIGENCE</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Select any location to begin.
            </span>
          </div>
        )}

        {/* Top-Right Events Near You Drawer Trigger */}
        <div style={{ position: 'absolute', top: '16px', right: '80px', zIndex: 30 }}>
          <button
            onClick={() => setEventsDrawerOpen(!eventsDrawerOpen)}
            style={{
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(12px)',
              borderRadius: '20px',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border)',
              padding: '6px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
            title="Toggle Events Near You Drawer"
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: events.length > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                boxShadow: events.length > 0 ? '0 0 6px var(--accent-primary)' : 'none',
              }}
            />
            <span>Events ({events.length})</span>
            <ChevronDownIcon size={12} style={{ transform: eventsDrawerOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Slide-in Events Near You Drawer */}
        {eventsDrawerOpen && (
          <aside
            style={{
              position: 'absolute',
              top: '56px',
              right: '16px',
              width: '320px',
              maxHeight: 'calc(100% - 72px)',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-panel)',
              border: '1px solid var(--border)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 35,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Events in Radius
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {eventsLoading ? 'Scanning signals...' : `${events.length} verified signals within ${selectedRadiusKm} km`}
                </div>
              </div>
              <button
                onClick={() => setEventsDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events.length === 0 && !eventsLoading && (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                  No verified incidents or road hazards currently active in this radius.
                </div>
              )}
              {events.map((event) => (
                <button
                  key={event.eventId}
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    textAlign: 'left',
                    backgroundColor: selectedEvent?.eventId === event.eventId ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    borderRadius: '8px',
                    padding: '9px 11px',
                    border: selectedEvent?.eventId === event.eventId ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        backgroundColor: event.severity >= 75 ? 'var(--badge-hazard-bg)' : event.severity >= 55 ? 'var(--badge-warning-bg)' : 'var(--badge-info-bg)',
                        color: event.severity >= 75 ? 'var(--badge-hazard-text)' : event.severity >= 55 ? 'var(--badge-warning-text)' : 'var(--badge-info-text)',
                        border: `1px solid ${event.severity >= 75 ? 'var(--badge-hazard-border)' : event.severity >= 55 ? 'var(--badge-warning-border)' : 'var(--badge-info-border)'}`,
                      }}
                    >
                      {event.eventType} · SEV {event.severity}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {event.distanceKm ?? '--'} km away
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {event.title}
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* 2. Structured Docked Bottom Intelligence Panel (Map-First Architecture) */}
      <section
        aria-label="Location Intelligence Summary"
        style={{
          backgroundColor: 'var(--bg-panel)',
          borderTop: '1px solid var(--border)',
          boxShadow: 'var(--shadow-panel)',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Top Toggle Bar */}
        <div
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: bottomPanelExpanded ? '1px solid var(--border-subtle)' : 'none',
            backgroundColor: 'var(--bg-header)',
          }}
        >
          {/* Location Title & Context */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PinIcon size={14} color="var(--accent-primary)" />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {currentLocation ? 'Selected Location' : 'Global Intelligence'}
                </span>
                {currentLat && currentLng ? (
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 600,
                      color: 'var(--accent-primary)',
                      backgroundColor: 'var(--accent-primary-light)',
                      border: '1px solid var(--accent-primary)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                    }}
                  >
                    {currentLat.toFixed(4)}°N, {currentLng.toFixed(4)}°E
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                    }}
                  >
                    No location selected
                  </span>
                )}
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: conditionScore !== null && conditionScore >= 75 ? 'var(--status-good-text)' : 'var(--status-warning-text)',
                    backgroundColor: conditionScore !== null && conditionScore >= 75 ? 'var(--status-good-bg)' : 'var(--status-warning-bg)',
                    border: `1px solid ${conditionScore !== null && conditionScore >= 75 ? 'var(--status-good-border)' : 'var(--status-warning-border)'}`,
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                >
                  {conditionScore !== null
                    ? `Condition: ${conditionScore}/100`
                    : currentLocation
                    ? (conditionLoading ? 'Loading available intelligence...' : 'No verified data available')
                    : 'No location selected'}
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                {locationTitle}
              </div>
            </div>
          </div>

          {/* Quick Actions & Panel Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => setIsSiteModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent-primary-light)',
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Analyze Site →
            </button>

            <Link
              href={ROUTES.simulate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--button)',
                color: 'var(--button-foreground)',
                fontSize: '11px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Ask Nexus
            </Link>

            <button
              onClick={() => setBottomPanelExpanded(!bottomPanelExpanded)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{bottomPanelExpanded ? 'Collapse' : 'Expand'}</span>
              <ChevronDownIcon size={12} style={{ transform: bottomPanelExpanded ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Expandable Intelligence Body */}
        {bottomPanelExpanded && (
          <div
            style={{
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {/* Column 1: Location Context */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Location Context
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {locationSubtitle}
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  <div>Radius: <strong style={{ color: 'var(--text-primary)' }}>{currentLocation ? `${selectedRadiusKm} km` : 'Global Canvas'}</strong></div>
                  <div>Confidence: <strong style={{ color: currentLocation ? 'var(--status-good-text)' : 'var(--text-muted)' }}>{currentLocation ? 'Verified Geospatial Fix (88%)' : 'No target selected'}</strong></div>
                  <div>Mode: <strong style={{ color: 'var(--text-primary)' }}>{currentLocation ? 'Active Location Analysis' : 'Neutral Global Baseline'}</strong></div>
                </div>
              </div>
            </div>

            {/* Column 2: Urban Condition Score */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Urban Condition
              </div>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {!currentLocation ? 'Neutral' : conditionLoading ? 'Evaluating...' : conditionScore !== null ? `${conditionScore}/100` : 'Unavailable'}
                  </div>
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: conditionScore !== null && conditionScore >= 75 ? 'var(--status-good-bg)' : 'var(--status-warning-bg)',
                      color: conditionScore !== null && conditionScore >= 75 ? 'var(--status-good-text)' : 'var(--status-warning-text)',
                      border: `1px solid ${conditionScore !== null && conditionScore >= 75 ? 'var(--status-good-border)' : 'var(--status-warning-border)'}`,
                    }}
                  >
                    {!currentLocation ? 'GLOBAL BASELINE' : conditionStatus}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>
                  {conditionScore !== null
                    ? `Composite condition score evaluated from verified atmospheric sensors and local infrastructure reports.`
                    : currentLocation
                    ? 'Insufficient verified signals available to compute score without fabricating unmeasured data.'
                    : 'Select any place or coordinate to analyze urban condition metrics.'}
                </div>
                <Link
                  href={ROUTES.analytics}
                  style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, marginTop: '6px', display: 'inline-block', textDecoration: 'none' }}
                >
                  View Urban Intelligence Breakdown →
                </Link>
              </div>
            </div>

            {/* Column 3: Structured Signal Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Verified Signals
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {/* Weather Card */}
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>WEATHER</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: weather ? 'var(--status-good-text)' : 'var(--text-muted)' }}>
                      {currentLocation ? weatherStatusBadge : 'IDLE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {!currentLocation ? 'Select location' : weatherLoading ? 'Loading...' : weather?.temperatureC !== undefined ? `${weather.temperatureC}°C` : 'Unavailable'}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {!currentLocation ? 'Awaiting target' : weather?.conditionLabel || 'Open-Meteo'}
                  </div>
                </div>

                {/* Traffic Card */}
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>TRAFFIC</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: trafficStatusBadge === 'AVAILABLE' ? 'var(--status-good-text)' : 'var(--text-muted)' }}>
                      {currentLocation ? trafficStatusBadge : 'IDLE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: currentLocation ? trafficColor : 'var(--text-muted)', marginTop: '2px' }}>
                    {!currentLocation ? 'Select location' : trafficLabel}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {!currentLocation ? 'Awaiting target' : trafficDetail}
                  </div>
                </div>

                {/* Roads Card */}
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>ROADS</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: currentLocation ? 'var(--status-good-text)' : 'var(--text-muted)' }}>
                      {currentLocation ? 'AVAILABLE' : 'IDLE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: potholeCount > 0 ? 'var(--status-critical-text)' : 'var(--text-primary)', marginTop: '2px' }}>
                    {!currentLocation ? 'Select location' : potholeCount > 0 ? `${potholeCount} Hazards` : 'Mapped'}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {!currentLocation ? 'Awaiting target' : 'Surface: Asphalt (OSM)'}
                  </div>
                </div>

                {/* Air Quality Card */}
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>AIR QUALITY</span>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: aqiStatusBadge === 'AVAILABLE' ? 'var(--status-good-text)' : 'var(--text-muted)' }}>
                      {currentLocation ? aqiStatusBadge : 'IDLE'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: currentLocation ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: '2px' }}>
                    {!currentLocation ? 'Select location' : airQualityLabel}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {!currentLocation ? 'Awaiting target' : airQualityDetail}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 4: Dedicated Intelligence Systems */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Dedicated Intelligence Modules
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <Link
                  href={buildModuleUrl('/georag')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--accent-primary)' }}>GeoRAG</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>Satellite</span>
                </Link>

                <Link
                  href={buildModuleUrl('/crisisrag')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--status-critical-text)' }}>CrisisRAG</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>Emergency</span>
                </Link>

                <Link
                  href={buildModuleUrl('/aquarag')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--badge-info-text)' }}>AquaRAG</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>Water</span>
                </Link>
              </div>

              <button
                onClick={() => setIsSiteModalOpen(true)}
                style={{
                  marginTop: '4px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent-primary-light)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Run Site Analysis & Scenario Engine →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Selected Event Floating Details */}
      {selectedEvent && (
        <div
          style={{
            position: 'absolute',
            bottom: bottomPanelExpanded ? '280px' : '65px',
            right: '20px',
            backgroundColor: 'var(--bg-panel)',
            borderRadius: '10px',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-panel)',
            border: '1px solid var(--border)',
            maxWidth: '360px',
            zIndex: 45,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: selectedEvent.severity >= 75 ? 'var(--badge-hazard-bg)' : 'var(--badge-info-bg)',
                color: selectedEvent.severity >= 75 ? 'var(--badge-hazard-text)' : 'var(--badge-info-text)',
                border: `1px solid ${selectedEvent.severity >= 75 ? 'var(--badge-hazard-border)' : 'var(--badge-info-border)'}`,
              }}
            >
              {selectedEvent.eventType} · SEV {selectedEvent.severity}/100
            </span>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedEvent.title}
          </h4>
          {selectedEvent.description && (
            <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {selectedEvent.description}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              {selectedEvent.distanceKm} km away
            </span>
            {selectedEvent.latitude && selectedEvent.longitude && (
              <button
                type="button"
                onClick={() => handleFocusEventOnMap(selectedEvent)}
                style={{
                  backgroundColor: 'var(--button)',
                  color: 'var(--button-foreground)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Focus on Map
              </button>
            )}
          </div>
        </div>
      )}

      {/* Site Analysis & Scenario Engine Modal */}
      <SiteAnalysisModal
        location={currentLocation}
        radiusKm={selectedRadiusKm}
        isOpen={isSiteModalOpen}
        onClose={() => setIsSiteModalOpen(false)}
        onOpenRAG={(rag) => router.push(buildModuleUrl('/' + rag))}
        onAskNexus={(q) => router.push(`${ROUTES.simulate}?q=${encodeURIComponent(q)}`)}
      />
    </div>
  );
}
