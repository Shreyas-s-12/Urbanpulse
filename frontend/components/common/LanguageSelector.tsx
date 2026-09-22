'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, SupportedLanguage } from '@/context/LanguageContext';

export const LANGUAGES: { code: SupportedLanguage; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'tr', label: 'Turkish', nativeName: 'Türkçe' },
  { code: 'tl', label: 'Tagalog', nativeName: 'Tagalog' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', label: 'Marathi', nativeName: 'मराठी' },
  { code: 'id', label: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'ko', label: 'Korean', nativeName: '한국어' },
  { code: 'zh', label: 'Simplified Chinese', nativeName: '简体中文' },
];

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Language"
        aria-haspopup="true"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '36px',
          padding: '0 12px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          border: '1px solid var(--border, #E2E7EF)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary, #334155)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: 'var(--shadow-xs)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary, #2563EB)';
          e.currentTarget.style.color = 'var(--text-primary, #172033)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border, #E2E7EF)';
          e.currentTarget.style.color = 'var(--text-secondary, #334155)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z" />
        </svg>
        <span>{currentLang.nativeName}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '190px',
            maxHeight: '340px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-panel, #FFFFFF)',
            borderRadius: '10px',
            border: '1px solid var(--border, #E2E7EF)',
            boxShadow: 'var(--shadow-panel, 0 12px 30px rgba(0, 0, 0, 0.12))',
            zIndex: 100,
            padding: '4px',
          }}
        >
          {LANGUAGES.map((l) => {
            const isSelected = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
                  color: isSelected ? 'var(--accent-primary, #2563EB)' : 'var(--text-primary, #172033)',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover, #F3F6FA)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{l.nativeName}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #7B8798)' }}>{l.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
