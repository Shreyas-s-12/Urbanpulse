'use client';

import React from 'react';
import { CityHealthResponse } from '@/types/command';

interface CityHealthMatrixProps {
  data: CityHealthResponse | null;
  onClose?: () => void;
}

export default function CityHealthMatrix({ data, onClose }: CityHealthMatrixProps) {
  if (!data) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return { bg: '#DEF7EC', text: '#03543F', border: '#BCF0DA' };
      case 'STABLE':
        return { bg: '#E1EFFE', text: '#1E429F', border: '#B4C6FC' };
      case 'WATCH':
        return { bg: '#FEF08A', text: '#713F12', border: '#FDE047' };
      case 'AT_RISK':
        return { bg: '#FDE8E8', text: '#9B1C1C', border: '#F8B4B4' };
      default:
        return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
    }
  };

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
            URBAN SYSTEM HEALTH & RESILIENCE
          </span>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
            {data.locationName}
          </h2>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
            ✕
          </button>
        )}
      </div>

      {/* Resilience Score Card */}
      <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              RESILIENCE SCORE
            </span>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>
              {data.resilienceScore} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748B' }}>/ 100</span>
            </div>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: getStatusColor(data.overallStatus).bg,
              border: `1px solid ${getStatusColor(data.overallStatus).border}`,
              color: getStatusColor(data.overallStatus).text,
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {data.overallStatus}
          </div>
        </div>
        <p style={{ fontSize: '11px', color: '#64748B', margin: '8px 0 0 0' }}>
          Measures municipal multi-system capacity to absorb disruptions across mobility, atmospheric stress, and infrastructure load.
        </p>
      </div>

      {/* 8 Operational Domains */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>
          CORE OPERATIONAL DOMAINS
        </div>
        {data.domains.map((dom) => {
          const colors = getStatusColor(dom.status);
          return (
            <div
              key={dom.domain}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{dom.domain}</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: colors.bg,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {dom.status} ({dom.score})
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#4B5563' }}>{dom.summary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
