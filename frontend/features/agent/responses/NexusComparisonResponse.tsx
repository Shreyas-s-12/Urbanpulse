'use client';

import React from 'react';
import { NexusStructuredResponse } from '@shared/types';

interface NexusComparisonResponseProps {
  response: NexusStructuredResponse;
  rawComparison?: any;
}

export const NexusComparisonResponse: React.FC<NexusComparisonResponseProps> = ({ response, rawComparison }) => {
  const comparison = rawComparison || response.metadata?.comparison || response.metadata?.cityComparison;
  const cities: any[] = comparison?.cities || [];
  const matrix: any[] = comparison?.matrix || [];
  const verdict: string = comparison?.verdict || response.summary || '';
  const sourceName = (response.sources && response.sources[0]?.name) || 'UrbanPulse Comparative Engine';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', fontSize: '12.5px' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)' }}>
          COMPARATIVE INTELLIGENCE
        </span>
        <h4 style={{ margin: '2px 0 0 0', fontSize: '13.5px', fontWeight: 750, color: 'var(--text-primary)' }}>
          {response.title}
        </h4>
      </div>

      {/* Comparison Matrix Table */}
      {cities.length >= 2 && matrix.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-secondary, #F8FAFC)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 8px', fontWeight: 700 }}>Signal</th>
                {cities.map((c: any, idx: number) => (
                  <th key={idx} style={{ padding: '6px 8px', fontWeight: 750, color: 'var(--text-primary)', textAlign: 'right' }}>
                    {c.cityName || c.name || `Location ${idx + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row: any, rIdx: number) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: rIdx === matrix.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                  }}
                >
                  <td style={{ padding: '6px 8px', fontWeight: 650, color: 'var(--text-secondary)' }}>
                    {row.signal}
                  </td>
                  {cities.map((c: any, cIdx: number) => {
                    const cName = c.cityName || c.name;
                    const val = row.values ? row.values[cName] : '—';
                    return (
                      <td key={cIdx} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {val !== undefined && val !== null ? String(val) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparative Verdict */}
      {verdict && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface-secondary, #F1F5F9)',
            borderLeft: '3px solid var(--accent-primary)',
            fontSize: '12px',
            lineHeight: 1.45,
            color: 'var(--text-primary)',
          }}
        >
          <strong style={{ display: 'block', fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '2px' }}>
            Comparative Verdict
          </strong>
          {verdict}
        </div>
      )}

      {/* Source attribution */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)', paddingTop: '2px' }}>
        <span>Source: {sourceName}</span>
        <span>Standardized Regional Baseline</span>
      </div>
    </div>
  );
};
export default NexusComparisonResponse;
