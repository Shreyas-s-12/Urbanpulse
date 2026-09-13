'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavRail() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Overview',
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
      label: 'Plan Route',
      path: '/routes',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="19" r="3"></circle>
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"></path>
          <circle cx="18" cy="5" r="3"></circle>
        </svg>
      ),
    },
    {
      label: 'Events',
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
      path: '/urban-condition',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
      ),
    },
    {
      label: 'Copilot',
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
        width: '84px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
        zIndex: 50,
        boxShadow: 'var(--shadow-sm)',
        flexShrink: 0,
      }}
    >
      {/* Brand Icon */}
      <Link
        href="/"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#11161B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#13B887',
            fontWeight: 800,
            fontSize: '18px',
            letterSpacing: '-1px',
            position: 'relative',
          }}
        >
          UP
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
              boxShadow: '0 0 8px #13B887',
            }}
          />
        </div>
      </Link>

      {/* Navigation Icons */}
      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          padding: '0 10px',
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
                padding: '10px 4px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--accent-primary-light)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                gap: '5px',
              }}
            >
              {item.icon}
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 500,
                  textAlign: 'center',
                  lineHeight: 1.1,
                }}
              >
                {item.label}
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
          gap: '6px',
        }}
      >
        <span
          title="Engine: Operational"
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary)',
            boxShadow: '0 0 8px rgba(19, 184, 135, 0.6)',
          }}
        />
        <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)' }}>LIVE</span>
      </div>
    </aside>
  );
}
