'use client';

import React, { useState, useEffect } from 'react';

export interface PredictionFactor {
  factorName: string;
  prediction: string;
  confidence: number;
  historicalBasis: string;
  source: string;
  evidence: string;
  status: 'AVAILABLE' | 'PARTIAL' | 'INSUFFICIENT_HISTORICAL_DATA';
}

interface PredictionData {
  targetYear: number;
  requestedYear: number;
  previousYear: number;
  factors: PredictionFactor[];
  modelProvenance: string;
  generatedAt: string;
  explanation: string;
}

interface RAGPredictionSectionProps {
  module: 'georag' | 'crisisrag' | 'aquarag';
  moduleTitle: string;
  latitude: number;
  longitude: number;
  locationName: string;
  cityName: string;
}

export default function RAGPredictionSection({
  module,
  moduleTitle,
  latitude,
  longitude,
  locationName,
  cityName,
}: RAGPredictionSectionProps) {
  const currentYear = new Date().getFullYear();
  const [targetYear, setTargetYear] = useState<number>(2028);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PredictionData | null>(null);

  const fetchPrediction = React.useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl}/api/v1/${module}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetYear: year,
          latitude,
          longitude,
          locationName,
          cityName,
        }),
      });

      if (!res.ok) {
        throw new Error(`Prediction API returned ${res.status}`);
      }

      const resJson = await res.json();
      setData(resJson);
    } catch (err: any) {
      setError(err.message || 'Failed to generate domain prediction');
    } finally {
      setLoading(false);
    }
  }, [module, latitude, longitude, locationName, cityName]);

  // Trigger initial prediction on mount
  useEffect(() => {
    fetchPrediction(targetYear);
  }, [fetchPrediction, targetYear]);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        padding: '20px',
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header & Year Input */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Predictive Domain Modeling
          </div>
          <h2 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {moduleTitle} Multi-Factor Forecast
          </h2>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Dynamic kinematic projection calibrated against empirical multi-year baselines.
          </div>
        </div>

        {/* Dynamic Year Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Target Horizon:
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[2027, 2028, 2030].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setTargetYear(yr);
                  fetchPrediction(yr);
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: targetYear === yr ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: targetYear === yr ? 'var(--accent-primary-light)' : 'var(--bg-card)',
                  color: targetYear === yr ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: targetYear === yr ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {yr}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchPrediction(targetYear);
            }}
            style={{ display: 'flex', gap: '4px' }}
          >
            <input
              type="number"
              min={currentYear}
              max="2035"
              value={targetYear}
              onChange={(e) => setTargetYear(parseInt(e.target.value, 10) || currentYear)}
              style={{
                width: '68px',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--input-border)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textAlign: 'center',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: 'var(--button)',
                color: 'var(--button-foreground)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Run
            </button>
          </form>
        </div>
      </div>

      {/* Dynamic requestedYear & previousYear lineage display */}
      {data && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-card)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span>Requested Target: <strong>{data.requestedYear}</strong></span>
          <span>·</span>
          <span>Historical Calibration Baseline: <strong>{data.previousYear}</strong></span>
          <span>·</span>
          <span>Model: {data.modelProvenance}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 600 }}>
          Computing four-factor predictive kinematic equations…
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ backgroundColor: 'var(--badge-danger-bg)', border: '1px solid var(--badge-danger-border)', borderRadius: '6px', padding: '10px 14px', color: 'var(--badge-danger-text)', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {/* 4 Factor Cards Grid */}
      {data && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {data.factors.map((factor, idx) => {
              const isInsufficient = factor.status === 'INSUFFICIENT_HISTORICAL_DATA';
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: isInsufficient ? 'var(--badge-warning-bg)' : 'var(--bg-card)',
                    borderRadius: '8px',
                    border: isInsufficient ? '1px solid var(--badge-warning-border)' : '1px solid var(--border-subtle)',
                    padding: '14px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {factor.factorName}
                    </span>
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: isInsufficient ? 'var(--badge-warning-bg)' : 'var(--badge-info-bg)',
                        color: isInsufficient ? 'var(--badge-warning-text)' : 'var(--badge-info-text)',
                        border: isInsufficient ? '1px solid var(--badge-warning-border)' : '1px solid var(--badge-info-border)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isInsufficient ? 'INSUFFICIENT HISTORICAL DATA' : `Conf ${Math.round(factor.confidence * 100)}%`}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: 700, color: isInsufficient ? 'var(--badge-warning-text)' : 'var(--text-primary)', lineHeight: 1.35 }}>
                    {factor.prediction}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    <strong>Historical Basis:</strong> {factor.historicalBasis}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    <strong>Evidence:</strong> {factor.evidence}
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                    Source: {factor.source}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Model Explanation */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              borderLeft: '3px solid var(--accent-primary)',
              padding: '10px 14px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <strong>Domain Synthesis:</strong> {data.explanation}
          </div>
        </>
      )}
    </div>
  );
}
