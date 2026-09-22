'use client';

import React from 'react';

export default function NexusThinkingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '12px',
        backgroundColor: 'var(--assistant-card-bg, #FFFFFF)',
        border: '1px solid var(--assistant-card-border, #E2E7EF)',
        boxShadow: 'var(--card-shadow, 0 2px 6px rgba(15, 23, 42, 0.04))',
        width: 'fit-content',
        alignSelf: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      {/* Three Animated Bouncing/Pulsing Dots */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary, #2563EB)',
            animation: 'nexusDotPulse 1.2s infinite ease-in-out',
            animationDelay: '0s',
          }}
        />
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary, #2563EB)',
            animation: 'nexusDotPulse 1.2s infinite ease-in-out',
            animationDelay: '0.2s',
          }}
        />
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary, #2563EB)',
            animation: 'nexusDotPulse 1.2s infinite ease-in-out',
            animationDelay: '0.4s',
          }}
        />
      </span>

      <span
        style={{
          fontSize: '11.5px',
          color: 'var(--text-muted, #7B8798)',
          fontWeight: 500,
        }}
      >
        Thinking...
      </span>
    </div>
  );
}
