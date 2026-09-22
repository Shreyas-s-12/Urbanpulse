'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePulseWireStore, PulseWireScope } from '@/stores/usePulseWireStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useAgentStore } from '@/stores/useAgentStore';
import {
  RadioIcon,
  CollapseIcon,
  PinIcon,
} from '@/components/common/Icons';
import PulseWireArticleFeed from './PulseWireArticleFeed';
import { isValidArticle, isValidHttpUrl } from './types';

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

const CATEGORIES = ['ALL', 'TRAFFIC', 'WEATHER', 'HAZARD', 'CRIME', 'MUNICIPAL', 'CIVIC'] as const;

export default function PulseWireRail() {
  const {
    isOpen,
    toggleOpen,
    scope,
    setScope,
    articles,
    status,
    error,
    locationLabel,
    fetchNews,
    retry,
  } = usePulseWireStore();

  const { currentLocation } = useLocationStore();
  const { activeLocation } = useAgentStore();
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const activeLoc = activeLocation || currentLocation;

  // Auto-sync scope with active location changes
  useEffect(() => {
    if (activeLoc?.city) {
      fetchNews({
        scope,
        city: activeLoc.city,
        state: (activeLoc.state || activeLoc.region) ?? undefined,
        country: activeLoc.country ?? undefined,
        countryCode: activeLoc.countryCode ?? undefined,
      });
    } else {
      fetchNews({ scope });
    }
  }, [activeLoc?.city, activeLoc?.state, activeLoc?.region, scope, fetchNews]);

  // Compute number of verified valid articles strictly
  const validArticles = useMemo(() => {
    if (!Array.isArray(articles)) return [];
    return articles.filter((a) => {
      if (!isValidArticle(a)) return false;
      const title = (a.title || a.headline || '').trim();
      const url = (a.url || a.articleUrl || '').trim();
      return title.length >= 4 && isValidHttpUrl(url);
    });
  }, [articles]);

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
          backgroundColor: 'var(--overlay-bg)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
      >
        <PulseWireHoloRadar size={18} />
        <span>PulseWire</span>
        <span
          style={{
            fontSize: '10px',
            backgroundColor: 'var(--badge-info-bg)',
            color: 'var(--accent-primary)',
            padding: '2px 6px',
            borderRadius: '10px',
            fontWeight: 750,
            letterSpacing: '0.3px',
          }}
        >
          24H
        </span>
      </button>
    );
  }

  const activeCityLabel = locationLabel || activeLoc?.city || 'Bengaluru';
  let updateCountLabel = '';
  if (status === 'LOADING') {
    updateCountLabel = 'Retrieving...';
  } else if (status === 'ERROR') {
    updateCountLabel = 'Unavailable';
  } else {
    updateCountLabel = `${validArticles.length} update${validArticles.length === 1 ? '' : 's'}`;
  }

  return (
    <aside
      aria-label="PulseWire World Intelligence"
      style={{
        width: 'clamp(310px, 22vw, 340px)',
        height: '100%',
        backgroundColor: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 25,
        flexShrink: 0,
        position: 'relative',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {/* 1. Header: PulseWire 24H (56-64px height) */}
      <div
        style={{
          height: '60px',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-header)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PulseWireHoloRadar size={24} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                PulseWire
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 750,
                  color: status === 'ERROR' ? 'var(--badge-hazard-text)' : (status === 'LOADING' ? 'var(--badge-approx-text)' : 'var(--badge-live-text)'),
                  backgroundColor: status === 'ERROR' ? 'var(--badge-hazard-bg)' : (status === 'LOADING' ? 'var(--badge-approx-bg)' : 'var(--badge-live-bg)'),
                  border: `1px solid ${status === 'ERROR' ? 'var(--badge-hazard-border)' : (status === 'LOADING' ? 'var(--badge-approx-border)' : 'var(--badge-live-border)')}`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: status === 'ERROR' ? 'var(--status-critical-text)' : (status === 'LOADING' ? 'var(--status-warning-text)' : 'var(--status-good-text)'),
                    display: 'inline-block',
                  }}
                />
                {status === 'ERROR' ? 'OFFLINE' : (status === 'LOADING' ? 'FETCHING' : '24H')}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
              World & Civic Intelligence · 24h Window
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleOpen}
          title="Minimize PulseWire"
          aria-label="Minimize PulseWire"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
        >
          <CollapseIcon size={14} />
        </button>
      </div>

      {/* 2. Scope Selector (City | State | Country | Global) */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
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
                height: '30px',
                borderRadius: '6px',
                border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                backgroundColor: isCurrent ? 'var(--button)' : 'var(--bg-card)',
                color: isCurrent ? 'var(--button-foreground)' : 'var(--text-secondary)',
                fontSize: '11.5px',
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

      {/* 3. Location Context & Search Filter */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-panel)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {/* Dynamic Location & Real Count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
            <PinIcon size={13} color="var(--accent-primary)" />
            <strong style={{ color: 'var(--text-primary)' }}>
              {activeCityLabel}
            </strong>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
            {activeCityLabel} · {updateCountLabel}
          </span>
        </div>

        {/* Text Filter */}
        <input
          type="text"
          placeholder="Filter headlines or source..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          style={{
            height: '32px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-input)',
            fontSize: '12px',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {/* Category Filter Pills (Height 30-32px, Font 11-12px) */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', flexWrap: 'wrap', paddingBottom: '2px' }}>
          {CATEGORIES.map((cat) => {
            const isSel = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  border: isSel ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  backgroundColor: isSel ? 'var(--button)' : 'var(--bg-card-hover)',
                  color: isSel ? 'var(--button-foreground)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Stream Area: Pure Article Feed Component */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          minHeight: 0,
        }}
      >
        <PulseWireArticleFeed
          articles={validArticles}
          status={status}
          error={error}
          selectedCategory={selectedCategory}
          searchQuery={filterQuery}
          locationLabel={activeCityLabel}
          onRetry={retry}
          onExpandToGlobal={() => {
            setSelectedCategory('ALL');
            setFilterQuery('');
            setScope('GLOBAL');
          }}
        />
      </div>
    </aside>
  );
}
