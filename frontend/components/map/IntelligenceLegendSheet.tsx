/**
 * UrbanPulse IntelligenceLegendSheet
 * Map-dominant, compact spatial intelligence sheet and legend.
 * Recreates the interaction pattern:
 * - Continuous color gradient communicating intensity
 * - Numeric and category thresholds below the gradient
 * - Sits unobtrusively near the bottom of the map
 * - Cell tap inspection with exact values, category, and source
 * - Close button (x) hides the legend without disabling the heatmap
 * - Neutral treatment for NO_COVERAGE and INSUFFICIENT_DATA
 */

'use client';

import React, { useState } from 'react';
import { useHeatmapStore } from '@/stores/useHeatmapStore';
import { CloseIcon, RefreshIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/common/Icons';

interface IntelligenceLegendSheetProps {
  isMobile?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function IntelligenceLegendSheet({
  isMobile = false,
  className,
  style,
}: IntelligenceLegendSheetProps) {
  const {
    status,
    metric,
    subMetric,
    cells,
    stats,
    selectedCell,
    isLegendVisible,
    legendMetadata,
    error,
    lastFetchedAt,
    setLegendVisible,
    setSelectedCell,
    retry,
  } = useHeatmapStore();

  const [isExpandedMobile, setIsExpandedMobile] = useState(false);

  // If heatmap is off or legend is explicitly closed, do not render
  if (status === 'OFF' || !isLegendVisible) {
    return null;
  }

  // Determine Title based on active metric
  const getTitle = () => {
    if (legendMetadata?.title) return legendMetadata.title;
    switch (metric) {
      case 'AQI':
        return 'Air quality in this area';
      case 'TRAFFIC':
        return 'Traffic in this area';
      case 'WEATHER':
        return 'Weather stress in this area';
      case 'POPULATION':
        return 'Population density in this area';
      default:
        return `${metric} in this area`;
    }
  };

  // Continuous gradient strings (100% matched with deck.gl HeatmapLayer colorRanges)
  const getGradient = () => {
    if (legendMetadata?.gradient) return legendMetadata.gradient;
    switch (metric) {
      case 'AQI':
        return 'linear-gradient(to right, #22C55E 0%, #EAB308 25%, #F97316 50%, #EF4444 75%, #9F1239 100%)';
      case 'TRAFFIC':
        return 'linear-gradient(to right, #10B981 0%, #F59E0B 33%, #EA580C 66%, #DC2626 100%)';
      case 'WEATHER':
        return 'linear-gradient(to right, #3B82F6 0%, #06B6D4 33%, #F59E0B 66%, #DC2626 100%)';
      case 'POPULATION':
        return 'linear-gradient(to right, #22C55E 0%, #EAB308 50%, #EF4444 100%)';
      default:
        return 'linear-gradient(to right, #22C55E 0%, #EAB308 50%, #EF4444 100%)';
    }
  };

  // Threshold and category stops
  const getStops = () => {
    if (legendMetadata?.stops && legendMetadata.stops.length > 0) {
      return legendMetadata.stops;
    }
    switch (metric) {
      case 'AQI':
        return [
          { value: 0, label: '0' },
          { value: 50, label: '50' },
          { value: 100, label: '100' },
          { value: 200, label: '200' },
          { value: 300, label: '300' },
          { value: 500, label: '500' },
        ];
      case 'TRAFFIC':
        return [
          { value: 0, label: 'Free' },
          { value: 1, label: 'Moderate' },
          { value: 2, label: 'Heavy' },
          { value: 3, label: 'Severe' },
        ];
      case 'WEATHER':
        return [
          { value: 0, label: 'Low' },
          { value: 1, label: 'Moderate' },
          { value: 2, label: 'High' },
          { value: 3, label: 'Severe' },
        ];
      case 'POPULATION':
        return [
          { value: 0, label: 'Low (<1k)' },
          { value: 1, label: 'Medium (5k)' },
          { value: 2, label: 'High (15k+)' },
        ];
      default:
        return [
          { value: 0, label: 'Low' },
          { value: 1, label: 'Moderate' },
          { value: 2, label: 'High' },
        ];
    }
  };

  const getSource = () => {
    if (legendMetadata?.source) return legendMetadata.source;
    switch (metric) {
      case 'AQI':
        return 'Open-Meteo Air Quality (CAMS)';
      case 'TRAFFIC':
        return 'TomTom Orbis Traffic Flow';
      case 'WEATHER':
        return 'Open-Meteo Global Forecasting';
      case 'POPULATION':
        return 'NASA SEDAC (ArcGIS) & WorldPop (SDI)';
      default:
        return 'UrbanPulse Spatial Intelligence';
    }
  };

  const formatTimeAgo = (isoStr?: string | null) => {
    if (!isoStr) return 'just now';
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'just now';
      if (diffMin === 1) return '1 min ago';
      if (diffMin < 60) return `${diffMin} min ago`;
      const diffHr = Math.floor(diffMin / 60);
      return `${diffHr}h ago`;
    } catch {
      return 'recently';
    }
  };

  // State checks
  const isBoundaryError = status === 'BOUNDARY_PROVIDER_ERROR';
  const isError = status === 'PROVIDER_ERROR' || status === 'ERROR' || isBoundaryError;
  const isNoData = !isError && (status === 'EMPTY_DATA' || status === 'NO_COVERAGE' || (status === 'READY' && cells.length === 0));
  const isLoading = status === 'LOADING';

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        ...(isMobile
          ? {
              bottom: '12px',
              left: '12px',
              right: '12px',
              maxHeight: isExpandedMobile ? '65vh' : 'auto',
              borderRadius: '16px',
            }
          : {
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '380px',
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: '14px',
            }),
        backgroundColor: 'rgba(255, 255, 255, 0.97)',
        backdropFilter: 'blur(16px)',
        border: '1px solid #E2E8F0',
        boxShadow: '0 8px 32px rgba(15, 23, 42, 0.14)',
        zIndex: 35,
        pointerEvents: 'auto',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      role="region"
      aria-label="Intelligence Legend"
    >
      {/* Mobile Drawer Grab Handle */}
      {isMobile && (
        <div
          onClick={() => setIsExpandedMobile(!isExpandedMobile)}
          style={{
            width: '100%',
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            paddingTop: '6px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              backgroundColor: '#CBD5E1',
              borderRadius: '2px',
            }}
          />
        </div>
      )}

      {/* Sheet Header: Title, Metric Badge, and Close Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 8px 16px',
          borderBottom: selectedCell || isExpandedMobile ? '1px solid #F1F5F9' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F172A',
              letterSpacing: '-0.2px',
            }}
          >
            {getTitle()}
          </span>
          {isLoading && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#2563EB',
                backgroundColor: '#EFF6FF',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              Syncing...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsExpandedMobile(!isExpandedMobile)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: '#64748B',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              aria-label={isExpandedMobile ? 'Collapse details' : 'Expand details'}
            >
              {isExpandedMobile ? <ChevronDownIcon size={14} /> : <ChevronUpIcon size={14} />}
            </button>
          )}

          {/* Close Sheet Button (Hides legend without disabling heatmap) */}
          <button
            type="button"
            onClick={() => setLegendVisible(false)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: '#94A3B8',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Hide legend (keeps heatmap active)"
            aria-label="Hide legend"
          >
            <CloseIcon size={14} color="#64748B" />
          </button>
        </div>
      </div>

      {/* Selected Cell Inspection Bar (Displayed when a cell/area is tapped) */}
      {selectedCell && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Selected:</span>
              <span style={{ fontSize: '12px', color: '#0F172A', fontWeight: 700 }}>
                {selectedCell.rawValue !== undefined && selectedCell.rawValue !== null
                  ? `${selectedCell.rawValue} ${legendMetadata?.unit || ''}`
                  : `${Math.round(selectedCell.value)} ${legendMetadata?.unit || ''}`}
              </span>
              {selectedCell.category && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor:
                      selectedCell.category === 'GOOD' || selectedCell.category === 'LOW'
                        ? '#DCFCE7'
                        : selectedCell.category === 'MODERATE' || selectedCell.category === 'MEDIUM'
                        ? '#FEF9C3'
                        : selectedCell.category === 'HIGH' || selectedCell.category === 'UNHEALTHY'
                        ? '#FFEDD5'
                        : '#FEE2E2',
                    color:
                      selectedCell.category === 'GOOD' || selectedCell.category === 'LOW'
                        ? '#166534'
                        : selectedCell.category === 'MODERATE' || selectedCell.category === 'MEDIUM'
                        ? '#854D0E'
                        : selectedCell.category === 'HIGH' || selectedCell.category === 'UNHEALTHY'
                        ? '#9A3412'
                        : '#991B1B',
                  }}
                >
                  {selectedCell.category}
                </span>
              )}
            </div>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>
              ({selectedCell.latitude.toFixed(4)}, {selectedCell.longitude.toFixed(4)})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedCell(null)}
            style={{
              fontSize: '11px',
              color: '#2563EB',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              padding: '2px 6px',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Main Card Body */}
      <div style={{ padding: '10px 16px 12px 16px' }}>
        {/* Case 1: Error State */}
        {isError ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: '#FEF2F2',
              borderRadius: '8px',
              border: '1px solid #FCA5A5',
            }}
          >
            <span style={{ fontSize: '11.5px', color: '#991B1B', fontWeight: 600 }}>
              {isBoundaryError
                ? 'Administrative boundary service unavailable (ArcGIS)'
                : metric === 'POPULATION'
                ? 'Population layer unavailable.'
                : 'Intelligence layer unavailable'}
            </span>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#FFFFFF',
                backgroundColor: '#DC2626',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              <RefreshIcon size={11} color="#FFFFFF" />
              Retry
            </button>
          </div>
        ) : isNoData ? (
          /* Case 2: Insufficient Data / No Coverage State (Neutral treatment, No fake colorful gradient) */
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#F1F5F9',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748B',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            {status === 'NO_COVERAGE' ? 'No spatial coverage in this area' : 'Insufficient spatial data'}
          </div>
        ) : (
          /* Case 3: Standard Active Gradient & Thresholds */
          <div>
            {/* Continuous Color Gradient Bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '999px',
                background: getGradient(),
                boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
                marginBottom: '6px',
              }}
              aria-hidden="true"
            />

            {/* Threshold Labels Aligned with Gradient */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '10.5px',
                fontWeight: 600,
                color: '#64748B',
                lineHeight: 1,
              }}
            >
              {getStops().map((stop, idx) => (
                <span key={idx}>{stop.label}</span>
              ))}
            </div>

            {/* Population Context Notice: Density, Not Danger */}
            {metric === 'POPULATION' && (
              <div
                style={{
                  fontSize: '9.5px',
                  color: '#64748B',
                  marginTop: '6px',
                  lineHeight: '1.4',
                }}
              >
                <div><strong>Population Density</strong> • Dataset Year: 2010 (Visual) / 2020 (Stats)</div>
                <div style={{ fontStyle: 'italic', color: '#94A3B8' }}>
                  NASA SEDAC & WorldPop SDI • Historical Census • Never labeled Live
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card Footer: Timestamp and Provider Attribution */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid #F1F5F9',
            fontSize: '9.5px',
            color: '#94A3B8',
          }}
        >
          <span>
            {metric === 'POPULATION'
              ? 'Dataset: 2010 / 2020 (Historical)'
              : `Updated ${formatTimeAgo(lastFetchedAt || legendMetadata?.updatedAt)}`}
          </span>
          <span>
            Source: {getSource()}
          </span>
        </div>
      </div>
    </div>
  );
}
