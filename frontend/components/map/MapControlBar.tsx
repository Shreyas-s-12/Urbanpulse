'use client';

import React from 'react';
import { MapMode } from '@shared/types';
import {
  CompassIcon,
  CubeIcon,
  StreetViewIcon,
} from '@/components/common/Icons';

interface MapControlBarProps {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  streetViewActive: boolean;
  onToggleStreetView: () => void;
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
  is3DSupported = true,
  isStreetViewAvailable,
  className,
  style,
}: MapControlBarProps) {
  const is3D = mode === '3D';
  const isTiltedOrRotated = tilt > 0 || Math.abs(heading) > 1;

  const baseModes: { id: MapMode; label: string }[] = [
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

      {/* 2D / 3D Toggle Pill */}
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
        <button
          type="button"
          onClick={() => {
            if (is3D) onModeChange('ROADMAP');
          }}
          aria-pressed={!is3D}
          style={{
            height: '26px',
            padding: '0 8px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '11px',
            fontWeight: !is3D ? 700 : 500,
            backgroundColor: !is3D ? 'var(--accent-primary, #2563EB)' : 'transparent',
            color: !is3D ? '#FFFFFF' : 'var(--text-secondary, #64748B)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          2D
        </button>

        <button
          type="button"
          onClick={() => {
            if (!is3D) onModeChange('3D');
          }}
          disabled={!is3DSupported}
          aria-pressed={is3D}
          title={is3DSupported ? 'Enable 3D perspective' : '3D perspective unavailable on this device'}
          style={{
            height: '26px',
            padding: '0 8px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '11px',
            fontWeight: is3D ? 700 : 500,
            backgroundColor: is3D ? 'var(--accent-primary, #2563EB)' : 'transparent',
            color: is3D ? '#FFFFFF' : 'var(--text-secondary, #64748B)',
            cursor: is3DSupported ? 'pointer' : 'not-allowed',
            opacity: is3DSupported ? 1 : 0.5,
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <CubeIcon size={12} color={is3D ? '#FFFFFF' : 'currentColor'} />
          <span>3D</span>
        </button>
      </div>

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

      {/* Street View Toggle Button */}
      <button
        type="button"
        onClick={onToggleStreetView}
        aria-pressed={streetViewActive}
        title={
          isStreetViewAvailable === false
            ? 'Street View imagery unavailable for this location'
            : streetViewActive
            ? 'Close Street View'
            : 'Explore in Google Street View'
        }
        style={{
          height: '32px',
          padding: '0 10px',
          borderRadius: 'var(--radius-md, 8px)',
          backgroundColor: streetViewActive
            ? 'var(--accent-primary, #2563EB)'
            : 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          border: streetViewActive
            ? '1px solid var(--accent-primary, #2563EB)'
            : '1px solid var(--border-subtle, #E2E8F0)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
          color: streetViewActive ? '#FFFFFF' : 'var(--text-primary, #1E293B)',
          fontSize: '11px',
          fontWeight: streetViewActive ? 700 : 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          transition: 'all 0.15s ease',
        }}
      >
        <StreetViewIcon size={14} color={streetViewActive ? '#FFFFFF' : 'var(--accent-primary, #2563EB)'} />
        <span style={{ whiteSpace: 'nowrap' }}>Street View</span>
        {isStreetViewAvailable === false && (
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
            }}
            title="Unavailable"
          />
        )}
      </button>
    </div>
  );
}
