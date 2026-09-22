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
            height: '34px',
            width: '34px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border, #E2E7EF)',
            boxShadow: 'var(--card-shadow, 0 2px 6px rgba(15, 23, 42, 0.08))',
            color: 'var(--accent-primary, #2563EB)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-card-hover, #F3F6FA)';
            e.currentTarget.style.borderColor = 'var(--accent-primary, #2563EB)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-card, #FFFFFF)';
            e.currentTarget.style.borderColor = 'var(--border, #E2E7EF)';
          }}
        >
          <CompassIcon
            size={17}
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
          alignItems: 'center',
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border, #E2E7EF)',
          boxShadow: 'var(--card-shadow, 0 2px 6px rgba(15, 23, 42, 0.08))',
          padding: '2px',
          height: '34px',
          boxSizing: 'border-box',
          gap: '2px',
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
                height: '28px',
                padding: '0 10px',
                borderRadius: '6px',
                border: isActive ? '1px solid var(--accent-primary-soft, #BFDBFE)' : '1px solid transparent',
                fontSize: '11.5px',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
                color: isActive ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #566174)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover, #F3F6FA)';
                  e.currentTarget.style.color = 'var(--text-primary, #172033)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #566174)';
                }
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
