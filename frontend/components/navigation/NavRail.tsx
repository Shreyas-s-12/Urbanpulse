'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { ROUTES } from '@/lib/routes';
import { useLanguage } from '@/context/LanguageContext';

export default function NavRail() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const navItems = [
    {
      label: t('nav.overview', 'Overview'),
      shortLabel: t('nav.overview', 'Overview'),
      path: ROUTES.overview,
      alias: ROUTES.root,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
    },
    {
      label: t('nav.updates', 'Updates'),
      shortLabel: t('nav.updates', 'Updates'),
      path: ROUTES.updates,
      alias: '/pulsewire',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      ),
    },

    {
      label: t('nav.georag', 'GeoRAG'),
      shortLabel: t('nav.georag', 'GeoRAG'),
      path: ROUTES.georag,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M2 12h20"></path>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      ),
    },
    {
      label: t('nav.crisisrag', 'CrisisRAG'),
      shortLabel: t('nav.crisisrag', 'CrisisRAG'),
      path: ROUTES.crisisrag,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      ),
    },
    {
      label: t('nav.aquarag', 'AquaRAG'),
      shortLabel: t('nav.aquarag', 'AquaRAG'),
      path: ROUTES.aquarag,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
        </svg>
      ),
    },
    {
      label: t('nav.analytics', 'Intel'),
      shortLabel: t('nav.analytics', 'Intel'),
      path: ROUTES.analytics,
      alias: '/urban-condition',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      ),
    },
    {
      label: t('nav.simulate', 'Nexus'),
      shortLabel: t('nav.simulate', 'Nexus'),
      path: ROUTES.simulate,
      alias: '/copilot',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
          <path d="M12 12 2.1 12.5"></path>
          <path d="m4.5 4.5 7.5 7.5"></path>
        </svg>
      ),
    },
    {
      label: t('nav.settings', 'Settings'),
      shortLabel: t('nav.settings', 'Settings'),
      path: ROUTES.settings,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      ),
    },
  ];

  return (
    <aside
      aria-label="Application Navigation"
      style={{
        width: '74px',
        backgroundColor: 'var(--bg-sidebar, #FFFFFF)',
        borderRight: '1px solid var(--border, #E2E7EF)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0 16px 0',
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Brand Icon / Logo Area (56-64px height) */}
      <div
        style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px',
          flexShrink: 0,
        }}
      >
        <Link
          href={ROUTES.home}
          title="UrbanPulse Home"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <UrbanPulseLogo size={32} priority />
        </Link>
      </div>

      {/* Navigation Icons Rail */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '0 8px',
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.alias && pathname === item.alias);
          return (
            <Link
              key={item.path}
              href={item.path}
              title={item.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '46px',
                borderRadius: 'var(--radius-md, 8px)',
                backgroundColor: isActive ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
                color: isActive ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #566174)',
                transition: 'all 0.15s ease',
                gap: '3px',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover, #F3F6FA)';
                  e.currentTarget.style.color = 'var(--text-primary, #172033)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #566174)';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: isActive ? 700 : 500,
                  textAlign: 'center',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.1px',
                  maxWidth: '46px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Status / Mode Pin */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          paddingBottom: '6px',
        }}
      >
        <span
          title="Engine: Operational"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--status-good, #15803D)',
            boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)',
          }}
        />
        <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted, #7B8798)', letterSpacing: '0.4px' }}>
          LIVE
        </span>
      </div>
    </aside>
  );
}
