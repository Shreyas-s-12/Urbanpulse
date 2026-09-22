'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { CheckIcon } from '@/components/common/Icons';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import LanguageSelector from '@/components/common/LanguageSelector';

interface LandingScreenProps {
  onStart?: () => void;
  destination?: string;
}

export default function LandingScreen({ onStart, destination = '/signin' }: LandingScreenProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { loginGuest } = useAuth();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleStart = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onStart) {
      e.preventDefault();
      onStart();
    }
  };

  const handleContinueAsGuest = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsGuestLoading(true);
    try {
      await loginGuest();
    } catch (err) {
      console.warn('[LandingScreen] Guest session initialization fallback:', err);
    } finally {
      router.push('/overview?guest=true');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar with Language Selector */}
      <div style={{ position: 'absolute', top: '20px', right: '24px', zIndex: 50 }}>
        <LanguageSelector />
      </div>

      {/* Immersive Hero Visual Artwork */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'hidden',
          transition: 'opacity 0.6s ease-in-out',
          opacity: imageLoaded ? 0.85 : 0.3,
        }}
      >
        <Image
          src="/images/landing-page.png"
          alt="UrbanPulse Smart City Intelligence"
          fill
          priority
          sizes="100vw"
          onLoad={() => setImageLoaded(true)}
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />

        {/* Ambient Radial & Linear Blend Overlays */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--landing-radial-overlay)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--landing-linear-overlay)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Main Foreground Container */}
      <main
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '620px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '36px 32px',
          borderRadius: '24px',
          backgroundColor: 'var(--landing-card-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--landing-card-border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* Brand Mark with UrbanPulseLogo */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 20px',
            borderRadius: '9999px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <UrbanPulseLogo size="sm" showWordmark={true} priority />
        </div>

        {/* Title & Taglines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              fontSize: '40px',
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            UrbanPulse
          </h1>
          <p
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--accent-primary)',
              letterSpacing: '-0.2px',
              margin: 0,
            }}
          >
            {t('landing.subtitle', 'AI Site & Urban Decision Intelligence')}
          </p>
        </div>

        {/* Core Value Proposition Quote */}
        <p
          style={{
            fontSize: '15px',
            fontWeight: 500,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: '520px',
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          &ldquo;{t('landing.tagline', 'Understand the location before you build, travel, respond, or plan.')}&rdquo;
        </p>

        {/* Context / Explanation */}
        <p
          style={{
            fontSize: '13.5px',
            lineHeight: 1.55,
            color: 'var(--text-muted)',
            maxWidth: '480px',
            margin: 0,
          }}
        >
          {t(
            'landing.description',
            'Your real-time location intelligence agent. Ask about live traffic, weather, air quality, or urban conditions anywhere on Earth, and watch the map respond.'
          )}
        </p>

        {/* Primary Action Flow */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', marginTop: '8px' }}>
          {/* Primary CTA Button: GET STARTED -> /signin */}
          <Link
            href={destination || '/signin'}
            aria-label={t('landing.getStarted', 'GET STARTED')}
            onClick={handleStart}
            style={{
              padding: '14px 44px',
              fontSize: '15px',
              fontWeight: 700,
              borderRadius: '12px',
              backgroundColor: 'var(--button)',
              color: 'var(--button-foreground)',
              border: 'none',
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              zIndex: 30,
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button-hover)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(37, 99, 235, 0.4)';
            }}
          >
            <span>{t('landing.getStarted', 'GET STARTED')}</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </Link>

          {/* Secondary Links: Already have an account? Sign in | Continue as Guest */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <div>
              <span>{t('landing.alreadyHaveAccount', 'Already have an account?')} </span>
              <Link
                href="/signin"
                style={{
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  marginLeft: '4px',
                }}
              >
                {t('common.signIn', 'Sign in')}
              </Link>
            </div>

            <button
              type="button"
              onClick={handleContinueAsGuest}
              disabled={isGuestLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isGuestLoading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span>{isGuestLoading ? t('common.loading', 'Loading...') : t('landing.continueAsGuest', 'Continue as Guest')}</span>
            </button>
          </div>
        </div>

        {/* Verified Data Badges */}
        <div
          style={{
            marginTop: '10px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckIcon size={13} color="var(--accent-primary)" /> {t('landing.realTraffic', 'Real Google Traffic')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckIcon size={13} color="var(--accent-primary)" /> {t('landing.standardAQI', 'Standard-Aware AQI')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckIcon size={13} color="var(--accent-primary)" /> {t('landing.zeroMockData', 'Zero Mock Data')}
          </span>
        </div>
      </main>
    </div>
  );
}
