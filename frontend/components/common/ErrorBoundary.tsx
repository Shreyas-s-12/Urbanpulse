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

export type SubsystemErrorType =
  | 'REACT_RENDER_ERROR'
  | 'MAP_PROVIDER_ERROR'
  | 'MAP_LOADING_ERROR'
  | 'MAP_NETWORK_ERROR'
  | 'HEATMAP_ERROR'
  | 'SUBSYSTEM_ERROR';

export function classifyError(error: Error | null): {
  type: SubsystemErrorType;
  title: string;
  message: string;
  isRealMapOffline: boolean;
} {
  if (!error) {
    return {
      type: 'SUBSYSTEM_ERROR',
      title: 'Subsystem Unavailable',
      message: 'An unexpected condition occurred.',
      isRealMapOffline: false,
    };
  }

  const msg = error.message || String(error);

  // Check for React rendering error (e.g. Minified React error #31, object child, invariant)
  if (
    msg.includes('Minified React error #31') ||
    msg.includes('Objects are not valid as a React child') ||
    msg.includes('rendered directly as a React child') ||
    msg.includes('Minified React error') ||
    error.name === 'InvariantViolation'
  ) {
    return {
      type: 'REACT_RENDER_ERROR',
      title: 'Component Render Error (REACT_RENDER_ERROR)',
      message: 'A user interface component encountered an invalid property rendering condition. Google Maps service is operational.',
      isRealMapOffline: false,
    };
  }

  // Check for genuine Google Maps API / Network failure
  if (
    msg.includes('google is not defined') ||
    msg.includes('Google Maps API failed') ||
    msg.includes('maps.googleapis.com') ||
    msg.includes('googleMapsLoader') ||
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('MissingKeyMapError') ||
    error.name === 'MapProviderError'
  ) {
    return {
      type: 'MAP_PROVIDER_ERROR',
      title: 'Google Maps Temporarily Offline',
      message: 'The map interface encountered an authentic provider or network barrier. All other UrbanPulse capabilities, telemetry, and spatial analysis remain active.',
      isRealMapOffline: true,
    };
  }

  if (msg.includes('deck.gl') || msg.includes('HeatmapLayer') || msg.includes('WebGL')) {
    return {
      type: 'HEATMAP_ERROR',
      title: 'Spatial Heatmap Overlay Error (HEATMAP_ERROR)',
      message: 'The GPU heatmap acceleration layer encountered a shader or geometry condition. Base Google Maps remains operational.',
      isRealMapOffline: false,
    };
  }

  if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('net::ERR')) {
    return {
      type: 'MAP_NETWORK_ERROR',
      title: 'Network Connection Interrupted (MAP_NETWORK_ERROR)',
      message: 'Unable to reach geospatial service endpoints. Check network connectivity.',
      isRealMapOffline: true,
    };
  }

  return {
    type: 'REACT_RENDER_ERROR',
    title: 'Component Exception (REACT_RENDER_ERROR)',
    message: 'An unexpected component runtime exception occurred. Google Maps is operational.',
    isRealMapOffline: false,
  };
}

interface SubsystemErrorBoundaryProps {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
  silent?: boolean;
}

export class SubsystemErrorBoundary extends Component<
  SubsystemErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: SubsystemErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[UrbanPulse SubsystemErrorBoundary:${this.props.name}] Caught exception:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      if (this.props.silent) return null;

      return (
        <div
          style={{
            padding: '4px 8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#DC2626',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {this.props.name} error
          </span>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#2563EB',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '10px',
            }}
          >
            retry
          </button>
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
      renderFallback={(error, reset) => {
        const classified = classifyError(error);

        return (
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
                backgroundColor: classified.isRealMapOffline ? 'rgba(37, 99, 235, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: classified.isRealMapOffline ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: classified.isRealMapOffline ? 'var(--accent-primary, #2563EB)' : '#DC2626',
              }}
            >
              {classified.isRealMapOffline ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>

            <div>
              <div
                style={{
                  display: 'inline-block',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: classified.isRealMapOffline ? 'rgba(37, 99, 235, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: classified.isRealMapOffline ? '#2563EB' : '#DC2626',
                  marginBottom: '8px',
                }}
              >
                {classified.type}
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                {classified.title}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', maxWidth: '440px', lineHeight: 1.5, marginTop: '6px' }}>
                {classified.message}
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
                <span>{classified.isRealMapOffline ? 'Reconnect Map' : 'Retry Rendering'}</span>
              </button>
            </div>

            {error && (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted, #94A3B8)',
                  fontFamily: 'monospace',
                  maxWidth: '460px',
                  wordBreak: 'break-word',
                  backgroundColor: '#F1F5F9',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  textAlign: 'left',
                }}
              >
                <strong>Error Details:</strong> {error.message || String(error)}
              </div>
            )}
          </div>
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
