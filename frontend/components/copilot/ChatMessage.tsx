import React from 'react';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';

/**
 * ChatMessage component renders a single copilot or user message.
 * It uses the universal MarkdownRenderer to safely and semantically render markdown content.
 * Props:
 *  - content: string – markdown text.
 *  - isUser: boolean – true for user messages (right‑aligned bubble).
 *  - citedLiveSignals?: Array<{type:string; source:string; detail:string}> – optional citations.
 *  - suggestedActions?: string[] – optional action chips.
 */
export interface ChatMessageProps {
  content: string;
  isUser: boolean;
  citedLiveSignals?: Array<{ type: string; source: string; detail: string }>;
  suggestedActions?: string[];
  onActionClick?: (action: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  content,
  isUser,
  citedLiveSignals,
  suggestedActions,
  onActionClick,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: '6px',
      }}
    >
      <div
        style={{
          maxWidth: '82%',
          backgroundColor: isUser ? 'var(--accent-blue)' : 'var(--bg-surface)',
          color: isUser ? '#FFFFFF' : 'var(--text-primary)',
          padding: '14px 18px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          fontSize: '13px',
          lineHeight: 1.55,
          border: isUser ? 'none' : '1px solid var(--border-subtle)',
          boxShadow: isUser ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
        }}
      >
        <MarkdownRenderer content={content} isUser={isUser} />
        {citedLiveSignals && citedLiveSignals.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              CITED LIVE SIGNALS & PROVENANCE:
            </span>
            {citedLiveSignals.map((cite, i) => (
              <div
                key={i}
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                  }}
                />
                <strong>[{cite.type}]</strong> via {cite.source}: {cite.detail}
              </div>
            ))}
          </div>
        )}
        {suggestedActions && suggestedActions.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {suggestedActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => onActionClick && onActionClick(action)}
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-blue)',
                  fontWeight: 600,
                  transition: 'all 0.1s ease',
                }}
              >
                {action}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
