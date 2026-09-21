'use client';

import React from 'react';

export type EvidenceType = 'FACT' | 'MODEL_PREDICTION' | 'INFERENCE' | 'HISTORICAL_CONTEXT';
export type DataStatus = 'AVAILABLE' | 'PARTIAL' | 'NO_COVERAGE' | 'STALE' | 'ERROR';

export interface EvidenceCitation {
  source: string;
  title: string;
  date: string;
  relevance: number;
  location?: string | null;
  evidenceSnippet: string;
  link?: string | null;
  evidenceType: EvidenceType;
  dataStatus?: DataStatus;
}

interface EvidenceCitationCardProps {
  citation: EvidenceCitation;
}

const BADGE_COLORS: Record<EvidenceType, { bg: string; text: string; border: string }> = {
  FACT: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  MODEL_PREDICTION: { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
  INFERENCE: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  HISTORICAL_CONTEXT: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
};

export default function EvidenceCitationCard({ citation }: EvidenceCitationCardProps) {
  const badge = BADGE_COLORS[citation.evidenceType] || BADGE_COLORS.FACT;
  const formattedDate = citation.date ? citation.date.split('T')[0] : 'Current';
  const relevancePct = Math.round(citation.relevance * 100);

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E2E8F0',
        padding: '12px 14px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Header with Type Badge and Relevance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <span
          style={{
            fontSize: '9.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '2px 7px',
            borderRadius: '4px',
            backgroundColor: badge.bg,
            color: badge.text,
            border: `1px solid ${badge.border}`,
          }}
        >
          {citation.evidenceType.replace('_', ' ')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748B' }}>
          {citation.location && <span>{citation.location}</span>}
          <span>Relevance {relevancePct}%</span>
        </div>
      </div>

      {/* Document Title */}
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', lineHeight: 1.35 }}>
        {citation.title}
      </div>

      {/* Evidence Snippet */}
      <p style={{ margin: 0, fontSize: '11.5px', color: '#334155', lineHeight: 1.45 }}>
        {citation.evidenceSnippet}
      </p>

      {/* Footer: Source + Date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10.5px',
          color: '#64748B',
          marginTop: '4px',
          paddingTop: '6px',
          borderTop: '1px solid #F1F5F9',
        }}
      >
        <span style={{ fontWeight: 600 }}>Source: {citation.source}</span>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
}
