'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function UserProfileMenu() {
  const { user, isAuthenticated, isGuest, logout } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated && !isGuest) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Link
          href="/signin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '34px',
            padding: '0 14px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-primary)',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: 'var(--shadow-xs)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
        >
          <span>{t('auth.signIn', 'Sign In')}</span>
        </Link>
      </div>
    );
  }

  const initial = isGuest ? 'G' : (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const displayName = isGuest ? t('common.guest', 'Guest') : (user?.name || user?.email?.split('@')[0] || 'User');

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User account menu"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          height: '36px',
          padding: '0 10px 0 5px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          border: isGuest ? '1px solid #F59E0B' : '1px solid var(--border, #E2E7EF)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary, #2563EB)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = isGuest ? '#F59E0B' : 'var(--border, #E2E7EF)')}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: isGuest ? '#F59E0B' : 'var(--accent-primary, #2563EB)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {initial}
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary, #172033)',
            maxWidth: '90px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '240px',
            backgroundColor: 'var(--bg-panel, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--border, #E2E7EF)',
            boxShadow: 'var(--shadow-panel, 0 12px 30px rgba(0, 0, 0, 0.12))',
            zIndex: 100,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ borderBottom: '1px solid var(--border-subtle, #EDF0F4)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #172033)' }}>
                {isGuest ? t('settings.guestUser', 'Guest Explorer') : user?.name}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: isGuest ? 'var(--badge-approx-bg, #FFF7ED)' : 'var(--badge-live-bg, #ECFDF5)',
                  color: isGuest ? 'var(--badge-approx-text, #C2410C)' : 'var(--badge-live-text, #15803D)',
                  border: `1px solid ${isGuest ? 'var(--badge-approx-border, #FED7AA)' : 'var(--badge-live-border, #BBF7D0)'}`,
                }}
              >
                {isGuest ? 'GUEST' : 'VERIFIED'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #7B8798)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isGuest ? t('settings.guestDescription', 'Full analytical access enabled') : user?.email}
            </div>
          </div>

          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              color: 'var(--text-primary, #172033)',
              fontSize: '12.5px',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover, #F3F6FA)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>{t('settings.title', 'Settings')}</span>
          </Link>

          {isGuest ? (
            <Link
              href="/signin"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                color: 'var(--badge-info-text)',
                fontSize: '12.5px',
                fontWeight: 600,
                textDecoration: 'none',
                backgroundColor: 'var(--badge-info-bg)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>{t('auth.signIn', 'Sign In / Register')}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--status-critical-bg)',
                color: 'var(--status-critical-text)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>{t('auth.signOut', 'Sign Out')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
