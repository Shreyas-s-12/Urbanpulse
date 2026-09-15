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
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #CBD5E1',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        pointerEvents: 'auto',
        animation: 'fadeInDown 0.2s ease-out',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
          Adjust Location Pin
        </span>
        <span style={{ fontSize: '11px', color: '#64748B' }}>
          Click anywhere on the map to reposition your active pin.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={cancelPinAdjustment}
          style={{
            backgroundColor: '#F1F5F9',
            border: '1px solid #E2E8F0',
            color: '#475569',
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
            backgroundColor: '#2563EB',
            border: 'none',
            color: '#FFFFFF',
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
