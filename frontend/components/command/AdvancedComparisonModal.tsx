'use client';

import React, { useState } from 'react';
import { ComparisonResponse } from '@/types/command';
import { commandService } from '@/services/commandService';

interface AdvancedComparisonModalProps {
  onClose: () => void;
}

export default function AdvancedComparisonModal({ onClose }: AdvancedComparisonModalProps) {
  const [loc1, setLoc1] = useState('Mysuru');
  const [loc2, setLoc2] = useState('Bengaluru');
  const [timeWindow, setTimeWindow] = useState('NOW');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!loc1 || !loc2) return;
    try {
      setLoading(true);
      setError(null);
      const res = await commandService.compareEntities(
        [
          { name: loc1, geographyType: 'CITY' },
          { name: loc2, geographyType: 'CITY' },
        ],
        timeWindow
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to compare locations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F9FAFB',
          }}
        >
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
              CROSS-GEOGRAPHY INTELLIGENCE COMPARISON
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '2px 0 0 0' }}>
              Multi-Dimensional Spatial Comparison & Time Travel
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {/* Input Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Entity 1 (City / Region)"
            value={loc1}
            onChange={(e) => setLoc1(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '12px',
              flex: 1,
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>vs</span>
          <input
            type="text"
            placeholder="Entity 2 (City / Region)"
            value={loc2}
            onChange={(e) => setLoc2(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '12px',
              flex: 1,
            }}
          />
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
            }}
          >
            <option value="NOW">Time Travel: Now</option>
            <option value="24_HOURS">Past 24 Hours</option>
            <option value="7_DAYS">Past 7 Days</option>
            <option value="30_DAYS">Past 30 Days</option>
          </select>
          <button
            onClick={handleCompare}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Evaluating…' : 'Compare'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 20px', backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {/* Results Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data ? (
            <>
              {/* Verdict / "Why?" Explanation Card */}
              <div style={{ padding: '14px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>
                  DIVERGENCE EXPLANATION (&quot;WHY?&quot;)
                </span>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#1E3A8A', margin: '4px 0 8px 0' }}>
                  {data.explanation.verdict}
                </p>
                <div style={{ fontSize: '11px', color: '#2563EB' }}>
                  <strong>Attribution Factors:</strong> {data.explanation.primaryFactors.join(' • ')} (Confidence: {Math.round(data.explanation.attributionConfidence * 100)}%)
                </div>
              </div>

              {/* Comparison Matrix Table */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>
                  MULTI-DIMENSIONAL TELEMETRY MATRIX
                </span>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
                      <th style={{ padding: '8px', color: '#6B7280' }}>Dimension</th>
                      {data.entities.map((ent) => (
                        <th key={ent.name} style={{ padding: '8px', color: '#111827', fontWeight: 700 }}>
                          {ent.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparisonMatrix.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '8px', color: '#4B5563', fontWeight: 600 }}>{row.dimension}</td>
                        {data.entities.map((ent) => (
                          <td key={ent.name} style={{ padding: '8px', color: '#1F2937' }}>
                            {row.values[ent.name] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '13px' }}>
              Enter any 2 global cities, regions, or countries above and click Compare to evaluate multi-dimensional urban telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
