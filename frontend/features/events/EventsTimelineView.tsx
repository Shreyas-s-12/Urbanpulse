'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocationStore } from '@/stores/useLocationStore';
import { useEventHistory } from '@/hooks/useEventHistory';
import { UnifiedCityEvent } from '@shared/types';
import { AlertTriangleIcon, SatelliteDishIcon, MapIcon, CheckIcon } from '@/components/common/Icons';

function matchesCategory(eventType: string, filter: string): boolean {
  if (!filter || filter === 'ALL') return true;
  const t = (eventType || '').toUpperCase().replace(/[\s_-]+/g, '_');
  const f = filter.toUpperCase().replace(/[\s_-]+/g, '_');
  if (t === f) return true;
  if (f === 'WEATHER_ALERT') {
    return ['WEATHER_ALERT', 'WEATHER', 'STORM', 'CYCLONE', 'THUNDERSTORM', 'HEAVY_RAIN', 'AIR_QUALITY_ALERT'].includes(t);
  }
  if (f === 'TRAFFIC') {
    return ['TRAFFIC', 'ACCIDENT', 'ROAD_CLOSURE', 'CONGESTION'].includes(t);
  }
  if (f === 'EARTHQUAKE') {
    return ['EARTHQUAKE', 'SEISMIC'].includes(t);
  }
  return false;
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.max(0, Math.round(diffMs / (1000 * 60)));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return '';
  }
}

export default function EventsTimelineView() {
  const router = useRouter();
  const { currentLocation, selectedRadiusKm, setCurrentLocation } = useLocationStore();
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const centerLat = currentLocation ? currentLocation.latitude : null;
  const centerLon = currentLocation ? currentLocation.longitude : null;
  const cityName = currentLocation?.city || (currentLocation ? 'Selected Coordinates' : 'Search for Location');

  const { events, loading, error, status, providersChecked } = useEventHistory(
    centerLat,
    centerLon,
    selectedRadiusKm,
    selectedFilter === 'ALL' ? undefined : selectedFilter,
    24
  );

  const filterTabs = [
    'ALL',
    'TRAFFIC',
    'WEATHER_ALERT',
    'FLOOD',
    'EARTHQUAKE',
    'POTHOLE',
    'THEFT',
    'FALLEN_TREE',
    'FIRE',
  ];

  const filteredEvents = selectedFilter === 'ALL'
    ? events
    : events.filter((e) => matchesCategory(e.eventType, selectedFilter));

  const handleViewOnMap = (ev: UnifiedCityEvent) => {
    if (currentLocation) {
      setCurrentLocation({
        ...currentLocation,
        latitude: ev.latitude,
        longitude: ev.longitude,
        displayName: `${ev.title} (${cityName})`,
      });
    }
    router.push(`/map?lat=${ev.latitude}&lng=${ev.longitude}`);
  };

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: 'var(--bg-app)',
        padding: '32px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              CIVIC & ENVIRONMENTAL SIGNALS
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: status === 'AVAILABLE' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-surface)',
                color: status === 'AVAILABLE' ? '#16A34A' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {loading ? 'AUDITING...' : status}
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', letterSpacing: '-0.02em' }}>
            24-Hour Intelligence Timeline
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            Chronological audit of verified disruptions, hazards, and infrastructure telemetry within {selectedRadiusKm} km of {cityName}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              height: '32px',
              padding: '0 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-xs)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {filteredEvents.length} {filteredEvents.length === 1 ? 'Event' : 'Events'} Logged
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {filterTabs.map((tab) => {
          const isSelected = selectedFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => setSelectedFilter(tab)}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: isSelected ? 'var(--text-primary)' : 'var(--bg-surface)',
                color: isSelected ? 'var(--bg-app)' : 'var(--text-secondary)',
                border: isSelected ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.replace('_', ' ')}
            </button>
          );
        })}
      </div>

      {/* Chronological Timeline Grid / States */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
        {loading ? (
          /* Loading State */
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              padding: '56px 32px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--accent-primary)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Scanning Verified Sensor & Event Feeds...
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '480px', lineHeight: 1.5 }}>
              Aggregating live USGS seismic data, Open-Meteo meteorological and air quality records, and Google Routes corridor telemetry within {selectedRadiusKm} km of {cityName}.
            </p>
          </div>
        ) : error ? (
          /* Error State */
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              padding: '48px 32px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangleIcon size={26} color="#EF4444" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#EF4444' }}>
              Unable to Retrieve Event Telemetry
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '460px', lineHeight: 1.5 }}>
              {error}
            </p>
          </div>
        ) : status === 'NO_COVERAGE' ? (
          /* No Coverage State */
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              padding: '48px 32px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <SatelliteDishIcon size={26} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              No Verified Event Feed Currently Covers This Location
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.5 }}>
              Continuous sensor monitoring, official municipal dispatch, and real-time civic streams are currently unconfigured for the coordinates around {cityName}.
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          /* Empty State: Either verified zero events or zero in selected category */
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              padding: '48px 32px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10B981',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              <CheckIcon size={12} color="#10B981" />
              <span>24-HOUR AUDIT VERIFIED</span>
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {events.length === 0
                ? `0 Events Logged in the Last 24 Hours`
                : `No ${selectedFilter.replace('_', ' ')} Events Registered`}
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '540px', lineHeight: 1.6 }}>
              {events.length === 0
                ? `No verified disruptions, environmental hazards, or civic incidents were recorded within ${selectedRadiusKm} km of ${cityName} during the last 24 hours.`
                : `No events in the "${selectedFilter.replace('_', ' ')}" category occurred within ${selectedRadiusKm} km of ${cityName}. There are ${events.length} event(s) recorded in other categories.`}
            </p>

            {providersChecked.length > 0 && (
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Live Feeds Audited:</span>
                {providersChecked.map((provider) => (
                  <span
                    key={provider}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 500,
                    }}
                  >
                    <CheckIcon size={11} color="#10B981" />
                    <span>{provider}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Verified Events List */
          filteredEvents.map((ev) => {
            const timeFormatted = new Date(ev.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const relativeTime = formatRelativeTime(ev.timestamp);

            return (
              <div
                key={ev.eventId}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                  padding: '20px 24px',
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'flex-start',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Time Indicator */}
                <div style={{ width: '80px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {timeFormatted}
                  </div>
                  {relativeTime && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {relativeTime}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--accent-primary)',
                      marginTop: '6px',
                      backgroundColor: 'var(--bg-app)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                      display: 'inline-block',
                    }}
                  >
                    {ev.distanceKm !== undefined ? `${ev.distanceKm} km` : 'Near center'}
                  </div>
                </div>

                {/* Event Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor:
                            ev.severity >= 75
                              ? 'var(--severity-critical-bg)'
                              : ev.severity >= 55
                              ? 'var(--severity-high-bg)'
                              : 'var(--severity-moderate-bg)',
                          color:
                            ev.severity >= 75
                              ? 'var(--severity-critical)'
                              : ev.severity >= 55
                              ? 'var(--severity-high)'
                              : 'var(--severity-moderate)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {ev.eventType.replace('_', ' ')}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-secondary)',
                          fontWeight: 600,
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        STATUS: {ev.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                      <span>
                        Severity: <strong style={{ color: 'var(--text-primary)' }}>{ev.severity}/100</strong>
                      </span>
                      <span>
                        Confidence: <strong style={{ color: 'var(--text-primary)' }}>{ev.confidence}%</strong>
                      </span>
                      {ev.userImpact && (
                        <span>
                          Impact: <strong style={{ color: 'var(--text-primary)' }}>{ev.userImpact}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', lineHeight: 1.4 }}>
                    {ev.title}
                  </h3>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                    {ev.description}
                  </p>

                  {/* Special Earthquake scientific metrics vs impact */}
                  {ev.eventType === 'EARTHQUAKE' && ev.metadata && (
                    <div
                      style={{
                        marginTop: '10px',
                        backgroundColor: 'var(--bg-app)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '20px',
                        fontSize: '12px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Scientific Measurement: </span>
                        <strong>Magnitude {ev.metadata.magnitude} (Depth {ev.metadata.depthKm} km)</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>UrbanPulse Shaking Impact: </span>
                        <strong style={{ color: 'var(--severity-high)' }}>{ev.metadata.impactRisk || ev.userImpact}</strong>
                      </div>
                    </div>
                  )}

                  {/* Special Traffic Delay metrics */}
                  {ev.eventType === 'TRAFFIC' && ev.metadata && (
                    <div
                      style={{
                        marginTop: '10px',
                        backgroundColor: 'var(--bg-app)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '20px',
                        fontSize: '12px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Corridor Delay: </span>
                        <strong>+{ev.metadata.delayMinutes || 0} minutes</strong>
                      </div>
                      {ev.metadata.delayRatio && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Delay Ratio: </span>
                          <strong>{ev.metadata.delayRatio}x static travel time</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Special Weather & Air Quality metrics */}
                  {ev.eventType === 'WEATHER_ALERT' && ev.metadata && (
                    <div
                      style={{
                        marginTop: '10px',
                        backgroundColor: 'var(--bg-app)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '20px',
                        fontSize: '12px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {ev.metadata.precipitationMm !== undefined && ev.metadata.precipitationMm > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Precipitation Rate: </span>
                          <strong>{ev.metadata.precipitationMm} mm/h</strong>
                        </div>
                      )}
                      {ev.metadata.windSpeedKmh !== undefined && ev.metadata.windSpeedKmh > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Wind Velocity: </span>
                          <strong>{ev.metadata.windSpeedKmh} km/h</strong>
                        </div>
                      )}
                      {ev.metadata.aqiValue !== undefined && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Air Quality: </span>
                          <strong>{ev.metadata.aqiValue} ({ev.metadata.category})</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginTop: '12px',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>Source: <strong>{ev.source}</strong> ({ev.sourceId || 'Verified Telemetry'})</span>
                      <span>ID: {ev.canonicalEventId || ev.eventId}</span>
                    </div>

                    <button
                      onClick={() => handleViewOnMap(ev)}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <MapIcon size={12} color="var(--accent-primary)" />
                      <span>View on Map</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
