'use client';

import React from 'react';
import { NexusStructuredResponse } from '@shared/types';

interface NexusExplanationResponseProps {
  response: NexusStructuredResponse;
  data?: any;
}

export const NexusExplanationResponse: React.FC<NexusExplanationResponseProps> = ({ response, data }) => {
  const meta = response.metadata || {};
  const sections = response.sections || [];
  const sourceName = (response.sources && response.sources[0]?.name) || meta.source || 'UrbanPulse Explainability Engine';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', fontSize: '12.5px' }}>
      {/* Title */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
        <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)' }}>
          EXPLAINABLE EVIDENCE
        </span>
        <h4 style={{ margin: '1px 0 0 0', fontSize: '13.5px', fontWeight: 750, color: 'var(--text-primary)' }}>
          {response.title}
        </h4>
      </div>

      {/* Summary */}
      {response.summary && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.45, fontWeight: 550 }}>
          {response.summary}
        </p>
      )}

      {/* Structured Sections */}
      {sections.map((sec, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-secondary, #F8FAFC)', border: '1px solid var(--border-subtle)' }}>
          {sec.title && (
            <span style={{ fontSize: '10.5px', fontWeight: 750, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              {sec.title}
            </span>
          )}
          {sec.content && (
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {sec.content}
            </p>
          )}
          {sec.items && sec.items.length > 0 && (
            <ul style={{ margin: '2px 0 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sec.items.map((item, itemIdx) => (
                <li key={itemIdx} style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Non-causal scientific notice */}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
        All multi-signal relationships represent empirical spatial/temporal associations without asserting unproven causality.
      </div>

      {/* Source attribution */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
        <span>Source: {sourceName}</span>
        <span>Deterministic Evidence Chain</span>
      </div>
    </div>
  );
};
export default NexusExplanationResponse;
