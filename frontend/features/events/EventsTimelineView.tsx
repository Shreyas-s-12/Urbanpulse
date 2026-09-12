'use client';

import React, { useState } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { useEventHistory } from '@/hooks/useEventHistory';
import { EventCategory, UnifiedCityEvent } from '@shared/types';

export default function EventsTimelineView() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const centerLat = currentLocation ? currentLocation.latitude : null;
  const centerLon = currentLocation ? currentLocation.longitude : null;
  const cityName = currentLocation?.city || (currentLocation ? 'Coordinates Selected' : 'Search for Location');

  const { events, loading } = useEventHistory(
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
    : events.filter((e) => e.eventType === selectedFilter);

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
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
            CIVIC & ENVIRONMENTAL SIGNALS
          </span>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
            24-Hour Intelligence Timeline
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Chronological audit of verified disruptions, hazards, and infrastructure changes within {selectedRadiusKm} km of {cityName}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {filteredEvents.length} Events Logged
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedFilter(tab)}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: selectedFilter === tab ? 'var(--text-primary)' : 'var(--bg-surface)',
              color: selectedFilter === tab ? '#FFFFFF' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Chronological Timeline Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
        {filteredEvents.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              padding: '48px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            No events registered in this category within the selected {selectedRadiusKm} km radius.
          </div>
        ) : (
          filteredEvents.map((ev, index) => {
            const timeFormatted = new Date(ev.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={ev.eventId}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                  padding: '18px 22px',
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Time Indicator */}
                <div style={{ width: '70px', flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {timeFormatted}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {ev.distanceKm} km
                  </div>
                </div>

                {/* Event Body */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
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
                        }}
                      >
                        {ev.eventType}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                      >
                        STATUS: {ev.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span>
                        Severity: <strong>{ev.severity}/100</strong>
                      </span>
                      <span>
                        Confidence: <strong>{ev.confidence}%</strong>
                      </span>
                      <span>
                        Impact: <strong>{ev.userImpact}</strong>
                      </span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                    {ev.title}
                  </h3>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
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
                        gap: '24px',
                        fontSize: '12px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Scientific Measurement: </span>
                        <strong>Magnitude {ev.metadata.magnitude} (Depth {ev.metadata.depthKm} km)</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>UrbanPulse Impact Risk: </span>
                        <strong style={{ color: 'var(--severity-high)' }}>{ev.metadata.impactRisk}</strong>
                      </div>
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
                      paddingTop: '8px',
                    }}
                  >
                    <span>Source: <strong>{ev.source}</strong> ({ev.sourceId || 'Automated Ingestion'})</span>
                    <span>Canonical ID: {ev.canonicalEventId || ev.eventId}</span>
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
