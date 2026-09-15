'use client';

import React from 'react';
import { DecisionSupportResponse } from '@/types/command';

interface DecisionSupportCardProps {
  data: DecisionSupportResponse | null;
  onClose?: () => void;
}

export default function DecisionSupportCard({ data, onClose }: DecisionSupportCardProps) {
  if (!data) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
        width: '420px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
            DECISION SUPPORT ENGINE
          </span>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
            {data.location}
          </h2>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
            ✕
          </button>
        )}
      </div>

      {/* Conditions Summary */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#EFF6FF', fontSize: '11px', color: '#1E40AF' }}>
        <strong>Objective:</strong> {data.objective.replace('_', ' ').toUpperCase()} | <strong>Traffic State:</strong> {data.currentConditions.trafficStatus} (+{data.currentConditions.delayMinutes}m)
      </div>

      {/* Options List */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>
          EVALUATED ACTIONABLE CHOICES
        </div>
        {data.options.map((opt) => {
          const isRec = opt.recommendationLevel === 'RECOMMENDED';
          return (
            <div
              key={opt.optionId}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: isRec ? '#F0FDF4' : '#FFFFFF',
                border: isRec ? '1px solid #86EFAC' : '1px solid #E5E7EB',
                boxShadow: isRec ? '0 2px 4px rgba(0,0,0,0.04)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{opt.title}</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: isRec ? '#DCFCE7' : '#F3F4F6',
                    color: isRec ? '#166534' : '#4B5563',
                  }}
                >
                  {opt.recommendationLevel}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#4B5563', margin: 0 }}>{opt.summary}</p>

              {/* Benefits */}
              <div style={{ marginTop: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>
                  BENEFITS:
                </span>
                <ul style={{ margin: '2px 0 0 0', paddingLeft: '16px', fontSize: '11px', color: '#15803D' }}>
                  {opt.benefits.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>

              {/* Trade-offs */}
              <div style={{ marginTop: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                  TRADE-OFFS:
                </span>
                <ul style={{ margin: '2px 0 0 0', paddingLeft: '16px', fontSize: '11px', color: '#B45309' }}>
                  {opt.tradeOffs.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '10px', color: '#6B7280' }}>
                <span>Impact: <strong>{opt.estimatedDurationImpact}</strong></span>
                <span>Confidence: <strong>{Math.round(opt.confidence * 100)}%</strong></span>
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: '10px', color: '#9CA3AF', fontStyle: 'italic', marginTop: '8px' }}>
          {data.disclaimer}
        </div>
      </div>
    </div>
  );
}
