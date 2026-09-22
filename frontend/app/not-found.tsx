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
          backgroundColor: '#EFF6FF',
          color: '#2563EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          fontSize: '28px',
          fontWeight: 800,
          border: '1px solid rgba(37, 99, 235, 0.2)',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)',
        }}
      >
        404
      </div>
      <h1
        style={{
          fontSize: '32px',
          fontWeight: 800,
          color: '#0F172A',
          margin: '0 0 12px 0',
          letterSpacing: '-0.8px',
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          fontSize: '15px',
          color: '#64748B',
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
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          padding: '12px 24px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
          transition: 'all 0.15s ease',
        }}
      >
        Back to UrbanPulse
      </Link>
    </div>
  );
}
