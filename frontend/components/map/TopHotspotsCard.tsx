'use client';

import React, { useState } from 'react';
import { useHeatmapStore } from '@/stores/useHeatmapStore';
import { HeatmapCell } from '@shared/types';
import { ChevronDownIcon } from '@/components/common/Icons';

interface TopHotspotsCardProps {
  onSelectHotspot?: (cell: HeatmapCell) => void;
  onFocusHotspot?: (lat: number, lng: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function TopHotspotsCard({
  onSelectHotspot,
  onFocusHotspot,
  className,
  style,
}: TopHotspotsCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { status, metric, cells, setSelectedCell } = useHeatmapStore();

  if (status === 'OFF') return null;

  // Compute top hotspots sorted by severity / normalized value
  const validCells = cells.filter((c) => c.status !== 'NO_COVERAGE' && c.category !== 'UNKNOWN');
  const sortedHotspots = [...validCells].sort((a, b) => b.normalizedValue - a.normalizedValue).slice(0, 4);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'SEVERE':
        return '#EF4444';
      case 'HIGH':
        return '#F97316';
      case 'MODERATE':
        return '#EAB308';
      default:
        return '#10B981';
    }
  };

  const handleHotspotClick = (cell: HeatmapCell) => {
    setSelectedCell(cell);
    onSelectHotspot?.(cell);
    onFocusHotspot?.(cell.latitude, cell.longitude);
  };

  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        padding: '8px 12px',
        width: '240px',
        fontSize: '11px',
        color: 'var(--text-primary)',
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
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {metric === 'POPULATION' ? 'DENSEST AREAS' : `TOP HOTSPOTS: ${metric}`}
        </span>
        <ChevronDownIcon
          size={11}
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-secondary)',
          }}
        />
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
          {sortedHotspots.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '10.5px', padding: '4px 0', fontStyle: 'italic' }}>
              Insufficient spatial data.
            </div>
          ) : (
            sortedHotspots.map((cell, idx) => {
              const areaName = cell.metadata?.areaName || `Sector ${idx + 1}`;
              const color = getCategoryColor(cell.category);

              return (
                <button
                  key={cell.id}
                  onClick={() => handleHotspotClick(cell)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    border: '1px solid transparent',
                    backgroundColor: 'var(--bg-surface-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-secondary)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', width: '12px' }}>
                      {idx + 1}.
                    </span>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {areaName}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 800,
                      color,
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: `${color}15`,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {cell.category}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
