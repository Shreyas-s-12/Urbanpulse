'use client';

import React from 'react';
import { NexusStructuredResponse } from '@shared/types';
import { useAgentStore } from '@/stores/useAgentStore';

interface NexusRankingResponseProps {
  response: NexusStructuredResponse;
  rawRanking?: any;
}

export const NexusRankingResponse: React.FC<NexusRankingResponseProps> = ({ response, rawRanking }) => {
  const ranking = rawRanking || response.metadata?.ranking;
  const results = response.results || ranking?.results || [];
  const meta = response.metadata || ranking || {};
  const { sendMessage, showRankedMarkers } = useAgentStore();

  const metric = meta.metric || 'AQI';
  const scope = meta.scope || 'Region';
  const coverage = meta.coverage !== undefined ? `${meta.coverage}%` : '100%';
  const validCount = meta.validCount || results.length;
  const candidateCount = meta.candidateCount || results.length;
  const sourceName = (response.sources && response.sources[0]?.name) || meta.source || 'Verified Telemetry Feeds';

  const getCategoryColor = (cat: string) => {
    const c = (cat || '').toUpperCase();
    if (c.includes('SEVERE') || c.includes('HAZARDOUS') || c.includes('VERY UNHEALTHY') || c.includes('HOTTEST') || c.includes('HEAVY') || c.includes('GRIDLOCK')) {
      return { bg: 'var(--status-critical-bg)', text: 'var(--status-critical-text)', border: 'var(--status-critical-border)' };
    }
    if (c.includes('POOR') || c.includes('UNHEALTHY') || c.includes('HIGH') || c.includes('WARM') || c.includes('MODERATE')) {
      return { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' };
    }
    if (c.includes('GOOD') || c.includes('SATISFACTORY') || c.includes('COOL') || c.includes('FREE')) {
      return { bg: 'var(--status-good-bg)', text: 'var(--status-good-text)', border: 'var(--status-good-border)' };
    }
    return { bg: 'var(--bg-surface-secondary)', text: 'var(--text-secondary)', border: 'var(--border-subtle)' };
  };

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)' }}>
            RANKING INTELLIGENCE
          </span>
          <h4 style={{ margin: '2px 0 0 0', fontSize: '13.5px', fontWeight: 750, color: 'var(--text-primary)' }}>
            {response.title}
          </h4>
        </div>
        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-secondary)' }}>
          {coverage} Coverage
        </span>
      </div>

      {/* Summary */}
      {response.summary && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {response.summary}
        </p>
      )}

      {/* Table of ranked results */}
      {results.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-secondary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '6px 8px', fontWeight: 700, width: '45px' }}>Rank</th>
                <th style={{ padding: '6px 8px', fontWeight: 700 }}>Entity</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Observed</th>
                <th style={{ padding: '6px 8px', fontWeight: 700 }}>Classification</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item: any, idx: number) => {
                const catStyle = getCategoryColor(item.category);
                const displayVal = item.value !== undefined ? (
                  metric === 'TEMPERATURE' ? `${Number(item.value).toFixed(1)}°C` :
                  metric === 'TRAFFIC' ? `${Number(item.value).toFixed(2)}x` :
                  metric === 'POPULATION' ? Number(item.value).toLocaleString() :
                  String(Math.round(Number(item.value)))
                ) : '—';

                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: idx === results.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-surface-secondary)',
                    }}
                  >
                    <td style={{ padding: '6px 8px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      #{item.rank || idx + 1}
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 650, color: 'var(--text-primary)' }}>
                      {item.name}
                      {item.geography?.lat && (
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {item.geography.lat.toFixed(2)}°N, {item.geography.lon.toFixed(2)}°E
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {displayVal}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: catStyle.bg,
                          color: catStyle.text,
                          border: `1px solid ${catStyle.border}`,
                        }}
                      >
                        {item.category || 'Nominal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Metadata & Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
          <span>• <strong>Scope:</strong> {scope}</span>
          <span>• <strong>Sample:</strong> {validCount}/{candidateCount} valid</span>
          <span>• <strong>Source:</strong> {sourceName}</span>
        </div>

        {/* Map Plot action trigger if not already active */}
        {!showRankedMarkers && (
          <div style={{ marginTop: '2px' }}>
            <button
              type="button"
              onClick={() => sendMessage('Show them on the map')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: 650,
                borderRadius: '6px',
                backgroundColor: 'var(--badge-info-bg)',
                color: 'var(--badge-info-text)',
                border: '1px solid var(--badge-info-border)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Show numbered badges on the map
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default NexusRankingResponse;
