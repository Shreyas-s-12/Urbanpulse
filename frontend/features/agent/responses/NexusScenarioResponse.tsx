'use client';

import React from 'react';
import { NexusStructuredResponse } from '@shared/types';

interface NexusScenarioResponseProps {
  response: NexusStructuredResponse;
  data?: any;
}

export const NexusScenarioResponse: React.FC<NexusScenarioResponseProps> = ({ response, data }) => {
  const meta = response.metadata || {};
  const sections = response.sections || [];
  const sourceName = (response.sources && response.sources[0]?.name) || meta.source || 'UrbanPulse Scenario Engine';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', fontSize: '12.5px' }}>
      {/* Simulation Banner */}
      <div style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>SIMULATION MODEL PROJECTION</span>
        <span style={{ fontWeight: 400 }}>— Not a live observation or guaranteed event.</span>
      </div>

      {/* Title */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
        <h4 style={{ margin: '1px 0 0 0', fontSize: '13.5px', fontWeight: 750, color: 'var(--text-primary)' }}>
          {response.title}
        </h4>
      </div>

      {/* Summary */}
      {response.summary && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
          {response.summary}
        </p>
      )}

      {/* Impact & Uncertainty Sections */}
      {sections.map((sec, idx) => (
        <div key={idx} style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-surface-secondary, #F8FAFC)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {sec.title && (
            <span style={{ fontSize: '11px', fontWeight: 750, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              {sec.title}
            </span>
          )}
          {sec.content && (
            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {sec.content}
            </p>
          )}
          {sec.items && (
            <ul style={{ margin: '2px 0 0 0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sec.items.map((it, iIdx) => (
                <li key={iIdx} style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  {it}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Footer: Plain text Source & Limitations */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
        <span>Source: {sourceName}</span>
        <span>Bounded Perturbation Model</span>
      </div>
    </div>
  );
};
export default NexusScenarioResponse;
