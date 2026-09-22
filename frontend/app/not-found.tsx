'use client';

import React from 'react';
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: '32px',
        textAlign: 'center',
        fontFamily: 'var(--font-inter, sans-serif)',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'var(--brand-soft)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          fontSize: '28px',
          fontWeight: 800,
          border: '1px solid var(--badge-info-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        404
      </div>
      <h1
        style={{
          fontSize: '32px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: '0 0 12px 0',
          letterSpacing: '-0.8px',
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          fontSize: '15px',
          color: 'var(--text-secondary)',
          maxWidth: '480px',
          lineHeight: 1.6,
          margin: '0 0 28px 0',
        }}
      >
        The UrbanPulse location or workspace you requested does not exist.
      </p>
      <Link
        href={ROUTES.home}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--button)',
          color: 'var(--button-foreground)',
          padding: '12px 24px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: 'var(--shadow-md)',
          transition: 'all 0.15s ease',
        }}
      >
        Back to UrbanPulse
      </Link>
    </div>
  );
}
