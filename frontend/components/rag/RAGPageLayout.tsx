'use client';

import React from 'react';
import Link from 'next/link';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { ROUTES } from '@/lib/routes';

interface RAGPageLayoutProps {
  moduleName: string;
  moduleSubtitle: string;
  locationName: string;
  cityName: string;
  latitude: number;
  longitude: number;
  children: React.ReactNode;
}

export default function RAGPageLayout({
  moduleName,
  moduleSubtitle,
  locationName,
  cityName,
  latitude,
  longitude,
  children,
}: RAGPageLayoutProps) {
  const returnMapUrl = `/overview?lat=${latitude}&lng=${longitude}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          height: '62px',
          backgroundColor: 'var(--bg-header)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Left: Branding & Module Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            href={ROUTES.home}
            title="UrbanPulse Home"
            style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <UrbanPulseLogo size="sm" showWordmark={false} />
          </Link>

          <div style={{ width: '1px', height: '26px', backgroundColor: 'var(--border-subtle)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                {moduleName}
              </h1>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  backgroundColor: 'var(--badge-info-bg)',
                  color: 'var(--badge-info-text)',
                  border: '1px solid var(--badge-info-border)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                Intelligence Workspace
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {moduleSubtitle}
            </div>
          </div>
        </div>

        {/* Center: Shared Location Context Header */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '440px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {locationName || cityName}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E · {cityName}
            </div>
          </div>
        </div>

        {/* Right: Back to Map Button */}
        <Link
          href={returnMapUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--button-secondary)',
            border: '1px solid var(--button-secondary-border)',
            borderRadius: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--button-secondary-foreground)',
            textDecoration: 'none',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--button-secondary-hover)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--button-secondary)';
            e.currentTarget.style.borderColor = 'var(--button-secondary-border)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Map</span>
        </Link>
      </header>

      {/* Main Content Body */}
      <main
        style={{
          flex: 1,
          maxWidth: '1380px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px 48px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {children}
      </main>
    </div>
  );
}
