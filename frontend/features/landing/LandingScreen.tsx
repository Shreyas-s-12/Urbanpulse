'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LandingScreenProps {
  onStart?: () => void;
  destination?: string;
}

export default function LandingScreen({ onStart, destination = '/copilot' }: LandingScreenProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('up_agent_started', 'true');
      }
    } catch (err) {
      console.warn('sessionStorage error:', err);
    }

    if (onStart) {
      try {
        onStart();
      } catch (err) {
        console.warn('onStart callback error:', err);
      }
    }

    // Immediately navigate to the agent route
    router.push(destination);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: '#0A0E13',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        overflow: 'hidden',
      }}
    >
      {/* Subtle geometric ambient background */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(19, 184, 135, 0.12) 0%, rgba(10, 14, 19, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(40px)',
          transform: 'translate(-10%, -10%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(10, 14, 19, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(50px)',
          transform: 'translate(40%, 30%)',
        }}
      />

      {/* Main Container */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '560px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '28px',
        }}
      >
        {/* Brand Tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(19, 184, 135, 0.12)',
            border: '1px solid rgba(19, 184, 135, 0.3)',
            boxShadow: '0 0 20px rgba(19, 184, 135, 0.15)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#13B887',
              boxShadow: '0 0 10px #13B887',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: '#13B887',
              textTransform: 'uppercase',
            }}
          >
            UrbanPulse
          </span>
        </div>

        {/* Greetings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              fontSize: '44px',
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.15,
              color: '#F1F5F9',
            }}
          >
            How are you?
          </h1>
          <p
            style={{
              fontSize: '20px',
              fontWeight: 400,
              color: '#94A3B8',
              letterSpacing: '-0.2px',
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
            color: '#64748B',
            maxWidth: '440px',
          }}
        >
          Your real-time location intelligence agent. Ask about live traffic, weather, air quality, or urban conditions anywhere on Earth, and watch the map respond.
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          aria-label="Let's Get Started"
          disabled={isNavigating}
          onClick={handleClick}
          style={{
            marginTop: '8px',
            padding: '16px 36px',
            fontSize: '15px',
            fontWeight: 700,
            borderRadius: '12px',
            backgroundColor: '#13B887',
            color: '#0A0E13',
            border: 'none',
            cursor: isNavigating ? 'default' : 'pointer',
            boxShadow: '0 4px 20px rgba(19, 184, 135, 0.35)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: 20,
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(19, 184, 135, 0.5), 0 4px 20px rgba(19, 184, 135, 0.35)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(19, 184, 135, 0.35)';
          }}
          onMouseEnter={(e) => {
            if (!isNavigating) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 28px rgba(19, 184, 135, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(19, 184, 135, 0.35)';
          }}
        >
          <span>{isNavigating ? 'Opening Agent...' : "Let's Get Started"}</span>
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
        </button>

        {/* Bottom Feature Badges */}
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            gap: '20px',
            fontSize: '12px',
            color: '#475569',
            fontWeight: 500,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#13B887' }}>✓</span> Real Google Traffic
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#13B887' }}>✓</span> Standard-Aware AQI
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#13B887' }}>✓</span> Zero Mock Data
          </span>
        </div>
      </div>
    </div>
  );
}
