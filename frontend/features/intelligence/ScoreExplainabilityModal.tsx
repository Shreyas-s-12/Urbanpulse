'use client';

import React from 'react';
import { useAgentStore } from '@/stores/useAgentStore';

export default function ScoreExplainabilityModal() {
  const { showScoreModal, setShowScoreModal, activeScore } = useAgentStore();

  if (!showScoreModal || !activeScore) return null;

  const score = activeScore.score;
  const trend = activeScore.trend || 'STABLE';
  const trendSymbol = trend === 'IMPROVING' ? '↑ Improving' : (trend === 'DETERIORATING' ? '↓ Deteriorating' : '→ Stable');
  const trendColor = trend === 'IMPROVING' ? '#4ade80' : (trend === 'DETERIORATING' ? '#f87171' : '#94a3b8');

  const confPercent = Math.round((activeScore.confidence || 0.8) * 100);
  const knownSignals = activeScore.knownSignals || 5;
  const missingSignals = activeScore.missingSignals || 1;

  const scoreColor =
    score >= 80 ? '#22c55e' : score >= 65 ? '#eab308' : score >= 45 ? '#f97316' : '#ef4444';

  const components = activeScore.components || {};

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
      onClick={() => setShowScoreModal(false)}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '740px',
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
              <span style={{ fontSize: '22px' }}>💯</span>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                UrbanPulse Explainable Score Breakdown
              </h2>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Deterministic 6-domain weighted composite with transparent signal provenance and zero hallucination.
            </div>
          </div>

          <button
            onClick={() => setShowScoreModal(false)}
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
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: '#FFFFFF' }}>
          {/* Top Score Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '16px',
              padding: '20px 24px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Score circle */}
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  border: `4px solid ${scoreColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  backgroundColor: '#FFFFFF',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span style={{ fontSize: '28px', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                  {score}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>/ 100</span>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Urban Livability Index
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: trendColor,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-subtle)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    {trendSymbol}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Derived from traffic flow, air quality, weather stability, pavement telemetry, and civil safety.
                </div>
              </div>
            </div>

            {/* Confidence Badge */}
            <div
              style={{
                textAlign: 'right',
                backgroundColor: '#FFFFFF',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confidence
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: confPercent >= 80 ? 'var(--accent-primary)' : '#D97706' }}>
                {confPercent}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {knownSignals} verified · {missingSignals} missing
              </div>
            </div>
          </div>

          {/* Missing Feeds Confidence Penalty Alert */}
          {missingSignals > 0 && (
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚠️</span>
              <span>
                <strong>Confidence penalized</strong>: {missingSignals} signal domain(s) lack public verified APIs for this area. Score weights were re-normalized rather than assuming 100.
              </span>
            </div>
          )}

          {/* Positive and Negative Drivers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', marginBottom: '6px' }}>
                ✓ Key Positive Drivers
              </div>
              {activeScore.positiveFactors && activeScore.positiveFactors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#065F46' }}>
                  {activeScore.positiveFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '12px', color: '#059669' }}>No individual domain exceeded 75 points.</div>
              )}
            </div>

            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', marginBottom: '6px' }}>
                ✕ Key Negative Drivers
              </div>
              {activeScore.negativeFactors && activeScore.negativeFactors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#991B1B' }}>
                  {activeScore.negativeFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '12px', color: '#DC2626' }}>No individual domain dropped below 70 points.</div>
              )}
            </div>
          </div>

          {/* Domain Breakdown Table */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Domain Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {Object.entries(components).map(([key, item]: [string, any]) => {
                const itemScore = item.score;
                const isAvail = itemScore !== null && itemScore !== undefined;
                return (
                  <div
                    key={key}
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      borderRadius: '10px',
                      padding: '12px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isAvail ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                        {isAvail ? `${itemScore} / 100` : '—'}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {item.metric || item.status}
                    </div>

                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Weight: {Math.round(item.weight * 100)}% · {item.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Why this score narrative */}
          <div
            style={{
              backgroundColor: 'var(--bg-app)',
              borderRadius: '10px',
              padding: '14px 16px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Attribution Narrative
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {activeScore.explanation}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => setShowScoreModal(false)}
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
