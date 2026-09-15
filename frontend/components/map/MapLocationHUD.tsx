'use client';

import React from 'react';
import { ResolvedLocation } from '@shared/types';
import {
  PinIcon,
  ThermometerIcon,
  LeafIcon,
  CarIcon,
  ShieldCheckIcon,
} from '@/components/common/Icons';

interface MapLocationHUDProps {
  location: ResolvedLocation | null;
  weather?: { tempC?: number; condition?: string } | null;
  aqi?: { value?: number; category?: string } | null;
  trafficSummary?: string | null;
  confidence?: number;
  radiusKm?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function MapLocationHUD({
  location,
  weather,
  aqi,
  trafficSummary,
  confidence,
  radiusKm,
  className,
  style,
}: MapLocationHUDProps) {
  if (!location) return null;

  const title = location.city || location.name || location.displayName || 'Selected Location';
  const subtitle = [location.state || location.district, location.country]
    .filter(Boolean)
    .join(', ');

  const hasMetrics = weather?.tempC !== undefined || aqi?.value !== undefined || trafficSummary;

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '16px',
        zIndex: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle, #E2E8F0)',
        boxShadow: 'var(--shadow-panel, 0 4px 16px rgba(0, 0, 0, 0.08))',
        padding: '10px 14px',
        maxWidth: '340px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'auto',
        animation: 'fadeIn 0.2s ease-out',
        ...style,
      }}
    >
      {/* Top Row: Location Name + Confidence badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <PinIcon size={14} color="var(--accent-primary, #2563EB)" style={{ flexShrink: 0 }} />
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: 'var(--text-primary, #0F172A)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {title}
            </span>
          </div>
        </div>

        {confidence !== undefined && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-app, #F8FAFC)',
              border: '1px solid var(--border-subtle, #E2E8F0)',
              color: 'var(--text-secondary, #64748B)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title="Data verification confidence"
          >
            {Math.round(confidence * 100)}% CONF
          </span>
        )}
      </div>

      {/* Subtitle / Region + Radius */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted, #94A3B8)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle || `${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E`}
        </span>
        {radiusKm && (
          <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--accent-primary, #2563EB)', marginLeft: '6px' }}>
            {radiusKm} km radius
          </span>
        )}
      </div>

      {/* Metrics Row: Only displayed when authentic data is available */}
      {hasMetrics && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '2px',
            paddingTop: '6px',
            borderTop: '1px solid var(--border-subtle, #F1F5F9)',
            fontSize: '11px',
            flexWrap: 'wrap',
          }}
        >
          {weather?.tempC !== undefined && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-primary, #1E293B)' }}>
              <ThermometerIcon size={12} color="var(--accent-primary, #2563EB)" />
              <span style={{ fontWeight: 700 }}>{Math.round(weather.tempC)}°C</span>
              {weather.condition && (
                <span style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '10px' }}>({weather.condition})</span>
              )}
            </div>
          )}

          {aqi?.value !== undefined && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-primary, #1E293B)' }}>
              <LeafIcon size={12} color="#10B981" />
              <span style={{ fontWeight: 700 }}>AQI {aqi.value}</span>
              {aqi.category && (
                <span style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '10px' }}>({aqi.category})</span>
              )}
            </div>
          )}

          {trafficSummary && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-primary, #1E293B)' }}>
              <CarIcon size={12} color="var(--accent-primary, #2563EB)" />
              <span style={{ fontWeight: 600 }}>{trafficSummary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
