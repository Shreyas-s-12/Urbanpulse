'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero' | number;

interface UrbanPulseLogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  wordmarkSize?: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<string, { width: number; height: number; fontSize: string }> = {
  xs: { width: 24, height: 22, fontSize: '13px' },
  sm: { width: 32, height: 30, fontSize: '15px' },
  md: { width: 42, height: 39, fontSize: '18px' },
  lg: { width: 54, height: 50, fontSize: '22px' },
  hero: { width: 76, height: 71, fontSize: '28px' },
};

export default function UrbanPulseLogo({
  size = 'md',
  showWordmark = false,
  wordmarkSize,
  priority = false,
  className,
  style,
}: UrbanPulseLogoProps) {
  const [hasError, setHasError] = useState(false);

  let width = 42;
  let height = 39;
  let defaultFontSize = '18px';

  if (typeof size === 'number') {
    width = size;
    height = Math.round(size * (1211 / 1299));
    defaultFontSize = `${Math.round(size * 0.45)}px`;
  } else if (SIZE_MAP[size]) {
    width = SIZE_MAP[size].width;
    height = SIZE_MAP[size].height;
    defaultFontSize = SIZE_MAP[size].fontSize;
  }

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.max(6, Math.round(width * 0.22)),
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Brand Icon */}
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: 'relative',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!hasError ? (
          <Image
            src="/images/logo.png"
            alt="UrbanPulse"
            width={width}
            height={height}
            priority={priority}
            onError={() => setHasError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '8px',
              backgroundColor: '#1E293B',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: `${Math.max(10, Math.round(width * 0.4))}px`,
              letterSpacing: '-0.5px',
            }}
          >
            UP
          </div>
        )}
      </div>

      {/* Optional Wordmark */}
      {showWordmark && (
        <span
          style={{
            fontSize: wordmarkSize || defaultFontSize,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            lineHeight: 1,
            color: 'var(--text-primary, #0F172A)',
            display: 'inline-flex',
            alignItems: 'baseline',
          }}
        >
          <span>Urban</span>
          <span style={{ color: 'var(--accent-primary, #2563EB)' }}>Pulse</span>
        </span>
      )}
    </div>
  );
}
