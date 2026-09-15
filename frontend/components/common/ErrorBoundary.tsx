'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
  renderFallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      showDetails: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[UrbanPulse ErrorBoundary] Caught subsystem exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.renderFallback && this.state.error) {
        return this.props.renderFallback(this.state.error, this.handleReset);
      }

      return (
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '12px',
            margin: '12px',
            color: 'var(--text-primary, #0F172A)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
            {this.props.fallbackTitle || 'Subsystem Temporarily Unavailable'}
          </h3>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', maxWidth: '420px', lineHeight: 1.5, margin: 0 }}>
            {this.props.fallbackMessage || 'This section encountered an unexpected condition. Other UrbanPulse intelligence systems remain operational.'}
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={this.handleReset}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: 'var(--radius-sm, 6px)',
                backgroundColor: 'var(--accent-primary, #2563EB)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              Retry
            </button>
            <button
              onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: 'var(--radius-sm, 6px)',
                backgroundColor: 'var(--bg-app, #F8FAFC)',
                border: '1px solid var(--border-subtle, #E2E8F0)',
                color: 'var(--text-secondary, #64748B)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {this.state.showDetails ? 'Hide Diagnostics' : 'Diagnostics'}
            </button>
          </div>

          {this.state.showDetails && this.state.error && (
            <pre
              style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: 'var(--bg-app, #F8FAFC)',
                border: '1px solid var(--border-subtle, #E2E8F0)',
                borderRadius: 'var(--radius-xs, 4px)',
                fontSize: '11px',
                color: '#DC2626',
                maxWidth: '100%',
                maxHeight: '140px',
                overflow: 'auto',
                textAlign: 'left',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export function GoogleMapErrorBoundary({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <ErrorBoundary
      fallbackTitle="Map Canvas Offline"
      fallbackMessage="The interactive Google Map could not be displayed. UrbanPulse intelligence, routes, agent conversations, and sensor streams continue operating normally."
      onRetry={onRetry}
      renderFallback={(error, reset) => (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            color: 'var(--text-primary, #0F172A)',
            padding: '32px',
            textAlign: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #2563EB)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </div>

          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
              Google Maps Temporarily Offline
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', maxWidth: '440px', lineHeight: 1.5, marginTop: '6px' }}>
              The map interface encountered a loading or network barrier. All other UrbanPulse capabilities, telemetry, and spatial analysis remain active.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={reset}
              style={{
                height: '36px',
                padding: '0 18px',
                borderRadius: 'var(--radius-sm, 6px)',
                backgroundColor: 'var(--accent-primary, #2563EB)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Reconnect Map</span>
            </button>
          </div>

          {error && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted, #94A3B8)',
                fontFamily: 'monospace',
                maxWidth: '420px',
                wordBreak: 'break-word',
              }}
            >
              {error.message || String(error)}
            </div>
          )}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
