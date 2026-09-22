'use client';

import React from 'react';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { PinIcon } from '@/components/common/Icons';

interface NexusHeaderProps {
  locationName?: string | null;
}

export default function NexusHeader({ locationName }: NexusHeaderProps) {
  return (
    <div
      style={{
        height: '60px',
        padding: '0 16px',
        borderBottom: '1px solid var(--border, #E2E7EF)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-header, #FFFFFF)',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <UrbanPulseLogo size={28} />
        <div>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary, #172033)',
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            UrbanPulse Nexus
          </h2>
          <span
            style={{
              fontSize: '11.5px',
              color: 'var(--text-muted, #7B8798)',
              display: 'block',
              lineHeight: 1.1,
            }}
          >
            AI Geospatial Intelligence
          </span>
        </div>
      </div>

      {locationName && (
        <span
          style={{
            fontSize: '11.5px',
            height: '30px',
            padding: '0 10px',
            borderRadius: '16px',
            backgroundColor: 'var(--location-badge-bg, #EFF6FF)',
            color: 'var(--location-badge-text, #2563EB)',
            border: '1px solid var(--location-badge-border, #BFDBFE)',
            fontWeight: 600,
            maxWidth: '150px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            flexShrink: 0,
          }}
          title={locationName}
        >
          <PinIcon size={12} color="currentColor" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {locationName}
          </span>
        </span>
      )}
    </div>
  );
}
