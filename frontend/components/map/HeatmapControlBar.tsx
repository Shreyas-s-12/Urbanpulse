/**
 * UrbanPulse Compact Intelligence Heatmap Filter
 * Map-dominant, single-row compact metric selector:
 * - Small, horizontal, scrollable on mobile
 * - Replaces the old crowded multi-row dashboard
 * - Segments: [ AQI ] [ Traffic ] [ Weather ] [ Population ] (No Combined)
 * - Area selection is decoupled and managed by existing location search
 * - Independent Heatmap toggle and Legend visibility toggle
 */

'use client';

import React from 'react';
import { useHeatmapStore } from '@/stores/useHeatmapStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { HeatmapMetric, HeatmapGeography } from '@shared/types';

interface HeatmapControlBarProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function HeatmapControlBar({ className, style }: HeatmapControlBarProps) {
  const {
    metric,
    geography,
    isLegendVisible,
    setMetric,
    setGeography,
    toggleLegendVisibility,
  } = useHeatmapStore();

  const { isResearchModeOpen, toggleResearchMode } = useResearchStore();

  const metrics: { id: HeatmapMetric; label: string; icon: React.ReactNode }[] = [
    {
      id: 'AQI',
      label: 'AQI',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
        </svg>
      ),
    },
    {
      id: 'TRAFFIC',
      label: 'Traffic',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <circle cx="12" cy="7" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="17" r="1.5" />
        </svg>
      ),
    },
    {
      id: 'WEATHER',
      label: 'Weather',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      ),
    },
    {
      id: 'POPULATION',
      label: 'Population',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  const scopes: { id: HeatmapGeography; label: string; icon: React.ReactNode }[] = [
    {
      id: 'WORLD',
      label: 'World',
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      id: 'COUNTRY',
      label: 'Country',
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      ),
    },
    {
      id: 'STATE',
      label: 'State',
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3l9 7H3z" />
        </svg>
      ),
    },
    {
      id: 'DISTRICT',
      label: 'District',
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      ),
    },
    {
      id: 'CITY',
      label: 'City',
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="9" y1="22" x2="9" y2="2" />
          <line x1="8" y1="6" x2="10" y2="6" />
          <line x1="14" y1="6" x2="16" y2="6" />
        </svg>
      ),
    },
    {
      id: 'PLACE',
      label: 'Place',
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
  ];

  // Active Single-Row Compact Filter Navigation Bar:
  // [ AQI ] [ Traffic ] [ Weather ] [ Population ] | [ World ] [ Country ] [ State ] [ City ] [ Place ] | [ Legend ]
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: '38px',
        padding: '3px 8px',
        borderRadius: '999px',
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(14px)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-panel)',
        pointerEvents: 'auto',
        maxWidth: 'calc(100vw - 32px)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        ...style,
      }}
      role="toolbar"
      aria-label="Intelligence Heatmap Selector"
    >
      {/* 1. Primary 4 Metrics: Single-row horizontal buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
        }}
      >
        {metrics.map((m) => {
          const isActive = metric === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '30px',
                padding: '0 11px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: isActive ? 'var(--button)' : 'transparent',
                color: isActive ? 'var(--button-foreground)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
              }}
              aria-pressed={isActive}
              title={`Switch to ${m.label} Heatmap`}
            >
              <span style={{ fontSize: '12px' }}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Subtle Divider */}
      <div
        style={{
          width: '1px',
          height: '18px',
          backgroundColor: 'var(--border)',
          margin: '0 2px',
        }}
      />

      {/* 2. Geographic Area Scopes: World, Country, State, City, Place */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
        }}
      >
        {scopes.map((s) => {
          const isActive = geography === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setGeography(s.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '30px',
                padding: '0 10px',
                borderRadius: '999px',
                border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--button)' : 'transparent',
                color: isActive ? 'var(--button-foreground)' : 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
              }}
              aria-pressed={isActive}
              title={`View ${s.label} scale`}
            >
              <span style={{ fontSize: '11px' }}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Subtle Divider */}
      <div
        style={{
          width: '1px',
          height: '18px',
          backgroundColor: 'var(--border)',
          margin: '0 2px',
        }}
      />

      {/* 3. Legend Visibility Toggle Button (never switches data layer) */}
      <button
        type="button"
        onClick={() => toggleLegendVisibility()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          height: '28px',
          padding: '0 10px',
          borderRadius: '999px',
          border: '1px solid',
          borderColor: isLegendVisible ? 'var(--accent-primary)' : 'var(--border-subtle)',
          backgroundColor: isLegendVisible ? 'var(--accent-primary-light)' : 'transparent',
          color: isLegendVisible ? 'var(--accent-primary)' : 'var(--text-secondary)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
        }}
        title={isLegendVisible ? 'Hide Legend Card' : 'Show Legend Card'}
        aria-label="Toggle Legend Visibility"
        aria-pressed={isLegendVisible}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>Legend</span>
      </button>

      {/* Subtle Divider */}
      <div
        style={{
          width: '1px',
          height: '18px',
          backgroundColor: 'var(--border)',
          margin: '0 2px',
        }}
      />

      {/* 4. Research Mode Workbench Toggle Button */}
      <button
        type="button"
        onClick={() => toggleResearchMode()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          height: '28px',
          padding: '0 10px',
          borderRadius: '999px',
          border: '1px solid',
          borderColor: isResearchModeOpen ? 'var(--accent-primary)' : 'var(--border-subtle)',
          backgroundColor: isResearchModeOpen ? 'var(--accent-primary-light)' : 'transparent',
          color: isResearchModeOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
          boxShadow: isResearchModeOpen ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
        }}
        title={isResearchModeOpen ? 'Hide Research Workbench' : 'Open Research Mode Workbench'}
        aria-label="Toggle Research Mode Workbench"
        aria-pressed={isResearchModeOpen}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18h8" />
          <path d="M3 22h18" />
          <path d="M14 22a7 7 0 1 0 0-14h-1" />
          <path d="M9 14h2" />
          <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
          <line x1="12" y1="6" x2="12" y2="2" />
        </svg>
        <span>Research Mode</span>
      </button>
    </div>
  );
}
