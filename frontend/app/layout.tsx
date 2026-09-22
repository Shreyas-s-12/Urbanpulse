import React from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { MapProvider } from '@/context/MapContext';
import AppShell from '@/components/layout/AppShell';
import ClientInitializer from '@/components/layout/ClientInitializer';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = localStorage.getItem('urbanpulse_settings_v1');
                var theme = s ? JSON.parse(s).theme : 'light';
                if (theme === 'system') {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                if (theme === 'dark') {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <ClientInitializer>
          <LanguageProvider>
            <AuthProvider>
              <MapProvider>
                <AppShell>
                  {children}
                </AppShell>
              </MapProvider>
            </AuthProvider>
          </LanguageProvider>
        </ClientInitializer>
      </body>
    </html>
  );
}
