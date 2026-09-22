'use client';

import React, { useState, useEffect } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';

export default function ModernLocationStatusBadge() {
  const {
    locationAccuracyState,
    gpsAccuracyMeters,
    activeSource,
    conflictStatus,
    activeLocationContext,
  } = useLocationStore();

  const isSelectingMapLocation = useLocationStore((s) => s.isSelectingMapLocation || s.isChoosingOnMap);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (locationAccuracyState === 'LOCATING' || locationAccuracyState === 'IMPROVING') {
      setVisible(true);
    } else if (locationAccuracyState === 'READY' || locationAccuracyState === 'LOCKED' || locationAccuracyState === 'APPROXIMATE') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(t);
    } else if (locationAccuracyState === 'DENIED' || locationAccuracyState === 'TIMEOUT' || locationAccuracyState === 'UNAVAILABLE' || locationAccuracyState === 'ERROR') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    } else if (conflictStatus?.hasConflict) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [locationAccuracyState, conflictStatus?.hasConflict]);

  if (!visible || isSelectingMapLocation) return null;

  const isLocating = locationAccuracyState === 'LOCATING';
  const isImproving = locationAccuracyState === 'IMPROVING';
  const isReady = locationAccuracyState === 'READY' || locationAccuracyState === 'LOCKED' || locationAccuracyState === 'FOUND';
  const isApprox = locationAccuracyState === 'APPROXIMATE';
  const isDenied = locationAccuracyState === 'DENIED';
  const isTimeout = locationAccuracyState === 'TIMEOUT';
  const isUnavailable = locationAccuracyState === 'UNAVAILABLE';
  const isError = locationAccuracyState === 'ERROR';
  const isStale = locationAccuracyState === 'STALE';
  const hasConflict = conflictStatus?.hasConflict;

  let title = 'LOCATING...';
  let subtitle = 'Finding your most accurate position...';
  let badgeColor = '#2563EB';

  if (hasConflict) {
    title = 'LOCATION SIGNALS DIFFER';
    subtitle = conflictStatus.message || 'Trying to improve accuracy...';
    badgeColor = '#F59E0B';
  } else if (isLocating) {
    title = 'LOCATING...';
    subtitle = 'Acquiring device GPS position...';
    badgeColor = '#2563EB';
  } else if (isImproving) {
    title = 'IMPROVING POSITION';
    subtitle = gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m` : 'Refining device fix...';
    badgeColor = '#3B82F6';
  } else if (isReady) {
    title = 'LOCATION FOUND';
    subtitle = gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m` : 'High-confidence device fix';
    badgeColor = '#10B981';
  } else if (isApprox) {
    title = 'APPROXIMATE LOCATION';
    subtitle = gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m uncertainty` : 'Honest device accuracy reported';
    badgeColor = '#F59E0B';
  } else if (isDenied) {
    title = 'LOCATION ACCESS BLOCKED';
    subtitle = 'Location permission is disabled in browser settings';
    badgeColor = '#EF4444';
  } else if (isTimeout) {
    title = 'LOCATION TIMED OUT';
    subtitle = 'Device GPS took too long to respond';
    badgeColor = '#EF4444';
  } else if (isUnavailable || isError) {
    title = 'LOCATION CURRENTLY UNAVAILABLE';
    subtitle = "Your device couldn't provide a location right now";
    badgeColor = '#EF4444';
  } else if (isStale) {
    title = 'PREVIOUS DEVICE LOCATION';
    subtitle = activeLocationContext?.freshnessText ? `Updated ${activeLocationContext.freshnessText}` : 'Previous session';
    badgeColor = '#64748B';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 35,
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        borderRadius: '24px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-panel)',
        padding: '6px 14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        pointerEvents: 'auto',
        animation: 'fadeInDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '90vw',
      }}
    >
      <div style={{ position: 'relative', width: '8px', height: '8px', flexShrink: 0 }}>
        <span
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: badgeColor,
          }}
        />
        {(isLocating || isImproving) && (
          <span
            style={{
              position: 'absolute',
              width: '16px',
              height: '16px',
              top: '-4px',
              left: '-4px',
              borderRadius: '50%',
              backgroundColor: badgeColor,
              opacity: 0.4,
              animation: 'pulse 1.5s infinite',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {subtitle}
        </span>
      </div>

      {/* Action buttons for Denied, Timeout, Unavailable (Sections 3, 20) */}
      {(isDenied || isTimeout || isUnavailable || isError) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
          <button
            onClick={() => {
              import('@/services/locationService').then((m) => m.locationService.requestDeviceLocation());
            }}
            style={{
              backgroundColor: 'var(--accent-primary-light)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => {
              useLocationStore.getState().setIsChoosingOnMap(true);
            }}
            style={{
              backgroundColor: 'var(--button-secondary)',
              border: '1px solid var(--button-secondary-border)',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--button-secondary-foreground)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Choose on Map
          </button>
        </div>
      )}

      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '0 0 0 4px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Dismiss"
        aria-label="Dismiss"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
