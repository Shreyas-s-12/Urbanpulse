'use client';

import React, { useState, useEffect } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { eventService } from '@/services/eventService';
import GoogleMapView from '@/components/map/GoogleMapView';
import { UnifiedCityEvent } from '@shared/types';
import { useMapContext } from '@/context/MapContext';

import { locationService } from '@/services/locationService';

export default function MapPage() {
  const { currentLocation, setCurrentLocation, selectedRadiusKm } = useLocationStore();
  const { mapMode, setMapMode } = useMapContext();
  const [events, setEvents] = useState<UnifiedCityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCityEvent | null>(null);

  // Layer toggles
  const [layers, setLayers] = useState({
    traffic: true,
    accidents: true,
    disasters: true,
    hazards: true,
    boundary: true,
  });

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

  useEffect(() => {
    if (!currentLocation) return;
    const fetchEvents = async () => {
      const evts = await eventService.getEventsWithinRadius(
        currentLocation.latitude,
        currentLocation.longitude,
        selectedRadiusKm
      );
      setEvents(evts);
    };
    fetchEvents();
  }, [currentLocation, selectedRadiusKm]);

  const filteredEvents = events.filter((e) => {
    if (!layers.accidents && (e.eventType === 'TRAFFIC' || e.eventType === 'ACCIDENT')) return false;
    if (!layers.disasters && (e.eventType === 'EARTHQUAKE' || e.eventType === 'FLOOD' || e.eventType === 'FIRE')) return false;
    if (!layers.hazards && (e.eventType === 'POTHOLE' || e.eventType === 'FALLEN_TREE' || e.eventType === 'THEFT')) return false;
    return true;
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GoogleMapView
        center={currentLocation}
        radiusKm={selectedRadiusKm}
        events={filteredEvents}
        layers={layers}
        trafficEnabled={layers.traffic}
        mapMode={mapMode}
        onSelectEvent={setSelectedEvent}
        onMapClick={handleMapClick}
        height="100%"
      />

      {/* Floating Layer Controls Panel */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minWidth: '220px',
          zIndex: 30,
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          MAP INTELLIGENCE LAYERS
        </div>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={layers.traffic}
              onChange={(e) => setLayers({ ...layers, traffic: e.target.checked })}
            />
            Traffic (Google Live)
          </span>
          {layers.traffic && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                backgroundColor: 'var(--accent-primary-light)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              LIVE
            </span>
          )}
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={layers.accidents}
            onChange={(e) => setLayers({ ...layers, accidents: e.target.checked })}
          />
          Accidents & Disruptions
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={layers.disasters}
            onChange={(e) => setLayers({ ...layers, disasters: e.target.checked })}
          />
          Disasters (Quakes & Floods)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={layers.hazards}
            onChange={(e) => setLayers({ ...layers, hazards: e.target.checked })}
          />
          Road Hazards & Potholes
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={layers.boundary}
            onChange={(e) => setLayers({ ...layers, boundary: e.target.checked })}
          />
          {selectedRadiusKm} km Radial Boundary
        </label>
        <div style={{ marginTop: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="mapMode"
              value="roadmap"
              checked={mapMode === 'roadmap'}
              onChange={() => setMapMode('roadmap')}
            />
            Map
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="mapMode"
              value="satellite"
              checked={mapMode === 'satellite'}
              onChange={() => setMapMode('satellite')}
            />
            Satellite
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="mapMode"
              value="terrain"
              checked={mapMode === 'terrain'}
              onChange={() => setMapMode('terrain')}
            />
            Terrain
          </label>
        </div>
      </div>

      {/* Selected Event Details Card */}
      {selectedEvent && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 24px',
            boxShadow: 'var(--shadow-panel)',
            border: '1px solid var(--border-subtle)',
            maxWidth: '440px',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--severity-high-bg)',
                color: 'var(--severity-high)',
              }}
            >
              {selectedEvent.eventType} • SEVERITY {selectedEvent.severity}/100
            </span>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}
            >
              ✕
            </button>
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedEvent.title}
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
            {selectedEvent.description}
          </p>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
            <span>Distance: <strong>{selectedEvent.distanceKm} km</strong></span>
            <span>Confidence: <strong>{selectedEvent.confidence}%</strong></span>
            <span>Source: <strong>{selectedEvent.source}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
