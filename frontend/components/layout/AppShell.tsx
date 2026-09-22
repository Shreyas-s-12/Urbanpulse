'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import NavRail from '@/components/navigation/NavRail';
import TopBar from '@/components/header/TopBar';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isStandalonePage =
    pathname === '/' ||
    pathname === '/signin' ||
    pathname === '/signup' ||
    pathname === '/welcome';

  if (isStandalonePage) {
    return (
      <ErrorBoundary
        fallbackTitle="Page Unavailable"
        fallbackMessage="UrbanPulse encountered an issue rendering this screen. Please refresh or navigate to the sign in page."
      >
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'auto', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
          {children}
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Left Navigation Rail */}
      <NavRail />

      {/* Main Application Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top Search & Radial Controls Bar */}
        <TopBar />

        {/* Dynamic Page Content with Error Boundary */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <ErrorBoundary
            fallbackTitle="UrbanPulse Section Error"
            fallbackMessage="UrbanPulse couldn't load this section. Other tools remain operational."
          >
            {children}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
