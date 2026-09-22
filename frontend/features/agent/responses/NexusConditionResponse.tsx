'use client';

import React, { useState } from 'react';
import { NexusStructuredResponse } from '@shared/types';
import { ChevronDownIcon } from '@/components/common/Icons';

interface NexusConditionResponseProps {
  response: NexusStructuredResponse;
  data?: any;
}

export const NexusConditionResponse: React.FC<NexusConditionResponseProps> = ({ response, data }) => {
  const [showDetails, setShowDetails] = useState(false);
  const meta = response.metadata || {};
  const sections = response.sections || [];
  const kvSection = sections.find(s => s.type === 'key_values') || sections[0];
  const keyValues = kvSection?.keyValues || kvSection?.key_values || meta.keyValues || {};
  const sourceName = (response.sources && response.sources[0]?.name) || meta.source || 'Verified Provider';
  const confidence = meta.confidence !== undefined 
    ? Math.round(meta.confidence * 100) 
    : (response as any).confidence !== undefined 
    ? Math.round((response as any).confidence * 100) 
    : 90;

  // Derive weather city name or title
  const displayTitle = response.title.startsWith('Weather:')
    ? response.title
    : `Weather: ${response.title}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
        backgroundColor: 'var(--assistant-card-bg)',
        border: '1px solid var(--assistant-card-border)',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: 'var(--card-shadow)',
        boxSizing: 'border-box',
      }}
    >
      {/* Current Conditions Header */}
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--accent-primary)',
            display: 'block',
          }}
        >
          CURRENT CONDITIONS
        </span>
        <h4
          style={{
            margin: '4px 0 0 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
          }}
        >
          {displayTitle}
        </h4>
      </div>

      {/* Subtle Weather Summary */}
      {response.summary && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--badge-info-bg)',
            border: '1px solid var(--badge-info-border)',
            color: 'var(--badge-info-text)',
            fontSize: '12.5px',
            lineHeight: 1.45,
            fontWeight: 500,
          }}
        >
          {response.summary}
        </div>
      )}

      {/* Compact 2-Column Metrics Grid */}
      {Object.keys(keyValues).length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '6px 8px',
          }}
        >
          {Object.entries(keyValues).map(([key, val], idx) => (
            <div
              key={idx}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-secondary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {key}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Metadata Row: Source, Confidence & Subtle Know More */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10.5px',
          color: 'var(--text-muted)',
          paddingTop: '2px',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Source: <strong style={{ color: 'var(--text-secondary)' }}>{sourceName}</strong></span>
          <span>•</span>
          <span>Confidence: <strong style={{ color: 'var(--text-secondary)' }}>{confidence}%</strong></span>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '10.5px',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            backgroundColor: 'transparent',
            border: 'none',
            padding: '2px 4px',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          <span>Know more</span>
          <ChevronDownIcon
            size={10}
            style={{
              transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
      </div>

      {/* Expanded Provenance Details */}
      {showDetails && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Telemetry Provider:</span>
            <span>{sourceName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Signal Freshness:</span>
            <span style={{ color: 'var(--status-good-text)', fontWeight: 600 }}>Live Telemetry</span>
          </div>
          {response.sources && response.sources.length > 0 && response.sources[0]?.detail && (
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {response.sources[0].detail}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NexusConditionResponse;
