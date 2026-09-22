'use client';

import React from 'react';
import { PinIcon, CompassIcon } from '@/components/common/Icons';

interface NexusLocationClarificationProps {
  content: string;
  confidence?: number;
}

export default function NexusLocationClarification({
  content,
  confidence,
}: NexusLocationClarificationProps) {
  return (
    <div
      style={{
        width: '100%',
        backgroundColor: 'var(--assistant-card-bg)',
        border: '1px solid var(--assistant-card-border)',
        borderRadius: '10px',
        padding: '12px 14px',
        boxSizing: 'border-box',
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CompassIcon size={14} color="var(--accent-primary)" />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--accent-primary)',
          }}
        >
          Location clarification
        </span>
      </div>

      {/* Clarification Message */}
      <div
        style={{
          fontSize: '13px',
          lineHeight: 1.45,
          color: 'var(--text-primary)',
        }}
      >
        {content}
      </div>

      {/* Confidence Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--text-muted)',
          paddingTop: '2px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span>Resolution: Clarification needed</span>
        {confidence !== undefined && (
          <span>Confidence: {Math.round(confidence * 100)}%</span>
        )}
      </div>
    </div>
  );
}
