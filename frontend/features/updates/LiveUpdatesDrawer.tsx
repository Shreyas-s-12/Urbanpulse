'use client';

import React from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';

export default function LiveUpdatesDrawer() {
  const {
    liveUpdates,
    ragBulletins,
    showLiveUpdatesDrawer,
    setShowLiveUpdatesDrawer,
    activeLocation,
  } = useAgentStore();

  if (!showLiveUpdatesDrawer) return null;

  const cityName = activeLocation?.city || activeLocation?.displayName || 'Active Area';
  const updates: any[] = liveUpdates || [];
  const bulletins: any[] = ragBulletins || [];

  const getFreshnessBadge = (freshness: string) => {
    switch (freshness) {
      case 'LIVE':
        return { bg: 'rgba(239, 68, 68, 0.12)', color: '#DC2626', border: 'rgba(239, 68, 68, 0.25)' };
      case 'RECENT':
        return { bg: 'rgba(245, 158, 11, 0.12)', color: '#D97706', border: 'rgba(245, 158, 11, 0.25)' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748B', border: 'rgba(100, 116, 139, 0.2)' };
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '420px',
        maxHeight: 'calc(100% - 40px)',
        backgroundColor: 'var(--bg-surface, #FFFFFF)',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid var(--border-subtle, #E2E8F0)',
        boxShadow: 'var(--shadow-panel, 0 20px 25px -5px rgba(0, 0, 0, 0.08))',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflow: 'hidden',
        color: 'var(--text-primary, #11161B)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>📡</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Live Updates & Civic RAG
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs, 4px)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#DC2626',
              }}
            >
              REAL-TIME
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #65717D)', marginTop: '3px' }}>
            {cityName} • Verified Sensor Streams & Authoritative Protocols
          </div>
        </div>
        <button
          onClick={() => setShowLiveUpdatesDrawer(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #8E9BA8)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            fontSize: '1.1rem',
            lineHeight: 1,
            transition: 'color 0.15s ease',
          }}
          title="Close Drawer"
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Section 1: Ingested Incidents & Sensor Feeds */}
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted, #8E9BA8)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Live Sensor Ingestion ({updates.length})</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Geospatial 1.5km Deduplication</span>
          </div>

          {updates.length === 0 ? (
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm, 8px)',
                backgroundColor: 'var(--bg-surface-secondary, #F0F3F5)',
                border: '1px solid var(--border-subtle, #E2E8F0)',
                fontSize: '12px',
                color: 'var(--text-muted, #8E9BA8)',
              }}
            >
              Zero active seismic or severe hazard incidents detected in this radius.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {updates.map((ev: any, idx: number) => {
                const badge = getFreshnessBadge(ev.freshness || 'LIVE');
                return (
                  <div
                    key={ev.id || idx}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      backgroundColor: 'var(--bg-surface, #FFFFFF)',
                      border: '1px solid var(--border-subtle, #E2E8F0)',
                      boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgba(0, 0, 0, 0.03))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs, 4px)',
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {ev.freshness || 'LIVE'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ev.source}</span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {ev.title}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {ev.description}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                        borderTop: '1px solid var(--border-subtle, #E2E8F0)',
                        paddingTop: '6px',
                      }}
                    >
                      <span>Severity: <strong style={{ color: '#DC2626' }}>{ev.severity}/100</strong></span>
                      <span>{ev.distanceKm ? `${ev.distanceKm} km away` : 'Active Radius'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Authoritative RAG Knowledge Bulletins */}
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted, #8E9BA8)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Authoritative Civic Protocols ({bulletins.length})</span>
            <span style={{ fontSize: '11px', color: 'var(--accent-primary, #2563EB)' }}>Civic & Civil Defense RAG</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bulletins.map((doc: any, idx: number) => (
              <div
                key={doc.id || idx}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  backgroundColor: 'var(--bg-surface, #FFFFFF)',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgba(0, 0, 0, 0.03))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs, 4px)',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      color: 'var(--accent-primary, #2563EB)',
                    }}
                  >
                    {doc.category || 'CIVIC PROTOCOL'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Authority: {Math.round((doc.authorityScore || 0.95) * 100)}%
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {doc.title}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <MarkdownRenderer content={doc.content} />
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Source: {doc.source}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
