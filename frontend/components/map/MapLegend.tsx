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

interface LegendItem {
  label: string;
  color: string;
  shape?: 'circle' | 'line' | 'square';
}

interface LegendSection {
  title: string;
  items: LegendItem[];
  stats?: { min: number; mean: number; max: number; stdDev: number; isUniform: boolean; validCount: number } | null;
  note?: string;
}

export default function MapLegend({
  activeFilter = 'ALL',
  isTrafficActive = false,
  isRiskActive = false,
  className,
  style,
}: MapLegendProps) {
  const [trafficCollapsed, setTrafficCollapsed] = useState(false);
  const [baseCollapsed, setBaseCollapsed] = useState(false);

  const isTrafficOn = activeFilter === 'TRAFFIC' || isTrafficActive;

  // Build Dedicated Live Traffic Legend (strictly separated, never colliding)
  let trafficSection: LegendSection | null = null;
  if (isTrafficOn) {
    trafficSection = {
      title: 'LIVE GOOGLE TRAFFIC',
      items: [
        { label: 'Normal / Free', color: '#10B981', shape: 'line' },
        { label: 'Moderate Congestion', color: '#F59E0B', shape: 'line' },
        { label: 'Slow / Heavy Delay', color: '#EA580C', shape: 'line' },
        { label: 'Severe Jam', color: '#DC2626', shape: 'line' },
      ],
      note: 'Google Maps TrafficLayer',
    };
  }

  // Base map incidents legend when traffic is OFF
  let incidentSection: LegendSection | null = null;
  if (!isTrafficOn) {
    if (isRiskActive) {
      incidentSection = {
        title: 'RISK RADAR DOMAINS',
        items: [
          { label: 'Critical (75+)', color: '#9F1239' },
          { label: 'High (55–74)', color: '#EF4444' },
          { label: 'Moderate (35–54)', color: '#F59E0B' },
          { label: 'Low (<35)', color: '#10B981' },
          { label: 'No Verified Signal', color: '#94A3B8' },
        ],
      };
    } else {
      incidentSection = {
        title: 'INCIDENTS & SEVERITY',
        items: [
          { label: 'Severe (>=75)', color: '#EF4444' },
          { label: 'Moderate (55–74)', color: '#F59E0B' },
          { label: 'Low (<55)', color: '#10B981' },
        ],
      };
    }
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(12px)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle, #E2E8F0)',
    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08))',
    padding: '8px 12px',
    fontSize: '11px',
    color: 'var(--text-primary, #1E293B)',
    width: '240px',
    pointerEvents: 'auto',
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px', // Exact 8px separation between stacked legends
        alignItems: 'flex-end',
        pointerEvents: 'none',
        ...style,
      }}
    >


      {/* 2. Live Traffic Legend (Stacked below with 8px gap) */}
      {trafficSection && (
        <div style={cardStyle}>
          <div
            onClick={() => setTrafficCollapsed(!trafficCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {trafficSection.title}
            </span>
            <ChevronDownIcon
              size={11}
              style={{
                transform: trafficCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
                color: '#64748B',
              }}
            />
          </div>

          {!trafficCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {trafficSection.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', borderRadius: '2px', backgroundColor: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 500 }}>
                    {item.label}
                  </span>
                </div>
              ))}
              {trafficSection.note && (
                <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px' }}>
                  {trafficSection.note}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Base Incidents / Risk Section (only when both heatmap and traffic are off) */}
      {incidentSection && (
        <div style={cardStyle}>
          <div
            onClick={() => setBaseCollapsed(!baseCollapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {incidentSection.title}
            </span>
            <ChevronDownIcon
              size={11}
              style={{
                transform: baseCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
                color: '#64748B',
              }}
            />
          </div>

          {!baseCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {incidentSection.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 500 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
