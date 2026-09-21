'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePulseWireStore, PulseWireScope } from '@/stores/usePulseWireStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useAgentStore } from '@/stores/useAgentStore';
import {
  RadioIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  PinIcon,
} from '@/components/common/Icons';

const PulseWireHoloRadar = dynamic(() => import('@/components/3d/PulseWireHoloRadar'), {
  ssr: false,
  loading: () => <RadioIcon size={20} color="var(--accent-primary)" />,
});

const SCOPES: { id: PulseWireScope; label: string }[] = [
  { id: 'CITY', label: 'City' },
  { id: 'STATE', label: 'State' },
  { id: 'COUNTRY', label: 'Country' },
  { id: 'GLOBAL', label: 'Global' },
];

function isValidArticleUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed === '#' || trimmed === '') return false;
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return false;
  return /^https?:\/\//i.test(trimmed);
}

function cleanText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/\bhref\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bhref\s*=\s*\S+/gi, '')
    .replace(/\bread\s+report\b/gi, '')
    .replace(/\bread\s+more\b/gi, '')
    .replace(/\bknow\s+more\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function PulseWireRail() {
  const {
    isOpen,
    toggleOpen,
    scope,
    setScope,
    articles,
    status,
    locationLabel,
    fetchNews,
  } = usePulseWireStore();

  const { currentLocation } = useLocationStore();
  const { activeLocation } = useAgentStore();
  const [filterQuery, setFilterQuery] = useState('');

  const activeLoc = activeLocation || currentLocation;

  // Auto-sync scope with active location changes
  useEffect(() => {
    if (activeLoc?.city) {
      fetchNews({
        scope,
        city: activeLoc.city,
        state: activeLoc.state || activeLoc.region || undefined,
        country: activeLoc.country || undefined,
        countryCode: activeLoc.countryCode || undefined,
      });
    } else {
      fetchNews({ scope });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLoc?.city, activeLoc?.state, scope]);

  const filteredArticles = useMemo(() => {
    if (!filterQuery.trim()) return articles;
    const q = filterQuery.toLowerCase();
    return articles.filter(
      (a) =>
        a.headline.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
    );
  }, [articles, filterQuery]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        title="Open PulseWire World Intelligence"
        aria-label="Open PulseWire"
        style={{
          position: 'absolute',
          top: '12px',
          left: '76px',
          zIndex: 35,
          height: '34px',
          padding: '0 12px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
          e.currentTarget.style.backgroundColor = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#0284C7',
            boxShadow: '0 0 6px rgba(2, 132, 199, 0.7)',
          }}
        />
        <span>PulseWire</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>LIVE</span>
      </button>
    );
  }

  return (
    <aside
      className="pulsewire-rail"
      style={{
        width: '320px',
        height: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 25,
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* PulseWire Header */}
      <div
        style={{
          height: '56px',
          padding: '0 14px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <PulseWireHoloRadar size={24} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2
                style={{
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.2px',
                  lineHeight: 1.2,
                }}
              >
                PulseWire
              </h2>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  color: '#0284C7',
                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  letterSpacing: '0.4px',
                }}
              >
                24H
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Fresh World Intelligence
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Collapse PulseWire"
          title="Collapse PulseWire Rail"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          <CloseIcon size={15} />
        </button>
      </div>

      {/* Dynamic Scope Selector */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        {SCOPES.map((sc) => {
          const isCurrent = scope === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => setScope(sc.id)}
              style={{
                flex: 1,
                height: '28px',
                borderRadius: '6px',
                border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: isCurrent ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: isCurrent ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: isCurrent ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {sc.label}
            </button>
          );
        })}
      </div>

      {/* Location Context & Search Filter */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
            <PinIcon size={11} color="var(--accent-primary)" />
            <strong style={{ color: 'var(--text-primary)' }}>
              {locationLabel || activeLoc?.city || 'Global Scope'}
            </strong>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>
            {status === 'LOADING' ? 'Retrieving...' : `${filteredArticles.length} updates`}
          </span>
        </div>

        <input
          type="text"
          placeholder="Filter headlines or category..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          style={{
            height: '28px',
            padding: '0 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-app)',
            fontSize: '11.5px',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {/* Stream Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: 0,
        }}
      >
        {status === 'LOADING' && articles.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0' }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  height: '74px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  animation: 'pulse 1.2s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        )}

        {status !== 'LOADING' && filteredArticles.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              margin: 'auto 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RadioIcon size={24} color="var(--text-muted)" />
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              NO VERIFIED COVERAGE
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, maxWidth: '240px' }}>
              No public wire updates detected for this geographic scope in the last 24 hours.
            </div>
            <button
              type="button"
              onClick={() => fetchNews({ scope: 'GLOBAL' })}
              style={{
                marginTop: '4px',
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent-primary)',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Switch to Global Wire
            </button>
          </div>
        )}

        {filteredArticles.map((article) => {
          const categoryColors: Record<string, { bg: string; text: string }> = {
            Traffic: { bg: 'rgba(239, 68, 68, 0.1)', text: '#DC2626' },
            Weather: { bg: 'rgba(2, 132, 199, 0.1)', text: '#0284C7' },
            'Public Safety': { bg: 'rgba(245, 158, 11, 0.12)', text: '#D97706' },
            Civic: { bg: 'rgba(16, 185, 129, 0.1)', text: '#059669' },
            Economy: { bg: 'rgba(99, 102, 241, 0.1)', text: '#4F46E5' },
            National: { bg: 'rgba(139, 92, 246, 0.1)', text: '#7C3AED' },
            World: { bg: 'rgba(14, 165, 233, 0.1)', text: '#0284C7' },
            General: { bg: 'var(--bg-app)', text: 'var(--text-secondary)' },
          };

          const catColor = categoryColors[article.category] || categoryColors.General;
          const articleUrl = article.articleUrl || article.url;
          const hasValidUrl = isValidArticleUrl(articleUrl);
          const sourceLabel = cleanText(article.sourceName || article.source || 'Verified Source');
          const headlineText = cleanText(article.headline || article.title);
          const summaryText = cleanText(article.summary);
          const locationText = cleanText(article.location);

          return (
            <article
              key={article.id}
              style={{
                padding: '11px 12px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'border-color 0.15s ease',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              {/* Category */}
              <div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 750,
                    backgroundColor: catColor.bg,
                    color: catColor.text,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    display: 'inline-block',
                  }}
                >
                  {article.category}
                </span>
              </div>

              {/* Headline */}
              <h3
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  color: 'var(--text-primary)',
                  margin: 0,
                  userSelect: 'text',
                }}
              >
                {headlineText}
              </h3>

              {/* Short summary */}
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                  margin: 0,
                  userSelect: 'text',
                }}
              >
                {summaryText}
              </p>

              {/* Time & Source meta line: e.g. "1h ago · WSJ" */}
              <div
                style={{
                  fontSize: '10.5px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  lineHeight: 1.2,
                }}
              >
                <span>{article.freshness}</span>
                <span>·</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {sourceLabel}
                </span>
              </div>

              {/* Footer: Location & Source attribution on left, Read more → on right */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '2px',
                  paddingTop: '6px',
                  borderTop: '1px solid var(--border-subtle)',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                  {locationText && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {locationText}
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Source: {sourceLabel}
                  </span>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {hasValidUrl ? (
                    <a
                      href={articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open article from ${sourceLabel} in a new tab`}
                      aria-label={`Read more about ${headlineText} on ${sourceLabel}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '11px',
                        fontWeight: 650,
                        color: 'var(--accent-primary, #0284C7)',
                        textDecoration: 'none',
                        padding: '3px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(2, 132, 199, 0.08)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.18)';
                        e.currentTarget.style.color = '#0369A1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.08)';
                        e.currentTarget.style.color = 'var(--accent-primary, #0284C7)';
                      }}
                    >
                      Read more →
                    </a>
                  ) : (
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                        padding: '2px 4px',
                      }}
                    >
                      Source available
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
