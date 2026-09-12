'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UnifiedCityEvent } from '@shared/types';
import GoogleMapView from '@/components/map/GoogleMapView';
import { useMapContext } from '@/context/MapContext';
import { useLiveUpdates } from '@/hooks/useLiveUpdates';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';
import { useUrbanCondition } from '@/hooks/useUrbanCondition';
import { useWeather } from '@/hooks/useWeather';
import { useLocationStore } from '@/stores/useLocationStore';

export default function MainScreen() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();
  const { mapMode } = useMapContext();
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCityEvent | null>(null);

  const { weather, loading: weatherLoading } = useWeather(
    currentLocation?.latitude,
    currentLocation?.longitude
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

  useLiveUpdates(
    currentLocation?.latitude,
    currentLocation?.longitude,
    selectedRadiusKm,
    (newEvent) => {
      setEvents((prev) => [newEvent, ...prev.filter((event) => event.eventId !== newEvent.eventId)]);
    }
  );

  const fallbackConditionScore = events.length > 0 ? Math.max(20, 100 - events.length * 5) : null;
  const conditionScore = condition?.overallScore ?? fallbackConditionScore;
  const conditionStatus =
    condition?.label && condition.label !== 'UNAVAILABLE'
      ? condition.label
      : conditionScore !== null
        ? conditionScore >= 75
          ? 'FAVORABLE'
          : 'MODERATE RISK'
        : 'UNAVAILABLE';

  const trafficCount = events.filter((event) => event.eventType === 'TRAFFIC' || event.eventType === 'ACCIDENT').length;
  const trafficLabel = trafficCount > 2 ? 'Heavy' : trafficCount > 0 ? 'Moderate' : 'Unavailable';
  const trafficColor =
    trafficCount > 2 ? 'var(--severity-critical)' : trafficCount > 0 ? '#F59E0B' : 'var(--text-muted)';
  const potholeCount = events.filter((event) => event.eventType === 'POTHOLE').length;
  const airQualityStatus =
    weather?.airQualityStatus && weather.airQualityStatus !== 'Unavailable'
      ? weather.airQualityStatus
      : 'Unavailable';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <GoogleMapView
        center={currentLocation}
        radiusKm={selectedRadiusKm}
        events={events}
        layers={{ traffic: true, disasters: true, hazards: true, boundary: true }}
        mapMode={mapMode}
        onSelectEvent={setSelectedEvent}
        height="100%"
      />

      <aside
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          width: '320px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '18px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Local Intelligence
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {currentLocation ? currentLocation.city || 'Coordinates Selected' : 'Search for a location'}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {currentLocation ? currentLocation.displayName : 'Use My Location or search above'}
            </div>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-primary-light)',
              color: 'var(--accent-primary)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {selectedRadiusKm} km
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-app)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Urban Condition
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {conditionLoading ? '--' : conditionScore ?? '--'}{' '}
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor:
                  conditionScore !== null && conditionScore >= 75 ? 'var(--severity-low-bg)' : 'var(--severity-high-bg)',
                color:
                  conditionScore !== null && conditionScore >= 75 ? 'var(--severity-low)' : 'var(--severity-high)',
              }}
            >
              {conditionStatus}
            </span>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {eventsLoading ? 'Scanning...' : `${events.length} active signal${events.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <MetricTile
            label="Weather"
            value={weatherLoading ? 'Loading...' : weather?.temperatureC || '--'}
            detail={weather?.conditionLabel || 'Unavailable'}
            valueColor="var(--text-primary)"
          />
          <MetricTile
            label="Traffic"
            value={trafficLabel}
            detail={trafficCount > 0 ? `${trafficCount} corridor slowdown${trafficCount === 1 ? '' : 's'}` : 'No verified feed'}
            valueColor={trafficColor}
          />
          <MetricTile
            label="Roads"
            value={potholeCount > 0 ? `${potholeCount}` : 'Unavailable'}
            detail={potholeCount > 0 ? 'Pothole alerts' : 'No verified feed'}
            valueColor="var(--text-primary)"
          />
          <MetricTile
            label="Air Quality"
            value={airQualityStatus.split(' ')[0]}
            detail={airQualityStatus}
            valueColor="var(--accent-primary)"
          />
        </div>

        <Link
          href="/urban-condition"
          style={{
            fontSize: '12px',
            color: 'var(--accent-blue)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          View detailed urban breakdown &rarr;
        </Link>
      </aside>

      <aside
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '360px',
          maxHeight: 'calc(100% - 140px)',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '18px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Events Near You
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {eventsLoading ? 'Loading signals...' : `${events.length} incidents within ${selectedRadiusKm} km`}
            </div>
          </div>
          <Link href="/events" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-blue)' }}>
            24h Timeline &rarr;
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.length === 0 && !eventsLoading && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No verified incidents available in this radius.
            </div>
          )}
          {events.map((event) => (
            <button
              key={event.eventId}
              onClick={() => setSelectedEvent(event)}
              style={{
                textAlign: 'left',
                backgroundColor: selectedEvent?.eventId === event.eventId ? 'var(--bg-surface-secondary)' : 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.1s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor:
                      event.severity >= 75
                        ? 'var(--severity-critical-bg)'
                        : event.severity >= 55
                          ? 'var(--severity-high-bg)'
                          : 'var(--severity-moderate-bg)',
                    color:
                      event.severity >= 75
                        ? 'var(--severity-critical)'
                        : event.severity >= 55
                          ? 'var(--severity-high)'
                          : 'var(--severity-moderate)',
                  }}
                >
                  {event.eventType} | SEVERITY {event.severity}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {event.distanceKm ?? '--'} km away
                </span>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {event.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '6px',
                }}
              >
                <span>Src: {event.source}</span>
                <span style={{ fontWeight: 600 }}>{event.confidence}% conf</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          right: '20px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-panel)',
          border: '1px solid var(--border-subtle)',
          padding: '14px 20px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
              boxShadow: '0 0 8px var(--accent-primary)',
            }}
          />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Situation Briefing
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedEvent
                ? `Focus: ${selectedEvent.title} (${selectedEvent.distanceKm ?? '--'} km away)`
                : currentLocation
                  ? `Monitoring ${selectedRadiusKm} km around ${currentLocation.city || 'selected coordinates'}.`
                  : 'Select a location to start live intelligence monitoring.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link
            href="/routes"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent-blue)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Plan a Journey
          </Link>
          <Link
            href="/copilot"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Ask Copilot
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  valueColor,
}: {
  label: string;
  value: string;
  detail: string;
  valueColor: string;
}) {
  return (
    <div style={{ backgroundColor: 'var(--bg-app)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: valueColor, marginTop: '2px' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{detail}</div>
    </div>
  );
}
