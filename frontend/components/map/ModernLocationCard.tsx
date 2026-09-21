'use client';

import React from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { locationService } from '@/services/locationService';

interface ModernLocationCardProps {
  onClose: () => void;
  onCenterOnMe: () => void;
}

export default function ModernLocationCard({ onClose, onCenterOnMe }: ModernLocationCardProps) {
  const {
    currentLocation,
    currentDeviceLocation,
    gpsAccuracyMeters,
    activeSource,
    locationAccuracyState,
    startPinAdjustment,
    switchToDeviceLocation,
    activeLocationContext,
  } = useLocationStore();

  const isManual = activeSource === 'MANUAL';
  const isDevice = activeSource === 'BROWSER_GEOLOCATION' || activeSource === 'DEVICE_GPS';
  const isNetwork = activeSource === 'NETWORK';
  const isStale = locationAccuracyState === 'STALE';

  const title = isManual
    ? 'MANUAL PIN LOCATION'
    : isNetwork
    ? 'APPROXIMATE NETWORK AREA'
    : isStale
    ? 'LAST KNOWN LOCATION'
    : 'CURRENT DEVICE LOCATION';

  const street = currentDeviceLocation?.addressMetadata?.street || currentLocation?.district || null;
  const locality = currentDeviceLocation?.addressMetadata?.locality || currentDeviceLocation?.addressMetadata?.neighborhood || currentLocation?.city || null;
  const region = [currentDeviceLocation?.addressMetadata?.state, currentDeviceLocation?.addressMetadata?.country || currentLocation?.country].filter(Boolean).join(', ');
  const formatted = currentDeviceLocation?.addressMetadata?.formattedAddress || currentLocation?.displayName || `${currentLocation?.latitude.toFixed(4)}°, ${currentLocation?.longitude.toFixed(4)}°`;

  const accMeters = gpsAccuracyMeters ? Math.round(gpsAccuracyMeters) : null;
  const confidenceTier =
    accMeters && accMeters <= 25
      ? 'High confidence'
      : accMeters && accMeters <= 75
      ? 'Good confidence'
      : 'Approximate';

  const freshness = activeLocationContext?.freshnessText || 'Updated just now';

  const handleImprove = async () => {
    try {
      await locationService.requestDeviceLocation();
      switchToDeviceLocation();
    } catch {}
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '60px',
        right: '16px',
        zIndex: 36,
        width: '310px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(226, 232, 240, 0.95)',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.04)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        animation: 'fadeIn 0.2s ease-out',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
          <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: '#64748B' }}>
            {title}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Address Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {street && (
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
            {street}
          </span>
        )}
        {locality && (
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
            {locality}
          </span>
        )}
        <span style={{ fontSize: '11.5px', color: '#64748B' }}>
          {region || formatted}
        </span>
      </div>

      {/* Accuracy & Quality Metrics */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
          padding: '7px 10px',
          border: '1px solid #EDF2F7',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#64748B', fontSize: '10px' }}>PRECISION</span>
          <span style={{ fontWeight: 700, color: '#0F172A' }}>
            {accMeters ? `±${accMeters}m` : '±15m'} ({confidenceTier})
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
          <span style={{ color: '#64748B', fontSize: '10px' }}>FRESHNESS</span>
          <span style={{ fontWeight: 600, color: '#475569' }}>
            {freshness}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
        <button
          onClick={onCenterOnMe}
          style={{
            flex: 1,
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 0',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1D4ED8')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
        >
          Center on me
        </button>

        <button
          onClick={() => {
            onClose();
            startPinAdjustment();
          }}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#334155',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '7px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Adjust Pin location"
        >
          Adjust pin
        </button>

        {isDevice && (
          <button
            onClick={handleImprove}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#2563EB',
              border: '1px solid #BFDBFE',
              borderRadius: '6px',
              padding: '7px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Refine GPS multi-sample readings"
          >
            Refine
          </button>
        )}
      </div>
    </div>
  );
}
