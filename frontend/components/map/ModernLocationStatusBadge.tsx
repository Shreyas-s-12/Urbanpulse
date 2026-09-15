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

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (locationAccuracyState === 'LOCATING' || locationAccuracyState === 'IMPROVING') {
      setVisible(true);
    } else if (locationAccuracyState === 'LOCKED' || locationAccuracyState === 'APPROXIMATE') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(t);
    } else if (conflictStatus?.hasConflict) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [locationAccuracyState, conflictStatus?.hasConflict]);

  if (!visible) return null;

  const isLocating = locationAccuracyState === 'LOCATING';
  const isImproving = locationAccuracyState === 'IMPROVING';
  const isLocked = locationAccuracyState === 'LOCKED';
  const isApprox = locationAccuracyState === 'APPROXIMATE';
  const isStale = locationAccuracyState === 'STALE';
  const isNetwork = activeSource === 'NETWORK';
  const hasConflict = conflictStatus?.hasConflict;

  let title = 'LOCATING YOU';
  let subtitle = 'Finding your most accurate position...';
  let badgeColor = '#2563EB';

  if (hasConflict) {
    title = 'LOCATION SIGNALS DIFFER';
    subtitle = conflictStatus.message || 'Trying to improve accuracy...';
    badgeColor = '#F59E0B';
  } else if (isLocating) {
    title = 'LOCATING YOU';
    subtitle = 'Acquiring satellite and hardware signals...';
    badgeColor = '#2563EB';
  } else if (isImproving) {
    title = 'IMPROVING POSITION';
    subtitle = gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m` : 'Refining satellite fix...';
    badgeColor = '#3B82F6';
  } else if (isLocked) {
    title = 'LOCATION READY';
    subtitle = gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m` : 'High-confidence fix';
    badgeColor = '#10B981';
  } else if (isApprox || isNetwork) {
    title = 'APPROXIMATE NETWORK AREA';
    subtitle = gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m` : 'Estimated from regional network';
    badgeColor = '#F59E0B';
  } else if (isStale) {
    title = 'LAST KNOWN LOCATION';
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
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(12px)',
        borderRadius: '24px',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
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
            color: '#0F172A',
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
          {subtitle}
        </span>
      </div>

      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          color: '#94A3B8',
          cursor: 'pointer',
          padding: '0 0 0 4px',
          fontSize: '12px',
          lineHeight: 1,
        }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
