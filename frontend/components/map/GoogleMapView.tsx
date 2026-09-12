"use client";

import React from 'react';
import { GoogleMap, Marker, Circle, TrafficLayer, useJsApiLoader } from '@react-google-maps/api';
import { ResolvedLocation, UnifiedCityEvent } from '@shared/types';

interface GoogleMapViewProps {
  center: ResolvedLocation | null;
  radiusKm: number;
  events: UnifiedCityEvent[];
  layers: { traffic: boolean; disasters: boolean; hazards: boolean; boundary: boolean };
  mapMode: 'roadmap' | 'satellite' | 'terrain';
  onSelectEvent?: (event: UnifiedCityEvent) => void;
  height?: string;
}

const mapContainerStyle = (height?: string) => ({
  width: '100%',
  height: height ?? '100%',
});

export default function GoogleMapView({
  center,
  radiusKm,
  events,
  layers,
  mapMode,
  onSelectEvent,
  height,
}: GoogleMapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? '',
    libraries: ['places'],
  });

  if (loadError) {
    return <div style={{ color: 'red', padding: '16px' }}>Map could not be loaded – please verify the Google Maps API key configuration.</div>;
  }

  if (!isLoaded) {
    return <div style={{ padding: '16px' }}>Loading map…</div>;
  }

  const mapCenter = center ? { lat: center.latitude, lng: center.longitude } : { lat: 0, lng: 0 };

  const zoom = Math.max(5, Math.min(15, 12 - Math.log2(radiusKm / 10)));

  const handleMarkerClick = (event: UnifiedCityEvent) => {
    if (onSelectEvent) onSelectEvent(event);
  };

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle(height)}
      center={mapCenter}
      zoom={zoom}
      mapTypeId={mapMode}
    >
      {/* Intelligence radius */}
      <Circle
        center={mapCenter}
        radius={radiusKm * 1000}
        options={{
          fillColor: '#13B887',
          fillOpacity: 0.03,
          strokeColor: '#13B887',
          strokeOpacity: 0.5,
          strokeWeight: 1.5,
        }}
      />
      {/* Traffic layer */}
      {layers.traffic && <TrafficLayer />}
      {/* Event markers */}
      {events.map((ev) => (
        <Marker
          key={ev.eventId}
          position={{ lat: ev.latitude, lng: ev.longitude }}
          onClick={() => handleMarkerClick(ev)}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: ev.severity >= 75 ? 9 : ev.severity >= 55 ? 7 : 5,
            fillColor:
              ev.severity >= 75 ? '#EF4444' : ev.severity >= 55 ? '#F59E0B' : '#13B887',
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: '#FFFFFF',
          }}
        />
      ))}
    </GoogleMap>
  );
}
