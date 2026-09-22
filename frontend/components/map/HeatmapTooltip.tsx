'use client';

import React from 'react';
import { HeatmapCell } from '@shared/types';
import { useHeatmapStore } from '@/stores/useHeatmapStore';
import { formatDisplayValue } from '@/components/common/displayUtils';

interface HeatmapTooltipProps {
  cell?: HeatmapCell | null;
  position?: { x: number; y: number } | null;
  onClose?: () => void;
}

export default function HeatmapTooltip({ cell, position, onClose }: HeatmapTooltipProps) {
  const storeCell = useHeatmapStore((s) => s.hoveredCell || s.selectedCell);
  const activeCell = cell ?? storeCell;

  if (!activeCell) return null;

  const areaName = activeCell.metadata?.areaName || `Coordinates (${activeCell.latitude.toFixed(4)}, ${activeCell.longitude.toFixed(4)})`;
  const categoryColor =
    activeCell.category === 'SEVERE'
      ? '#EF4444'
      : activeCell.category === 'HIGH'
      ? '#F97316'
      : activeCell.category === 'MODERATE'
      ? '#EAB308'
      : activeCell.category === 'UNKNOWN'
      ? '#64748B'
      : '#10B981';

  const style: React.CSSProperties = position
    ? {
        position: 'absolute',
        left: `${Math.min(position.x + 12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280)}px`,
        top: `${Math.max(position.y - 120, 80)}px`,
        zIndex: 45,
      }
    : {
        position: 'absolute',
        bottom: '80px',
        right: '16px',
        zIndex: 45,
      };

  const isTraffic = activeCell.metric === 'TRAFFIC';
  const roadName = activeCell.metadata?.roadName || activeCell.metadata?.areaName || areaName;

  return (
    <div
      style={{
        ...style,
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-panel)',
        padding: '12px 14px',
        width: isTraffic ? '280px' : '260px',
        fontSize: '11px',
        pointerEvents: 'auto',
        color: 'var(--text-primary)',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {activeCell.metric} {activeCell.subMetric ? `• ${activeCell.subMetric.replace('_', ' ')}` : ''}
          </span>
          <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px', color: 'var(--text-primary)' }}>
            {isTraffic ? roadName : areaName}
          </h4>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '14px',
              padding: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0', padding: '6px 8px', backgroundColor: 'var(--bg-surface-secondary)', borderRadius: '6px' }}>
        <div>
          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
            {isTraffic ? 'Current Speed' : (activeCell.metric === 'POPULATION' ? 'Population Density' : 'Observed Intensity')}
          </span>
          <div style={{ fontSize: '15px', fontWeight: 800, color: categoryColor }}>
            {isTraffic
              ? (activeCell.metadata?.currentSpeedKmh !== undefined ? `${activeCell.metadata.currentSpeedKmh} km/h` : `${activeCell.value} km/h`)
              : (activeCell.metric === 'POPULATION'
                ? Math.round(activeCell.populationDensity ?? activeCell.rawValue ?? activeCell.value).toLocaleString()
                : (activeCell.rawValue !== undefined ? activeCell.rawValue : activeCell.value))}{' '}
            {!isTraffic && (
              <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {activeCell.metric === 'AQI'
                  ? 'AQI'
                  : activeCell.metric === 'WEATHER'
                  ? 'stress'
                  : activeCell.metric === 'POPULATION'
                  ? 'people/km²'
                  : ''}
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: `${categoryColor}20`,
            color: categoryColor,
            border: `1px solid ${categoryColor}40`,
          }}
        >
          {activeCell.metadata?.trafficLevel || activeCell.category}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: 'var(--text-secondary)', fontSize: '10px' }}>
        {isTraffic && activeCell.metadata?.freeFlowSpeedKmh !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Free-flow Speed:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeCell.metadata.freeFlowSpeedKmh} km/h</span>
          </div>
        )}
        {isTraffic && activeCell.metadata?.delayPercent !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Delay:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>+{activeCell.metadata.delayPercent}%</span>
          </div>
        )}
        {isTraffic && activeCell.metadata?.relativeSpeed !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Flow Ratio:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(activeCell.metadata.relativeSpeed * 100)}%</span>
          </div>
        )}
        {activeCell.metric === 'POPULATION' && (
          <>
            {activeCell.populationCount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Est. Area Population:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {Math.round(activeCell.populationCount).toLocaleString()} people
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Dataset Year:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {activeCell.datasetYear ?? 2020} (Historical)
              </span>
            </div>
            {activeCell.metadata?.coverage && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Coverage:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatDisplayValue(activeCell.metadata.coverage)}
                </span>
              </div>
            )}
          </>
        )}
        {activeCell.resolution && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Resolution:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDisplayValue(activeCell.resolution)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Source:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDisplayValue(activeCell.source)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Quality/Confidence:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round((activeCell.confidence ?? 0.95) * 100)}%</span>
        </div>
        {activeCell.timestamp && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Timestamp:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {new Date(activeCell.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
