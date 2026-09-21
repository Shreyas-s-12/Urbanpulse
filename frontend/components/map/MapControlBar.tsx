'use client';

import React from 'react';
import { MapMode } from '@shared/types';
import { CompassIcon } from '@/components/common/Icons';

interface MapControlBarProps {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  streetViewActive?: boolean;
  onToggleStreetView?: () => void;
  tilt: number;
  heading: number;
  onResetNorth?: () => void;
  is3DSupported?: boolean;
  isStreetViewAvailable?: boolean | null;
  className?: string;
  style?: React.CSSProperties;
}

export default function MapControlBar({
  mode,
  onModeChange,
  streetViewActive,
  onToggleStreetView,
  tilt,
  heading,
  onResetNorth,
  isStreetViewAvailable,
  className,
  style,
}: MapControlBarProps) {
  const isTiltedOrRotated = tilt > 0 || Math.abs(heading) > 1;

  const baseModes: { id: MapMode; label: string }[] = [
    { id: '2D', label: '2D' },
    { id: 'ROADMAP', label: 'Road' },
    { id: 'SATELLITE', label: 'Sat' },
    { id: 'HYBRID', label: 'Hybrid' },
    { id: 'TERRAIN', label: 'Terrain' },
  ];

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 32,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'auto',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: 'calc(100% - 32px)',
        ...style,
      }}
    >
      {/* Compass / Reset North Button (shows when tilted or heading off-north) */}
      {isTiltedOrRotated && (
        <button
          type="button"
          onClick={onResetNorth}
          aria-label="Reset orientation to North"
          title={`Heading: ${Math.round(heading)}°, Tilt: ${Math.round(tilt)}°. Click to reset North`}
          style={{
            height: '32px',
            width: '32px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
            color: 'var(--accent-primary, #2563EB)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <CompassIcon
            size={16}
            color="var(--accent-primary, #2563EB)"
            style={{
              transform: `rotate(${-heading}deg)`,
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      )}



      {/* Base Map Modes Group */}
      <div
        style={{
          display: 'inline-flex',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
          padding: '2px',
          height: '32px',
          boxSizing: 'border-box',
        }}
      >
        {baseModes.map((m) => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              aria-pressed={isActive}
              style={{
                height: '26px',
                padding: '0 9px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
                color: isActive ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #475569)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
