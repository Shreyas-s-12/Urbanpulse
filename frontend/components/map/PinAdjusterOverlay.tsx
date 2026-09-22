'use client';

import React from 'react';
import { useLocationStore } from '@/stores/useLocationStore';

export default function PinAdjusterOverlay() {
  const { isAdjustingPin, confirmManualPin, cancelPinAdjustment } = useLocationStore();

  if (!isAdjustingPin) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-panel)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        pointerEvents: 'auto',
        animation: 'fadeInDown 0.2s ease-out',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Adjust Location Pin
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Click anywhere on the map to reposition your active pin.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={cancelPinAdjustment}
          style={{
            backgroundColor: 'var(--button-secondary)',
            border: '1px solid var(--button-secondary-border)',
            color: 'var(--button-secondary-foreground)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <button
          onClick={confirmManualPin}
          style={{
            backgroundColor: 'var(--button)',
            border: 'none',
            color: 'var(--button-foreground)',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
}
