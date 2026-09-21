'use client';

import React from 'react';
import Link from 'next/link';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';

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
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          height: '62px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Left: Branding & Module Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            href="/"
            title="UrbanPulse Home"
            style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <UrbanPulseLogo size="sm" showWordmark={false} />
          </Link>

          <div style={{ width: '1px', height: '26px', backgroundColor: '#E2E8F0' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>
                {moduleName}
              </h1>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  border: '1px solid #BFDBFE',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                Intelligence Workspace
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
              {moduleSubtitle}
            </div>
          </div>
        </div>

        {/* Center: Shared Location Context Header */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '440px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0F172A',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {locationName || cityName}
            </div>
            <div style={{ fontSize: '10px', color: '#64748B' }}>
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
            backgroundColor: '#FFFFFF',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#1E293B',
            textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F1F5F9';
            e.currentTarget.style.borderColor = '#94A3B8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#CBD5E1';
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
