'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';

export default function NavRail() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Overview',
      shortLabel: 'Overview',
      path: '/overview',
      alias: '/',
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
      label: 'Live Map',
      shortLabel: 'Map',
      path: '/map',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
          <line x1="8" y1="2" x2="8" y2="18"></line>
          <line x1="16" y1="6" x2="16" y2="22"></line>
        </svg>
      ),
    },
    {
      label: 'Command Center',
      shortLabel: 'Command',
      path: '/command',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      ),
    },

    {
      label: 'Events',
      shortLabel: 'Events',
      path: '/events',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
    },
    {
      label: 'Urban Intelligence',
      shortLabel: 'Intel',
      path: '/urban-condition',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      ),
    },
    {
      label: 'Nexus Agent',
      shortLabel: 'Nexus',
      path: '/copilot',
      alias: '/agent',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
          <path d="M12 12 2.1 12.5"></path>
          <path d="m4.5 4.5 7.5 7.5"></path>
        </svg>
      ),
    },
  ];

  return (
    <aside
      style={{
        width: '64px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-4) 0',
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Brand Icon */}
      <Link
        href="/"
        title="UrbanPulse Home"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-5)',
          textDecoration: 'none',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <UrbanPulseLogo size={32} priority />
      </Link>

      {/* Navigation Icons */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          width: '100%',
          padding: '0 6px',
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
                height: '48px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--accent-primary-light)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                gap: '4px',
                padding: '0 2px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  textAlign: 'center',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.2px',
                  maxWidth: '52px',
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
          paddingBottom: '4px',
        }}
      >
        <span
          title="Engine: Operational"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary)',
            boxShadow: '0 0 6px rgba(37, 99, 235, 0.6)',
          }}
        />
        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
          LIVE
        </span>
      </div>
    </aside>
  );
}
