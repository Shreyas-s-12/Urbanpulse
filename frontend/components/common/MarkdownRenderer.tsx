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
  // Sanitize content: convert anchor tags to markdown, normalize link labels to "Read more →", and strip naked URLs
  const sanitizedContent = React.useMemo(() => {
    if (!content) return '';

    // 1. Convert HTML anchor tags: <a href="url">label</a> -> [label](url)
    let res = content.replace(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, label) => {
      const cleanLabel = label.replace(/<[^>]*>/g, '').trim();
      let normalizedLabel = cleanLabel;
      if (/^https?:\/\//i.test(cleanLabel) || /^www\./i.test(cleanLabel) || !cleanLabel) {
        normalizedLabel = 'Read more →';
      } else if (cleanLabel.toLowerCase().includes('read report') || cleanLabel.toLowerCase().includes('read more')) {
        normalizedLabel = 'Read more →';
      } else if (cleanLabel.toLowerCase().includes('know more')) {
        normalizedLabel = 'Know more →';
      }
      return `[${normalizedLabel}](${url})`;
    });

    // 2. Normalize markdown link labels so that raw URLs or "read report" inside brackets become "Read more →"
    res = res.replace(/\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/gi, (_, label, url) => {
      const trimmedLabel = label.trim();
      let normalizedLabel = trimmedLabel;
      if (/^https?:\/\//i.test(trimmedLabel) || /^www\./i.test(trimmedLabel) || !trimmedLabel) {
        normalizedLabel = 'Read more →';
      } else if (trimmedLabel.toLowerCase().includes('read report') || trimmedLabel.toLowerCase().includes('read more')) {
        normalizedLabel = 'Read more →';
      } else if (trimmedLabel.toLowerCase().includes('know more')) {
        normalizedLabel = 'Know more →';
      }
      return `[${normalizedLabel}](${url})`;
    });

    // 3. Protect markdown links [label](url) so naked URL stripping does not corrupt them
    const links: string[] = [];
    res = res.replace(/\[[^\]]+\]\(https?:\/\/[^\)]+\)/gi, (m) => {
      links.push(m);
      return `__MK_LINK_${links.length - 1}__`;
    });

    // 4. Strip raw naked URLs from prose text
    res = res.replace(/https?:\/\/\S+/gi, '');
    res = res.replace(/www\.\S+/gi, '');

    // 5. Strip any lingering href= attributes, HTML tags, or "read report" plain text
    res = res.replace(/\bhref\s*=\s*["'][^"']*["']/gi, '');
    res = res.replace(/\bhref\s*=\s*\S+/gi, '');
    res = res.replace(/<[^>]*>/g, '');
    res = res.replace(/\bread\s+report\b/gi, '');

    // 6. Restore protected markdown links
    res = res.replace(/__MK_LINK_(\d+)__/g, (_, idx) => links[Number(idx)] || '');

    return res.trim();
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
          // Semantic Links: renders accessible external navigation without showing the URL text
          a: ({href, children}) => {
            const rawUrl = href || '';
            const trimmedUrl = String(rawUrl).trim();
            const isValid = /^https?:\/\//i.test(trimmedUrl) && !/^(javascript|data|vbscript|file):/i.test(trimmedUrl);
            if (!isValid) {
              return <span style={{ fontWeight: 600 }}>{children}</span>;
            }

            const rawLabel = String(children || '').trim();
            let label = rawLabel;
            if (/^https?:\/\//i.test(rawLabel) || /^www\./i.test(rawLabel) || !rawLabel) {
              label = 'Read more →';
            } else if (rawLabel.toLowerCase().includes('read report') || rawLabel.toLowerCase().includes('read more')) {
              label = 'Read more →';
            } else if (rawLabel.toLowerCase().includes('know more')) {
              label = 'Know more →';
            }

            return (
              <a
                href={trimmedUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontWeight: 650,
                  color: isUser ? '#FFFFFF' : 'var(--accent-primary, #0284C7)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                {label}
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
