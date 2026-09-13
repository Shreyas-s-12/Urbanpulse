'use client';

import React from 'react';
import { useAgentStore } from '@/stores/useAgentStore';

export default function CityComparisonModal() {
  const { showComparisonModal, setShowComparisonModal, activeComparison } = useAgentStore();

  if (!showComparisonModal || !activeComparison) return null;

  const cities = activeComparison.cities || [];
  const matrix = activeComparison.matrix || [];
  const verdict = activeComparison.verdict || '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.4)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => setShowComparisonModal(false)}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-panel)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px' }}>⚖️</span>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Multi-City Urban Comparison
              </h2>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Independent resolution of {cities.length} locations across standardized domain metrics. Missing values formatted as '—'.
            </div>
          </div>

          <button
            onClick={() => setShowComparisonModal(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#FFFFFF' }}>
          {/* Comparative Verdict Callout */}
          {verdict && (
            <div
              style={{
                backgroundColor: 'var(--accent-primary-light)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                borderRadius: '12px',
                padding: '16px 18px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Comparative Verdict
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {verdict}
              </div>
            </div>
          )}

          {/* Comparison Matrix Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Signal Domain
                  </th>
                  {cities.map((city, idx) => (
                    <th
                      key={idx}
                      style={{
                        textAlign: 'center',
                        padding: '10px 14px',
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-app)',
                      }}
                    >
                      {(city as any).cityName || city.location?.city || city.location?.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, rIdx) => {
                  const isScore = row.signal === 'UrbanPulse Score';
                  return (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isScore ? 'var(--accent-primary-light)' : (rIdx % 2 === 0 ? 'transparent' : 'var(--bg-app)'),
                      }}
                    >
                      <td style={{ padding: '12px 14px', color: isScore ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: isScore ? 700 : 500 }}>
                        {row.signal}
                      </td>
                      {cities.map((city, cIdx) => {
                        const cName = (city as any).cityName || city.location?.city || city.location?.displayName;
                        const val = row.values?.[cName] ?? '—';
                        return (
                          <td
                            key={cIdx}
                            style={{
                              textAlign: 'center',
                              padding: '12px 14px',
                              fontWeight: isScore ? 800 : 600,
                              fontSize: isScore ? '14px' : '12px',
                              color: val === '—' ? 'var(--text-muted)' : (isScore ? 'var(--accent-primary)' : 'var(--text-primary)'),
                            }}
                          >
                            {String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <span>Telemetry gathered independently without cross-city cache bleeding.</span>
          <button
            onClick={() => setShowComparisonModal(false)}
            style={{
              backgroundColor: '#FFFFFF',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
