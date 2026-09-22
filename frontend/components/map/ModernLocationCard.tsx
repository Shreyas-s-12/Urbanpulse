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
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-panel)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        animation: 'fadeIn 0.2s ease-out',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
            {title}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
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
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {street}
          </span>
        )}
        {locality && (
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {locality}
          </span>
        )}
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {region || formatted}
        </span>
      </div>

      {/* Accuracy & Quality Metrics */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface-secondary)',
          borderRadius: '8px',
          padding: '7px 10px',
          border: '1px solid var(--border-subtle)',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>PRECISION</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {accMeters ? `±${accMeters}m` : '±15m'} ({confidenceTier})
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>FRESHNESS</span>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
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
            backgroundColor: 'var(--button)',
            color: 'var(--button-foreground)',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 0',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--button)')}
        >
          Center on me
        </button>

        <button
          onClick={() => {
            onClose();
            startPinAdjustment();
          }}
          style={{
            backgroundColor: 'var(--button-secondary)',
            color: 'var(--button-secondary-foreground)',
            border: '1px solid var(--button-secondary-border)',
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
              backgroundColor: 'var(--accent-primary-light)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)',
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
