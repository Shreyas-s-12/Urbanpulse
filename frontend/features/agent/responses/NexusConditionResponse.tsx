'use client';

import React from 'react';
import { NexusStructuredResponse } from '@shared/types';

interface NexusConditionResponseProps {
  response: NexusStructuredResponse;
  data?: any;
}

export const NexusConditionResponse: React.FC<NexusConditionResponseProps> = ({ response, data }) => {
  const meta = response.metadata || {};
  const sections = response.sections || [];
  const kvSection = sections.find(s => s.type === 'key_values') || sections[0];
  const keyValues = kvSection?.keyValues || kvSection?.key_values || meta.keyValues || {};
  const sourceName = (response.sources && response.sources[0]?.name) || meta.source || 'Verified Provider';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', fontSize: '12.5px' }}>
      {/* Title */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)' }}>
          CURRENT CONDITIONS
        </span>
        <h4 style={{ margin: '1px 0 0 0', fontSize: '13.5px', fontWeight: 750, color: 'var(--text-primary)' }}>
          {response.title}
        </h4>
      </div>

      {/* Summary / Primary Value Banner */}
      {response.summary && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent-primary-light, #EFF6FF)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-primary, #2563EB)' }}>
            {response.summary}
          </span>
          {meta.category && (
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {meta.category}
            </span>
          )}
        </div>
      )}

      {/* Key-Value Chips */}
      {Object.keys(keyValues).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
          {Object.entries(keyValues).map(([key, val], idx) => (
            <div
              key={idx}
              style={{
                padding: '5px 8px',
                borderRadius: '5px',
                backgroundColor: 'var(--bg-surface-secondary, #F8FAFC)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {key}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: Plain text Source & Freshness */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)', paddingTop: '2px' }}>
        <span>Source: {sourceName}</span>
        <span>Verified Telemetry</span>
      </div>
    </div>
  );
};
export default NexusConditionResponse;
