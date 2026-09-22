'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/common/LanguageSelector';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRoute = searchParams.get('next') || '/overview';

  const { login, loginGuest, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated with a user account, redirect to nextRoute
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace(nextRoute);
    }
  }, [isAuthenticated, authLoading, router, nextRoute]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage(t('auth.invalidCredentials', 'Please enter both email and password.'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage(t('auth.invalidEmail', 'Please provide a valid email address.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(cleanEmail, password);
      if (result.success) {
        router.push(nextRoute);
      } else {
        setErrorMessage(result.error || t('auth.invalidCredentials', 'Invalid email or password.'));
      }
    } catch {
      setErrorMessage(t('auth.serverUnavailable', 'Network or backend service unavailable. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAsGuest = async () => {
    setErrorMessage(null);
    setIsGuestSubmitting(true);
    try {
      await loginGuest();
    } catch (err) {
      console.warn('[SignIn] Guest session warning:', err);
    } finally {
      router.push('/overview?guest=true');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--background, var(--bg-app, #F8FAFC))',
        color: 'var(--foreground, var(--text-primary, #111827))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Top Bar with Language Selector */}
      <header
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <LanguageSelector />
      </header>

      {/* Centered Sign-In Card (360-440px ideal responsive presentation) */}
      <main
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'var(--surface, var(--bg-surface, #FFFFFF))',
          borderRadius: '16px',
          border: '1px solid var(--border, var(--border-subtle, #E2E8F0))',
          boxShadow: 'var(--shadow-panel, 0 16px 24px -4px rgba(0, 0, 0, 0.08))',
          padding: '40px 32px',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Header with Brand Logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: '26px',
          }}
        >
          <div style={{ marginBottom: '14px' }}>
            <UrbanPulseLogo size="md" showWordmark={true} priority />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--foreground, var(--text-primary, #111827))',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px',
            }}
          >
            {t('auth.welcomeBack', 'Welcome back')}
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--muted, var(--text-secondary, #64748B))',
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            {t('auth.signInToContinue', 'Sign in to continue to UrbanPulse')}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#DC2626',
              fontSize: '13px',
              lineHeight: 1.45,
              marginBottom: '20px',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '2px' }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div style={{ flex: 1, fontWeight: 500 }}>{errorMessage}</div>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
          <div>
            <label
              htmlFor="email-input"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--foreground, var(--text-primary, #111827))',
                marginBottom: '6px',
              }}
            >
              {t('auth.email', 'Email')}
            </label>
            <input
              id="email-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid var(--border, var(--border-light, #CBD5E1))',
                backgroundColor: 'var(--input, var(--bg-surface, #FFFFFF))',
                color: 'var(--foreground, var(--text-primary, #111827))',
                fontSize: '14.5px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary, #2563EB)';
                e.target.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border, var(--border-light, #CBD5E1))';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                htmlFor="password-input"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--foreground, var(--text-primary, #111827))',
                }}
              >
                {t('auth.password', 'Password')}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  fontSize: '12.5px',
                  color: 'var(--primary, #2563EB)',
                  fontWeight: 600,
                  background: 'transparent',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="password-input"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid var(--border, var(--border-light, #CBD5E1))',
                backgroundColor: 'var(--input, var(--bg-surface, #FFFFFF))',
                color: 'var(--foreground, var(--text-primary, #111827))',
                fontSize: '14.5px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary, #2563EB)';
                e.target.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border, var(--border-light, #CBD5E1))';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Primary Sign In Button: Always solidly visible with high contrast */}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-label="Sign In"
            style={{
              width: '100%',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#2563EB',
              background: 'var(--button, var(--accent-primary, #2563EB))',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              cursor: isSubmitting ? 'wait' : 'pointer',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.15s ease, transform 0.1s ease',
              marginTop: '6px',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#1D4ED8';
                e.currentTarget.style.background = 'var(--button-hover, var(--accent-primary-hover, #1D4ED8))';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#2563EB';
                e.currentTarget.style.background = 'var(--button, var(--accent-primary, #2563EB))';
              }
            }}
          >
            {isSubmitting ? (
              <span style={{ color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                </svg>
                {t('auth.signingIn', 'Signing in...')}
              </span>
            ) : (
              <span style={{ color: '#FFFFFF' }}>{t('auth.signIn', 'Sign In') || 'Sign In'}</span>
            )}
          </button>
        </form>

        {/* Secondary Actions: Create Account & Continue as Guest */}
        <div
          style={{
            marginTop: '22px',
            paddingTop: '18px',
            borderTop: '1px solid var(--border, var(--border-subtle, #E2E8F0))',
            textAlign: 'center',
            fontSize: '13.5px',
            color: 'var(--muted, var(--text-secondary, #64748B))',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div>
            <span>{t('auth.dontHaveAccount', "Don't have an account?")} </span>
            <Link
              href="/signup"
              style={{
                color: 'var(--primary, #2563EB)',
                fontWeight: 600,
                textDecoration: 'none',
                marginLeft: '4px',
              }}
            >
              {t('auth.createAccount', 'Create Account')}
            </Link>
          </div>

          {/* Continue as Guest Button */}
          <button
            type="button"
            onClick={handleContinueAsGuest}
            disabled={isGuestSubmitting}
            aria-label="Continue as Guest"
            style={{
              width: '100%',
              height: '42px',
              borderRadius: '10px',
              border: '1px solid var(--border, var(--border-light, #CBD5E1))',
              backgroundColor: 'var(--bg-surface-secondary, #F1F5F9)',
              color: 'var(--foreground, var(--text-primary, #111827))',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: isGuestSubmitting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary, #2563EB)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border, var(--border-light, #CBD5E1))';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>{isGuestSubmitting ? t('common.loading', 'Loading...') : t('common.continueAsGuest', 'Continue as Guest')}</span>
          </button>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background, #F8FAFC)' }}>
          <div>Loading...</div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
