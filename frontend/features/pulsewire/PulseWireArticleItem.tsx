'use client';

import React, { useState } from 'react';
import { PulseWireArticle, formatRelativeTime, isValidHttpUrl } from './types';

interface PulseWireArticleItemProps {
  article: PulseWireArticle;
}

const CATEGORY_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  TRAFFIC: { bg: 'var(--badge-hazard-bg)', text: 'var(--badge-hazard-text)', border: 'var(--badge-hazard-border)' },
  WEATHER: { bg: 'var(--badge-info-bg)', text: 'var(--badge-info-text)', border: 'var(--badge-info-border)' },
  HAZARD: { bg: 'var(--badge-approx-bg)', text: 'var(--badge-approx-text)', border: 'var(--badge-approx-border)' },
  CRIME: { bg: 'var(--badge-hazard-bg)', text: 'var(--badge-hazard-text)', border: 'var(--badge-hazard-border)' },
  MUNICIPAL: { bg: 'var(--badge-info-bg)', text: 'var(--badge-info-text)', border: 'var(--badge-info-border)' },
  CIVIC: { bg: 'var(--badge-live-bg)', text: 'var(--badge-live-text)', border: 'var(--badge-live-border)' },
  ECONOMY: { bg: 'var(--badge-info-bg)', text: 'var(--badge-info-text)', border: 'var(--badge-info-border)' },
  NATIONAL: { bg: 'var(--badge-info-bg)', text: 'var(--badge-info-text)', border: 'var(--badge-info-border)' },
  WORLD: { bg: 'var(--badge-info-bg)', text: 'var(--badge-info-text)', border: 'var(--badge-info-border)' },
  GENERAL: { bg: 'var(--bg-subtle)', text: 'var(--text-secondary)', border: 'var(--border)' },
};

export default function PulseWireArticleItem({ article }: PulseWireArticleItemProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const upperCat = (article.category || 'GENERAL').toUpperCase();
  const theme = CATEGORY_THEMES[upperCat] || CATEGORY_THEMES.GENERAL;
  const relativeTime = article.freshness || formatRelativeTime(article.publishedAt);
  const headline = (article.title || article.headline || '').trim();
  const description = (article.description || article.summary || '').trim();
  const source = (article.source || article.sourceName || 'Verified News').trim();
  const hasImage = Boolean(article.imageUrl && isValidHttpUrl(article.imageUrl) && !imageFailed);

  return (
    <article
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '14px 16px',
        backgroundColor: isHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        borderRadius: '10px',
        border: isHovered ? '1px solid var(--border-hover)' : '1px solid var(--border)',
        boxShadow: isHovered ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'all 0.15s ease',
        wordBreak: 'break-word',
      }}
    >
      {/* Category Badge Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            display: 'inline-block',
          }}
        >
          {upperCat}
        </span>

        {article.location && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {article.location}
          </span>
        )}
      </div>

      {/* Main Content (Headline & optional thumbnail) */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Headline - Primary focus */}
          <h4
            style={{
              fontSize: '13.5px',
              fontWeight: 700,
              lineHeight: 1.4,
              color: 'var(--text-primary)',
              margin: '0 0 4px 0',
              letterSpacing: '-0.01em',
            }}
          >
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Read full article on ${source}`}
              style={{
                color: isHovered ? 'var(--accent-primary)' : 'var(--text-primary)',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
                display: 'inline',
              }}
            >
              {headline}
            </a>
          </h4>

          {/* Source and Relative Time */}
          <div
            style={{
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500,
              marginBottom: description ? '6px' : '0',
            }}
          >
            <span style={{ fontWeight: 650, color: 'var(--text-secondary)' }}>{source}</span>
            <span>·</span>
            <span>{relativeTime}</span>
          </div>

          {/* Short Article Description if available */}
          {description && (
            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.45,
                color: 'var(--text-secondary)',
                margin: 0,
                overflowWrap: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Optional Thumbnail Image */}
        {hasImage && article.imageUrl && (
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '6px',
              overflow: 'hidden',
              flexShrink: 0,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}
      </div>

      {/* Action Footer: READ ARTICLE -> */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginTop: '4px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open original article from ${source}`}
          aria-label={`Open original article: ${headline}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            height: '32px',
            fontSize: '11.5px',
            fontWeight: 750,
            letterSpacing: '0.3px',
            color: 'var(--accent-primary)',
            textDecoration: 'none',
            padding: '0 12px',
            borderRadius: '6px',
            backgroundColor: isHovered ? 'var(--accent-primary-light)' : 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>READ ARTICLE</span>
          <span style={{ fontSize: '13px', lineHeight: 1 }}>→</span>
        </a>
      </div>
    </article>
  );
}
