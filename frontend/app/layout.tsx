import React from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import { MapProvider } from '@/context/MapContext';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'UrbanPulse | Real-Time Intelligence for the World Around You',
  description: 'Location-aware urban and environmental intelligence engine with dynamic reverse geocoding, 50km radius surveillance, multi-candidate routing, and 24h event tracking.',
  icons: {
    icon: '/images/logo.png',
    shortcut: '/images/logo.png',
    apple: '/images/logo.png',
  },
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
          <AppShell>
            {children}
          </AppShell>
        </MapProvider>
      </body>
    </html>
  );
}
