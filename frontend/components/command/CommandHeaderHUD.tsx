'use client';

import React from 'react';
import { CommandOverview, UrbanStatusIndicator } from '@/types/command';

interface CommandHeaderHUDProps {
  overview: CommandOverview | null;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  activeView: string;
  onSelectView: (view: string) => void;
}

export default function CommandHeaderHUD({
  overview,
  selectedCategory,
  onSelectCategory,
  activeView,
  onSelectView,
}: CommandHeaderHUDProps) {
  const status = overview?.urbanStatus;

  const categories = [
    'LIVE',
    'RISKS',
    'INCIDENTS',
    'TRAFFIC',
    'WEATHER',
    'SAFETY',
    'INFRASTRUCTURE',
    'FORECAST',
    'ALERTS',
  ];

  const getSeverityBadgeColor = (sev?: string) => {
    switch (sev) {
      case 'CRITICAL':
        return { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' };
      case 'HIGH':
      case 'WARNING':
        return { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' };
      case 'MODERATE':
        return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
      default:
        return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
    }
  };

  const renderStatusPill = (ind?: UrbanStatusIndicator, defaultLabel?: string) => {
    if (!ind) return null;
    const colors = getSeverityBadgeColor(ind.severity);
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 10px',
          borderRadius: '6px',
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          minWidth: '100px',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase' }}>
          {ind.label || defaultLabel}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: colors.text }}>
          {ind.value}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 20,
      }}
    >
      {/* Top Row: Location & Status Badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
              <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>
                URBAN COMMAND CENTER
              </h1>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>
                — {overview?.locationName || 'Dynamic Spatial Surveillance'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
              Radius: {overview?.radiusKm || 30} km | Score: <strong style={{ color: '#2563EB' }}>{overview?.urbanPulseScore || '—'}</strong>/100 | Confidence: <strong style={{ color: '#111827' }}>{status?.overallConfidence ? `${Math.round(status.overallConfidence * 100)}%` : '—'}</strong>
            </div>
          </div>
        </div>

        {/* Status Indicators Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {renderStatusPill(status?.traffic, 'Traffic')}
          {renderStatusPill(status?.weather, 'Weather')}
          {renderStatusPill(status?.aqi, 'AQI')}
          {renderStatusPill(status?.hazards, 'Hazards')}
          {renderStatusPill(status?.safety, 'Safety')}
          {renderStatusPill(status?.infrastructure, 'Infrastructure')}
        </div>

        {/* Operational Mode Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {[
            { id: 'SITUATION', label: 'Situation' },
            { id: 'GRAPH', label: 'Intel Graph' },
            { id: 'HEALTH', label: 'City Health' },
            { id: 'DECISION', label: 'Decisions' },
            { id: 'COMPARE', label: 'Compare' },
            { id: 'QUALITY', label: 'Observability' },
            { id: 'REPORT', label: 'Report' },
          ].map((v) => {
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => onSelectView(v.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #2563EB' : '1px solid #D1D5DB',
                  backgroundColor: isActive ? '#2563EB' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#374151',
                  transition: 'all 0.15s ease',
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Category Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginRight: '4px' }}>
          LAYERS:
        </span>
        {categories.map((cat) => {
          const isSel = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              style={{
                padding: '3px 9px',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                border: isSel ? '1px solid #2563EB' : '1px solid #E5E7EB',
                backgroundColor: isSel ? '#EFF6FF' : '#F9FAFB',
                color: isSel ? '#1D4ED8' : '#4B5563',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
