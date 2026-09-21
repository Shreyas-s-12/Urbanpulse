'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { CheckIcon } from '@/components/common/Icons';

interface LandingScreenProps {
  onStart?: () => void;
  destination?: string;
}

export default function LandingScreen({ onStart, destination = '/overview' }: LandingScreenProps) {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('up_agent_started', 'true');
      }
    } catch (err) {
      console.warn('sessionStorage error:', err);
    }

    if (onStart) {
      e.preventDefault();
      e.stopPropagation();
      onStart();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Immersive Hero Visual Artwork */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'hidden',
          transition: 'opacity 0.6s ease-in-out',
          opacity: imageLoaded ? 1 : 0.4,
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

        {/* Ambient Radial & Linear Blend Overlays to seamlessly melt artwork into pure white canvas */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at center, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.68) 45%, rgba(255, 255, 255, 0.92) 85%, #FFFFFF 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.4) 70%, rgba(255,255,255,0.95) 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Main Foreground Container */}
      <main
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '580px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
          padding: '32px 32px',
          borderRadius: '24px',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Brand Mark with UrbanPulseLogo */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 18px',
            borderRadius: '9999px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
          }}
        >
          <UrbanPulseLogo size="sm" showWordmark={true} priority />
        </div>

        {/* Greetings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              fontSize: '44px',
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.15,
              color: '#0F172A',
              margin: 0,
            }}
          >
            How are you?
          </h1>
          <p
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#334155',
              letterSpacing: '-0.3px',
              margin: 0,
            }}
          >
            Let&apos;s get started.
          </p>
        </div>

        {/* Subtitle / Context */}
        <p
          style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: '#475569',
            maxWidth: '460px',
            margin: 0,
          }}
        >
          Your real-time location intelligence agent. Ask about live traffic, weather, air quality, or urban conditions anywhere on Earth, and watch the map respond.
        </p>

        {/* Primary CTA Button */}
        <Link
          href={destination || '/overview'}
          aria-label="Let's Get Started"
          onClick={handleClick}
          style={{
            marginTop: '4px',
            padding: '14px 36px',
            fontSize: '15px',
            fontWeight: 700,
            borderRadius: '12px',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: 30,
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.35), 0 4px 14px rgba(37, 99, 235, 0.35)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.35)';
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1D4ED8';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 22px rgba(37, 99, 235, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#2563EB';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.35)';
          }}
        >
          <span>Let&apos;s Get Started</span>
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

        {/* Verified Data Badges */}
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            fontSize: '12px',
            color: '#475569',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckIcon size={13} color="#2563EB" /> Real Google Traffic
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckIcon size={13} color="#2563EB" /> Standard-Aware AQI
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <CheckIcon size={13} color="#2563EB" /> Zero Mock Data
          </span>
        </div>
      </main>
    </div>
  );
}
