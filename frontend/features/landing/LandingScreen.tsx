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

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('up_agent_started', 'true');
      }
    } catch (err) {
      console.warn('sessionStorage error:', err);
    }

    if (onStart) {
      setIsNavigating(true);
      onStart();
    } else if (destination) {
      setIsNavigating(true);
      router.push(destination);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: '#FFFFFF',
        color: '#111827',
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
          width: '640px',
          height: '640px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.05) 0%, rgba(255, 255, 255, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(50px)',
          transform: 'translate(-15%, -15%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(241, 245, 249, 0.8) 0%, rgba(255, 255, 255, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(60px)',
          transform: 'translate(35%, 25%)',
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
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#2563EB',
              boxShadow: '0 0 8px rgba(37, 99, 235, 0.6)',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: '#2563EB',
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
              color: '#111827',
            }}
          >
            How are you?
          </h1>
          <p
            style={{
              fontSize: '20px',
              fontWeight: 500,
              color: '#4B5563',
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
            color: '#6B7280',
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
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            cursor: isNavigating ? 'default' : 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
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
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.35), 0 4px 14px rgba(37, 99, 235, 0.3)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.3)';
          }}
          onMouseEnter={(e) => {
            if (!isNavigating) {
              e.currentTarget.style.backgroundColor = '#1D4ED8';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#2563EB';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.3)';
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
            color: '#6B7280',
            fontWeight: 500,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#2563EB', fontWeight: 700 }}>✓</span> Real Google Traffic
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#2563EB', fontWeight: 700 }}>✓</span> Standard-Aware AQI
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#2563EB', fontWeight: 700 }}>✓</span> Zero Mock Data
          </span>
        </div>
      </div>
    </div>
  );
}
