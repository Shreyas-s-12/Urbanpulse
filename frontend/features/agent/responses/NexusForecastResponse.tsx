'use client';

import React from 'react';
import { NexusStructuredResponse } from '@shared/types';

interface NexusForecastResponseProps {
  response: NexusStructuredResponse;
  data?: any;
}

export const NexusForecastResponse: React.FC<NexusForecastResponseProps> = ({ response, data }) => {
  const meta = response.metadata || {};
  const sections = response.sections || [];
  const horizon = meta.horizon || '7-DAY';
  const sourceName = (response.sources && response.sources[0]?.name) || meta.source || 'Open-Meteo & Historical Baselines';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        fontSize: '12.5px',
        backgroundColor: 'var(--assistant-card-bg)',
        border: '1px solid var(--assistant-card-border)',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: 'var(--card-shadow)',
        boxSizing: 'border-box',
      }}
    >
      {/* Title with FORECAST badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--badge-info-text)' }}>
            PREDICTIVE FORECAST
          </span>
          <h4 style={{ margin: '1px 0 0 0', fontSize: '13.5px', fontWeight: 750, color: 'var(--text-primary)' }}>
            {response.title}
          </h4>
        </div>
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '4px',
            backgroundColor: 'var(--badge-info-bg)',
            color: 'var(--badge-info-text)',
            border: '1px solid var(--badge-info-border)',
          }}
        >
          {horizon}
        </span>
      </div>

      {/* Summary */}
      {response.summary && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
          {response.summary}
        </p>
      )}

      {/* Sections / Pillar Projections */}
      {sections.map((sec, idx) => (
        <div key={idx} style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {sec.title && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {sec.title}
            </span>
          )}
          {sec.content && (
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {sec.content}
            </span>
          )}
          {sec.items && (
            <ul style={{ margin: '2px 0 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sec.items.map((it, iIdx) => (
                <li key={iIdx} style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  {it}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Footer: Plain text Source & Disclaimer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
        <span>Source: {sourceName}</span>
        <span>Forecast model carries natural temporal uncertainty</span>
      </div>
    </div>
  );
};
export default NexusForecastResponse;
