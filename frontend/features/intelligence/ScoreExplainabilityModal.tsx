'use client';

import React, { useState, useEffect } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { agentService } from '@/services/agentService';
import { ExplainableUrbanScore } from '@shared/types';
import {
  TargetScoreIcon,
  AlertTriangleIcon,
  CheckIcon,
  CloseIcon,
} from '@/components/common/Icons';

export default function ScoreExplainabilityModal() {
  const { showScoreModal, setShowScoreModal, activeScore, activeLocation } = useAgentStore();
  const { currentLocation } = useLocationStore();
  const [localScore, setLocalScore] = useState<ExplainableUrbanScore | null>(activeScore);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loc = activeLocation || currentLocation;

  const fetchScoreData = async () => {
    if (!loc || loc.latitude == null || loc.longitude == null) {
      setError('No active location. Please acquire device location or search for a city.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lat = loc.latitude;
      const lng = loc.longitude;
      const city = loc.city || loc.displayName || 'Active Location';
      const countryCode = loc.countryCode || undefined;

      const data = await agentService.getScore(lat, lng, city, countryCode);
      setLocalScore(data);
    } catch (err: any) {
      console.warn('Failed to fetch score:', err);
      setError('Unable to fetch live score telemetry from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showScoreModal) {
      if (activeScore) {
        setLocalScore(activeScore);
      } else if (!localScore) {
        fetchScoreData();
      }
    }
  }, [showScoreModal, activeScore]);

  if (!showScoreModal) return null;

  const currentScore = localScore || activeScore;
  const score = currentScore?.score ?? null;
  const trend = currentScore?.trend || 'STABLE';
  const trendSymbol = trend === 'IMPROVING' ? '↑ Improving' : (trend === 'DETERIORATING' ? '↓ Deteriorating' : '→ Stable');
  const trendColor = trend === 'IMPROVING' ? 'var(--status-good-text)' : (trend === 'DETERIORATING' ? 'var(--status-critical-text)' : 'var(--text-muted)');

  const confPercent = Math.round((currentScore?.confidence || 0.8) * 100);
  const knownSignals = currentScore?.knownSignals || 0;
  const missingSignals = currentScore?.missingSignals || 0;

  const scoreColor =
    score === null
      ? 'var(--text-muted)'
      : score >= 80
        ? 'var(--status-good-text)'
        : score >= 65
          ? 'var(--status-warning-text)'
          : score >= 45
            ? 'var(--badge-approx-text)'
            : 'var(--status-critical-text)';

  const components = currentScore?.components || {};

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
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
          backgroundColor: 'var(--bg-panel)',
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
            backgroundColor: 'var(--bg-header)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TargetScoreIcon size={20} color="var(--accent-primary)" />
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
              cursor: 'pointer',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px', backgroundColor: 'var(--bg-panel)' }}>
          {/* Top Score Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card)',
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
                  backgroundColor: 'var(--bg-elevated)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span style={{ fontSize: '28px', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                  {score !== null ? score : '—'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {score !== null ? '/ 100' : 'No Coverage'}
                </span>
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
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
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
                backgroundColor: 'var(--bg-elevated)',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confidence
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: confPercent >= 80 ? 'var(--badge-info-text)' : 'var(--status-warning-text)' }}>
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
                backgroundColor: 'var(--status-warning-bg)',
                border: '1px solid var(--status-warning-border)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--status-warning-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangleIcon size={14} color="var(--status-warning-text)" />
              <span>
                <strong>Confidence penalized</strong>: {missingSignals} signal domain(s) lack public verified feeds for this area. Score weights were re-normalized rather than assuming 100.
              </span>
            </div>
          )}

          {/* Positive and Negative Drivers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div
              style={{
                backgroundColor: 'var(--status-good-bg)',
                border: '1px solid var(--status-good-border)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-good-text)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckIcon size={13} color="var(--status-good-text)" /> Key Positive Drivers
              </div>
              {currentScore?.positiveFactors && currentScore.positiveFactors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--status-good-text)' }}>
                  {currentScore.positiveFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--status-good-text)' }}>No individual domain exceeded 75 points.</div>
              )}
            </div>

            <div
              style={{
                backgroundColor: 'var(--status-critical-bg)',
                border: '1px solid var(--status-critical-border)',
                borderRadius: '12px',
                padding: '14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-critical-text)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CloseIcon size={13} color="var(--status-critical-text)" /> Key Negative Drivers
              </div>
              {currentScore?.negativeFactors && currentScore.negativeFactors.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--status-critical-text)' }}>
                  {currentScore.negativeFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--status-critical-text)' }}>No individual domain dropped below 70 points.</div>
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
                      backgroundColor: 'var(--bg-card)',
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
              backgroundColor: 'var(--bg-card)',
              borderRadius: '10px',
              padding: '14px 16px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Attribution Narrative
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {currentScore?.explanation || 'Deterministic weighted evaluation of real-time sensory feeds across urban transit, atmospheric dispersion, and meteorological conditions.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-header)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => setShowScoreModal(false)}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
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
