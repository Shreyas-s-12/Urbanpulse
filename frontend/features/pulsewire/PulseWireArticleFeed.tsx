'use client';

import React, { useMemo } from 'react';
import { PulseWireArticle, isValidArticle, isValidHttpUrl } from './types';
import PulseWireArticleItem from './PulseWireArticleItem';

interface PulseWireArticleFeedProps {
  articles: PulseWireArticle[];
  status: 'IDLE' | 'LOADING' | 'AVAILABLE' | 'EMPTY' | 'ERROR';
  error?: string | null;
  selectedCategory: string;
  searchQuery: string;
  locationLabel: string;
  onRetry?: () => void;
  onExpandToGlobal?: () => void;
}

export default function PulseWireArticleFeed({
  articles,
  status,
  error,
  selectedCategory,
  searchQuery,
  locationLabel,
  onRetry,
  onExpandToGlobal,
}: PulseWireArticleFeedProps) {
  // 1. Filter out any invalid articles strictly
  const validArticles = useMemo(() => {
    if (!Array.isArray(articles)) return [];
    return articles.filter((a) => {
      if (!isValidArticle(a)) return false;
      const title = (a.title || a.headline || '').trim();
      const url = (a.url || a.articleUrl || '').trim();
      return title.length >= 4 && isValidHttpUrl(url);
    });
  }, [articles]);

  // 2. Filter by category and search query
  const displayedArticles = useMemo(() => {
    let list = validArticles;

    if (selectedCategory && selectedCategory !== 'ALL') {
      list = list.filter((a) => (a.category || 'GENERAL').toUpperCase() === selectedCategory.toUpperCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => {
        const title = (a.title || a.headline || '').toLowerCase();
        const desc = (a.description || a.summary || '').toLowerCase();
        const src = (a.source || a.sourceName || '').toLowerCase();
        const cat = (a.category || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || src.includes(q) || cat.includes(q);
      });
    }

    // Sort newest first
    return [...list].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [validArticles, selectedCategory, searchQuery]);

  // State 1: LOADING (At most 3 compact skeleton rows)
  if (status === 'LOADING' && validArticles.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, padding: '2px 4px' }}>
          Loading recent updates...
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: '92px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'pulse 1.2s ease-in-out infinite',
            }}
          >
            <div style={{ width: '60px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--border)' }} />
            <div style={{ width: '85%', height: '16px', borderRadius: '4px', backgroundColor: 'var(--border)' }} />
            <div style={{ width: '50%', height: '12px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)' }} />
          </div>
        ))}
      </div>
    );
  }

  // State 2: ERROR
  if (status === 'ERROR') {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          backgroundColor: 'var(--badge-hazard-bg)',
          borderRadius: '10px',
          border: '1px solid var(--badge-hazard-border)',
          margin: 'auto 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--badge-hazard-text)' }}>
          PulseWire unavailable
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, maxWidth: '240px' }}>
          {error || 'Unable to retrieve recent news right now.'}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: '4px',
              padding: '5px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--button)',
              color: 'var(--button-foreground)',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // State 3: Category filter returned 0, but total articles exist
  if (displayedArticles.length === 0 && validArticles.length > 0) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          margin: 'auto 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {selectedCategory !== 'ALL'
            ? `No recent ${selectedCategory} updates.`
            : 'No articles match your search filter.'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Try switching to another category or resetting the search term.
        </div>
      </div>
    );
  }

  // State 4: Total zero valid articles for this location
  if (displayedArticles.length === 0) {
    return (
      <div
        style={{
          padding: '28px 16px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          margin: 'auto 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          No recent updates
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45, maxWidth: '250px' }}>
          No verified news articles were found for {locationLabel} in the last 24 hours.
        </div>
        {onExpandToGlobal && (
          <button
            type="button"
            onClick={onExpandToGlobal}
            style={{
              marginTop: '4px',
              padding: '5px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--button)',
              color: 'var(--button-foreground)',
              fontSize: '11px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Switch to Global Wire
          </button>
        )}
      </div>
    );
  }

  // State 5: Real Verified Articles Feed
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {displayedArticles.map((article) => (
        <PulseWireArticleItem key={article.id} article={article} />
      ))}
    </div>
  );
}
