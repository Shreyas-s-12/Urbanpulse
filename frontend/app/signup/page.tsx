'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSelector from '@/components/common/LanguageSelector';

export default function SignUpPage() {
  const router = useRouter();
  const { signup, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already authenticated, redirect to overview
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace('/overview');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setErrorMessage(t('auth.invalidCredentials', 'Please fill in all fields.'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage(t('auth.invalidEmail', 'Please provide a valid email address.'));
      return;
    }

    if (password.length < 8) {
      setErrorMessage(t('auth.passwordTooShort', 'Password must be at least 8 characters.'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('auth.passwordsDoNotMatch', 'Passwords do not match.'));
      return;
    }

    setIsSubmitting(true);
    const result = await signup(cleanName, cleanEmail, password, confirmPassword);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage('Account created successfully! Redirecting to Sign In...');
      setTimeout(() => {
        router.push('/signin');
      }, 1200);
    } else {
      setErrorMessage(result.error || t('auth.serverUnavailable', 'Network or backend service unavailable. Please try again.'));
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
        position: 'relative',
      }}
    >
      {/* Top Bar with Language Selector */}
      <div style={{ position: 'absolute', top: '20px', right: '24px', zIndex: 50 }}>
        <LanguageSelector />
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-panel)',
          padding: '36px 32px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header with Logo */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: '28px',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <UrbanPulseLogo size="md" showWordmark={true} priority />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px',
            }}
          >
            {t('auth.createAccount', 'Create Account')}
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            {t('auth.tagline', 'Understand the location before you build, travel, respond, or plan.')}
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#059669',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>{successMessage}</div>
          </div>
        )}

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
              lineHeight: 1.4,
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
              style={{ flexShrink: 0, marginTop: '1px' }}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div style={{ flex: 1 }}>{errorMessage}</div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="name-input"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              {t('auth.fullName', 'Full Name')}
            </label>
            <input
              id="name-input"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-light)')}
            />
          </div>

          <div>
            <label
              htmlFor="email-input"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
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
                height: '42px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-light)')}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                htmlFor="password-input"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {t('auth.password', 'Password')}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  fontSize: '12px',
                  color: 'var(--accent-primary)',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="password-input"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-light)')}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password-input"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              {t('auth.confirmPassword', 'Confirm Password')}
            </label>
            <input
              id="confirm-password-input"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-light)')}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-label="Create Account"
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
                {t('auth.creatingAccount', 'Creating account...')}
              </span>
            ) : (
              <span style={{ color: '#FFFFFF' }}>{t('auth.createAccount', 'Create Account') || 'Create Account'}</span>
            )}
          </button>
        </form>

        {/* Existing User Redirect */}
        <div
          style={{
            marginTop: '22px',
            paddingTop: '18px',
            borderTop: '1px solid var(--border, var(--border-subtle, #E2E8F0))',
            textAlign: 'center',
            fontSize: '13.5px',
            color: 'var(--muted, var(--text-secondary, #64748B))',
          }}
        >
          <span>{t('auth.alreadyHaveAccount', 'Already have an account?')} </span>
          <Link
            href="/signin"
            style={{
              color: 'var(--primary, #2563EB)',
              fontWeight: 600,
              textDecoration: 'none',
              marginLeft: '4px',
            }}
          >
            {t('auth.signIn', 'Sign In')}
          </Link>
        </div>
      </div>
    </div>
  );
}
