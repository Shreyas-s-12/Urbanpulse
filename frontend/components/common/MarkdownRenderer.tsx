'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isUser?: boolean;
}
/**
 * Universal, semantic Markdown renderer for UrbanPulse Agent & Copilot messages.
 * Formats bold text, bulleted/numbered lists, headings, links, and inline code with
 * clean typography aligned with the UrbanPulse light theme.
 * Prevents ordinary text from being interpreted as unsightly grey code blocks.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  isUser = false,
}) => {
  // Sanitize content: prevent raw URLs from being printed directly as visible text
  const sanitizedContent = React.useMemo(() => {
    if (!content) return '';
    // 1. Convert markdown links with URL as text: [https://...](https://...) -> [Verified Reference](https://...)
    let res = content.replace(/\[https?:\/\/[^\]]+\]\((https?:\/\/[^\)]+)\)/gi, '[Verified Reference]($1)');
    // 2. Convert naked URLs: https://... -> [Verified Reference](https://...)
    // Negative lookbehind ensures we don't match URLs already inside markdown parenthesis
    res = res.replace(/(?<!\]\()(?<!\[)(https?:\/\/[^\s\)\],]+)/gi, '[Verified Reference]($1)');
    return res;
  }, [content]);

  if (!content) return null;

  const textColor = isUser ? '#FFFFFF' : 'var(--text-primary)';
  const secondaryColor = isUser ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-secondary)';

  return (
    <div
      className={className}
      style={{
        fontSize: '13px',
        lineHeight: 1.55,
        color: textColor,
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml={true}
        components={{
          // Paragraphs
          p: ({children}) => (
            <p style={{margin: '0 0 8px 0', lineHeight: 1.55, color: textColor}}>
              {children}
            </p>
          ),
          // Strong / Bold
          strong: ({children}) => (
            <strong style={{fontWeight: 750, color: isUser ? '#FFFFFF' : 'var(--text-primary)'}}>
              {children}
            </strong>
          ),
          // Italic / Emphasis
          em: ({children}) => (
            <em style={{fontStyle: 'italic', color: secondaryColor}}>
              {children}
            </em>
          ),
          // Headings
          h1: ({children}) => (
            <h1 style={{fontSize: '16px', fontWeight: 800, margin: '12px 0 6px 0', color: textColor, lineHeight: 1.3}}>
              {children}
            </h1>
          ),
          h2: ({children}) => (
            <h2 style={{fontSize: '15px', fontWeight: 750, margin: '10px 0 6px 0', color: textColor, lineHeight: 1.35}}>
              {children}
            </h2>
          ),
          h3: ({children}) => (
            <h3 style={{fontSize: '14px', fontWeight: 700, margin: '8px 0 4px 0', color: textColor, lineHeight: 1.4}}>
              {children}
            </h3>
          ),
          h4: ({children}) => (
            <h4 style={{fontSize: '13px', fontWeight: 700, margin: '6px 0 4px 0', color: textColor}}>
              {children}
            </h4>
          ),
          // Unordered list
          ul: ({children}) => (
            <ul style={{margin: '4px 0 8px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {children}
            </ul>
          ),
          // Ordered list
          ol: ({children}) => (
            <ol style={{margin: '4px 0 8px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {children}
            </ol>
          ),
          // List item
          li: ({children}) => (
            <li style={{lineHeight: 1.5, color: textColor, margin: 0}}>
              {children}
            </li>
          ),
          // Links
          a: ({href, children}) => {
            const rawLabel = String(children || '').trim();
            const isRawUrl = /^https?:\/\//i.test(rawLabel) || /^www\./i.test(rawLabel) || rawLabel.includes('google.com/maps');
            const displayLabel = isRawUrl ? 'Verified Reference' : children;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: isUser ? '#FFFFFF' : 'var(--accent-primary)',
                  textDecoration: 'underline',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{displayLabel}</span>
              </a>
            );
          },
          // Inline code
          code: ({children}) => (
            <code style={{fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', padding: '1px 5px', borderRadius: '4px', backgroundColor: isUser ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-surface-secondary, #F0F3F5)', color: isUser ? '#FFFFFF' : 'var(--text-primary)'}}>
              {children}
            </code>
          ),
          // Pre / Code blocks - prevent huge grey boxes for ordinary text
          pre: ({children}) => (
            <pre style={{backgroundColor: isUser ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-surface-secondary, #F0F3F5)', border: isUser ? 'none' : '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 12px', margin: '6px 0', overflowX: 'auto', fontSize: '12px', fontFamily: 'var(--font-mono, monospace)', color: textColor}}>
              {children}
            </pre>
          ),
          // Blockquotes
          blockquote: ({children}) => (
            <blockquote style={{borderLeft: isUser ? '3px solid rgba(255, 255, 255, 0.5)' : '3px solid var(--accent-primary)', margin: '6px 0 8px 0', paddingLeft: '10px', color: secondaryColor, fontStyle: 'italic'}}>
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => (
            <hr style={{border: 'none', borderTop: isUser ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border-subtle)', margin: '10px 0'}} />
          ),
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
