'use client';

import React, { useState } from 'react';
import { ChevronDownIcon } from '@/components/common/Icons';

interface MapLegendProps {
  activeFilter?: string;
  isTrafficActive?: boolean;
  isRiskActive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function MapLegend({
  activeFilter = 'ALL',
  isTrafficActive = false,
  isRiskActive = false,
  className,
  style,
}: MapLegendProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Determine what type of legend to display based on active state
  let title = 'INCIDENTS & SEVERITY';
  let items: { label: string; color: string; shape?: 'circle' | 'line' | 'square' }[] = [
    { label: 'High (>=75)', color: '#EF4444' },
    { label: 'Moderate (55-74)', color: '#F59E0B' },
    { label: 'Low (<55)', color: '#10B981' },
  ];

  if (isRiskActive) {
    title = 'RISK RADAR DOMAINS';
    items = [
      { label: 'Severe', color: '#DC2626' },
      { label: 'High', color: '#EA580C' },
      { label: 'Moderate', color: '#F59E0B' },
      { label: 'Low', color: '#10B981' },
      { label: 'Unknown', color: '#94A3B8' },
    ];
  } else if (activeFilter === 'TRAFFIC' || isTrafficActive) {
    title = 'LIVE ROAD TRAFFIC';
    items = [
      { label: 'Fast / Normal', color: '#10B981', shape: 'line' },
      { label: 'Moderate', color: '#F59E0B', shape: 'line' },
      { label: 'Slow / Heavy', color: '#EA580C', shape: 'line' },
      { label: 'Severe Jam', color: '#DC2626', shape: 'line' },
    ];
  } else if (activeFilter === 'FLOOD') {
    title = 'FLOOD & HYDROLOGY';
    items = [
      { label: 'Active Inundation', color: '#DC2626' },
      { label: 'High Flood Risk', color: '#EA580C' },
      { label: 'Moderate Risk', color: '#2563EB' },
    ];
  } else if (activeFilter === 'CRIME') {
    title = 'PUBLIC SAFETY';
    items = [
      { label: 'Verified Severe Incident', color: '#DC2626' },
      { label: 'Police Alert', color: '#2563EB' },
      { label: 'Advisory / Low', color: '#64748B' },
    ];
  }

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '16px',
        zIndex: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle, #E2E8F0)',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))',
        padding: '8px 12px',
        fontSize: '11px',
        color: 'var(--text-primary, #1E293B)',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748B)', letterSpacing: '0.04em' }}>
          {title}
        </span>
        <ChevronDownIcon
          size={11}
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-muted, #64748B)',
          }}
        />
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {item.shape === 'line' ? (
                <span
                  style={{
                    width: '12px',
                    height: '3px',
                    borderRadius: '2px',
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary, #475569)', fontWeight: 500 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
