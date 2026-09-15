'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import NavRail from '@/components/navigation/NavRail';
import TopBar from '@/components/header/TopBar';
import LocationDebugOverlay from '@/components/common/LocationDebugOverlay';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  if (isLandingPage) {
    return (
      <ErrorBoundary
        fallbackTitle="Welcome Screen Unavailable"
        fallbackMessage="UrbanPulse welcome screen encountered an issue. Please refresh or navigate to the overview."
      >
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
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

      {/* Dev-Only Diagnostic HUD Overlay */}
      <LocationDebugOverlay />
    </div>
  );
}
