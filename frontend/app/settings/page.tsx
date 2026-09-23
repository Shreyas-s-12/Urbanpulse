'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSettingsStore, AppTheme, FontSize, DefaultMapMode } from '@/stores/useSettingsStore';
import { LANGUAGES } from '@/components/common/LanguageSelector';
import { useMapContext } from '@/context/MapContext';

export default function SettingsPage() {
  const { user, isAuthenticated, isGuest, logout } = useAuth();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const mapContext = useMapContext();

  const {
    theme,
    setTheme,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    fontSize,
    setFontSize,
    keyboardNav,
    setKeyboardNav,
    voiceEnabled,
    setVoiceEnabled,
    voiceLanguage,
    setVoiceLanguage,
    speechOutput,
    setSpeechOutput,
    defaultMapMode,
    setDefaultMapMode,
    defaultRadiusKm,
    setDefaultRadiusKm,
  } = useSettingsStore();

  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const showSaved = (msg: string) => {
    setSaveBanner(msg);
    setTimeout(() => setSaveBanner(null), 2500);
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        padding: '32px 24px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Page Title */}
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 6px 0' }}>
            {t('settings.title', 'Settings')}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            {t('settings.subtitle', 'Manage account preferences, appearance, accessibility, and multimodal interfaces.')}
          </p>
        </div>

        {/* Save confirmation toast */}
        {saveBanner && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#059669',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{saveBanner}</span>
          </div>
        )}

        {/* SECTION 1: ACCOUNT */}
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {t('settings.account', 'Account')}
            </h2>
          </div>

          {isAuthenticated && user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {t('auth.fullName', 'Full Name')}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>{user.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {t('auth.email', 'Email')}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>{user.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {t('settings.accountType', 'Account Type')}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                    {t('settings.registeredUser', 'Registered User')}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => logout()}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>{t('auth.signOut', 'Sign Out')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                  <span>{t('settings.guestUser', 'Guest Explorer')}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  {t('settings.guestDescription', 'You are browsing in guest mode with full analytical access.')}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <Link
                    href="/signin"
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    {t('common.signIn', 'Sign In')}
                  </Link>
                  <Link
                    href="/signup"
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    {t('common.signUp', 'Create Account')}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2: APPEARANCE (Light, Dark, System) */}
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {t('settings.appearance', 'Appearance')}
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
            {t('settings.themeDesc', 'Choose how UrbanPulse looks on your device.')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              {
                id: 'light' as AppTheme,
                label: t('settings.lightMode', 'Light'),
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                ),
              },
              {
                id: 'dark' as AppTheme,
                label: t('settings.darkMode', 'Dark'),
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                  </svg>
                ),
              },
              {
                id: 'system' as AppTheme,
                label: t('settings.systemMode', 'System'),
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                ),
              },
            ].map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                    showSaved(`Theme changed to ${opt.label}`);
                  }}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--accent-primary-light)' : 'var(--bg-surface-secondary)',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{opt.icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 3: LANGUAGE (19 Languages + RTL awareness) */}
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {t('settings.language', 'Language')}
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
            {t('settings.languageDesc', 'Select your interface and conversational language.')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '10px',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    showSaved(`Language changed to ${lang.nativeName}`);
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--accent-primary-light)' : 'var(--bg-surface-secondary)',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    cursor: 'pointer',
                    textAlign: isRTL ? 'right' : 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{lang.nativeName}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lang.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 4: ACCESSIBILITY */}
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="4" r="2" />
                <path d="M12 7v10" />
                <path d="M6 10h12" />
                <path d="M8 21l4-4 4 4" />
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {t('settings.accessibility', 'Accessibility')}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Reduced Motion */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.reducedMotion', 'Reduced Motion')}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {t('settings.reducedMotionDesc', 'Minimize UI animations and dynamic camera transitions.')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reducedMotion}
                onClick={() => {
                  setReducedMotion(!reducedMotion);
                  showSaved(`Reduced motion ${!reducedMotion ? 'enabled' : 'disabled'}`);
                }}
                style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '13px',
                  backgroundColor: reducedMotion ? 'var(--accent-primary)' : 'var(--border-strong)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: reducedMotion ? '23px' : '3px',
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>

            {/* High Contrast */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.highContrast', 'High Contrast')}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {t('settings.highContrastDesc', 'Increase border and text contrast for enhanced visibility.')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                onClick={() => {
                  setHighContrast(!highContrast);
                  showSaved(`High contrast ${!highContrast ? 'enabled' : 'disabled'}`);
                }}
                style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '13px',
                  backgroundColor: highContrast ? 'var(--accent-primary)' : 'var(--border-strong)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: highContrast ? '23px' : '3px',
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>

            {/* Text Scaling */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.textSize', 'Text Size')}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['sm', 'md', 'lg'] as FontSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setFontSize(sz);
                      showSaved(`Font size set to ${sz.toUpperCase()}`);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: fontSize === sz ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: fontSize === sz ? 'var(--accent-primary-light)' : 'var(--bg-surface-secondary)',
                      color: fontSize === sz ? 'var(--accent-primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {sz === 'sm' ? 'Small' : sz === 'md' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.keyboardNav', 'Keyboard Navigation')}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {t('settings.keyboardNavDesc', 'Use Tab, Enter, Escape and directional keys to navigate.')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={keyboardNav}
                onClick={() => {
                  setKeyboardNav(!keyboardNav);
                  showSaved(`Keyboard navigation ${!keyboardNav ? 'enabled' : 'disabled'}`);
                }}
                style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '13px',
                  backgroundColor: keyboardNav ? 'var(--accent-primary)' : 'var(--border-strong)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: keyboardNav ? '23px' : '3px',
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 5: VOICE */}
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {t('settings.voice', 'Voice & Audio')}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.voiceEnabled', 'Voice Input')}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {t('settings.voiceEnabledDesc', 'Enable voice queries and speech recognition in Nexus.')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={voiceEnabled}
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  showSaved(`Voice input ${!voiceEnabled ? 'enabled' : 'disabled'}`);
                }}
                style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '13px',
                  backgroundColor: voiceEnabled ? 'var(--accent-primary)' : 'var(--border-strong)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: voiceEnabled ? '23px' : '3px',
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.speechOutput', 'Speech Output')}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {t('settings.speechOutputDesc', 'Read aloud Nexus intelligence summaries.')}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={speechOutput}
                onClick={() => {
                  setSpeechOutput(!speechOutput);
                  showSaved(`Speech output ${!speechOutput ? 'enabled' : 'disabled'}`);
                }}
                style={{
                  width: '46px',
                  height: '26px',
                  borderRadius: '13px',
                  backgroundColor: speechOutput ? 'var(--accent-primary)' : 'var(--border-strong)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  border: 'none',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: speechOutput ? '23px' : '3px',
                    transition: 'left 0.2s ease',
                  }}
                />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 6: MAP & SPATIAL */}
        <section
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {t('settings.map', 'Map & Spatial')}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.defaultMapMode', 'Default Map View')}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['roadmap', 'satellite', 'terrain'] as DefaultMapMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setDefaultMapMode(mode);
                      mapContext?.setMapMode?.(mode);
                      showSaved(`Default map mode set to ${mode}`);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: defaultMapMode === mode ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: defaultMapMode === mode ? 'var(--accent-primary-light)' : 'var(--bg-surface-secondary)',
                      color: defaultMapMode === mode ? 'var(--accent-primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'roadmap' ? t('settings.roadmap', 'Roadmap') : mode === 'satellite' ? t('settings.satellite', 'Satellite') : t('settings.terrain', 'Terrain')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settings.defaultRadius', 'Default Surveillance Radius')}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[5, 10, 25, 50, 100].map((rad) => (
                  <button
                    key={rad}
                    type="button"
                    onClick={() => {
                      setDefaultRadiusKm(rad);
                      mapContext?.setSelectedRadiusKm?.(rad);
                      showSaved(`Default radius set to ${rad} km`);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: defaultRadiusKm === rad ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: defaultRadiusKm === rad ? 'var(--accent-primary-light)' : 'var(--bg-surface-secondary)',
                      color: defaultRadiusKm === rad ? 'var(--accent-primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {rad} km
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
