'use client';

import React, { useEffect, useState } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';

interface MapLocationPickerProps {
  onAdjustPrompt?: () => void;
}

export default function MapLocationPicker({ onAdjustPrompt }: MapLocationPickerProps) {
  const isSelectingMapLocation = useLocationStore((s) => s.isSelectingMapLocation || s.isChoosingOnMap);
  const mapClickDraft = useLocationStore((s) => s.mapClickDraft);
  const confirmManualMapLocation = useLocationStore((s) => s.confirmManualMapLocation);
  const cancelMapSelection = useLocationStore((s) => s.cancelMapSelection);

  const [isAdjustMode, setIsAdjustMode] = useState<boolean>(false);

  // Reset adjust mode when draft changes or selection closes
  useEffect(() => {
    if (!isSelectingMapLocation) {
      setIsAdjustMode(false);
    }
  }, [isSelectingMapLocation]);

  // Handle ESC key to cancel selection mode
  useEffect(() => {
    if (!isSelectingMapLocation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelMapSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectingMapLocation, cancelMapSelection]);

  if (!isSelectingMapLocation) return null;

  const handleAdjustClick = () => {
    setIsAdjustMode(true);
    onAdjustPrompt?.();
  };

  // 1. Initial State: Prompting the user to click anywhere on the map
  if (!mapClickDraft) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 45,
          backgroundColor: 'var(--overlay-bg)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-panel)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          pointerEvents: 'auto',
          animation: 'fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary-light)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M2 12h20" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Click anywhere on the map
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Select any street, building, or open road
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={cancelMapSelection}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            backgroundColor: 'var(--button-secondary)',
            color: 'var(--button-secondary-foreground)',
            border: '1px solid var(--button-secondary-border)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--button-secondary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--button-secondary)')}
        >
          Cancel
        </button>
      </div>
    );
  }

  // 2. Post-Click State: Confirmation Card with Coordinates, Address & Actions
  const meta = mapClickDraft.addressMetadata;
  const addressText = meta?.formattedAddress
    ? meta.formattedAddress
    : meta?.street
      ? `Near ${meta.street}${meta.locality ? `, ${meta.locality}` : ''}${meta.city ? `, ${meta.city}` : ''}`
      : meta?.locality
        ? `Near ${meta.locality}${meta.city ? `, ${meta.city}` : ''}`
        : meta?.city
          ? `Near ${meta.city}${meta.state ? `, ${meta.state}` : ''}`
          : mapClickDraft.resolving
            ? 'Resolving nearby address…'
            : 'Unlabeled area';

  const sourceLabel = mapClickDraft.isAdjusted || mapClickDraft.source === 'MANUAL_ADJUSTMENT'
    ? 'Manual adjustment'
    : 'Map selection';

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 45,
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        borderRadius: '14px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-panel)',
        padding: '14px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: 'auto',
        minWidth: '340px',
        maxWidth: '480px',
        pointerEvents: 'auto',
        animation: 'fadeInDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: 'var(--accent-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}
            >
              SELECTED LOCATION
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-surface-secondary)',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              {sourceLabel}
            </span>
          </div>

          <div
            style={{
              fontSize: '13.5px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              maxWidth: '360px',
            }}
          >
            {addressText}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {mapClickDraft.latitude.toFixed(5)}° N, {mapClickDraft.longitude.toFixed(5)}° E
          </div>

          {isAdjustMode && (
            <div
              style={{
                fontSize: '11px',
                color: '#D97706',
                fontWeight: 600,
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>●</span> Drag pin or click map to reposition
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons: [ Use this location ] [ Adjust ] [ Cancel ] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        <button
          type="button"
          onClick={confirmManualMapLocation}
          style={{
            flex: 1,
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--button)',
            color: 'var(--button-foreground)',
            border: 'none',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--button)')}
        >
          Use this location
        </button>

        <button
          type="button"
          onClick={handleAdjustClick}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: isAdjustMode ? 'var(--accent-primary-light)' : 'var(--button-secondary)',
            color: isAdjustMode ? 'var(--accent-primary)' : 'var(--button-secondary-foreground)',
            border: `1px solid ${isAdjustMode ? 'var(--accent-primary)' : 'var(--button-secondary-border)'}`,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          Adjust
        </button>

        <button
          type="button"
          onClick={cancelMapSelection}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
