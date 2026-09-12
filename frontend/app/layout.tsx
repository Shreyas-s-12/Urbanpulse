import React from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import NavRail from '@/components/navigation/NavRail';
import TopBar from '@/components/header/TopBar';
import { MapProvider } from '@/context/MapContext';

export const metadata: Metadata = {
  title: 'UrbanPulse | Real-Time Intelligence for the World Around You',
  description: 'Location-aware urban and environmental intelligence engine with dynamic reverse geocoding, 50km radius surveillance, multi-candidate routing, and 24h event tracking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
<body>
  <MapProvider>
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Left Navigation Rail */}
      <NavRail />
      
      {/* Main View Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Search & Radial Controls Bar */}
        <TopBar />
        
        {/* Page Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  </MapProvider>
</body>
    </html>
  );
}
