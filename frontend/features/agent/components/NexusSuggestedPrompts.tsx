'use client';

import React, { useRef } from 'react';

interface NexusSuggestedPromptsProps {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export default function NexusSuggestedPrompts({
  prompts,
  onSelectPrompt,
  disabled,
}: NexusSuggestedPromptsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!prompts || prompts.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="nexus-scrollbar-hidden"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        overflowX: 'auto',
        overflowY: 'hidden',
        whiteSpace: 'nowrap',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-header)',
        scrollbarWidth: 'none',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {prompts.map((prompt, i) => (
        <button
          key={i}
          type="button"
          onClick={() => !disabled && onSelectPrompt(prompt)}
          disabled={disabled}
          style={{
            height: '34px',
            padding: '0 14px',
            borderRadius: '18px',
            backgroundColor: 'var(--assistant-card-bg)',
            border: '1px solid var(--assistant-card-border)',
            color: 'var(--text-secondary)',
            fontSize: '11.5px',
            fontWeight: 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = 'var(--assistant-card-border)';
              e.currentTarget.style.backgroundColor = 'var(--assistant-card-bg)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
