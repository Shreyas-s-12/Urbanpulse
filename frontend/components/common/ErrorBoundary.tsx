'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[UrbanPulse ErrorBoundary]', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            padding: '24px',
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            color: 'var(--text-primary, #111827)',
            textAlign: 'center',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#DC2626' }}>
            {this.props.fallbackTitle || 'Component Unavailable'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748B)', maxWidth: '400px' }}>
            {this.props.fallbackMessage ||
              this.state.error?.message ||
              'An unexpected error occurred in this module.'}
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              marginTop: '8px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              backgroundColor: 'var(--accent-primary, #2563EB)',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
