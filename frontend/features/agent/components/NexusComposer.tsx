'use client';

import React from 'react';
import VoiceControl from '@/features/multimodal/voice/VoiceControl';
import { useLanguage } from '@/context/LanguageContext';

interface NexusComposerProps {
  inputQuery: string;
  setInputQuery: (val: string) => void;
  onSend: (text: string) => void;
  isProcessing: boolean;
}

export default function NexusComposer({
  inputQuery,
  setInputQuery,
  onSend,
  isProcessing,
}: NexusComposerProps) {
  const { t } = useLanguage();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing && inputQuery.trim()) {
        onSend(inputQuery);
      }
    }
  };

  return (
    <div
      style={{
        height: '64px',
        padding: '10px 16px',
        borderTop: '1px solid var(--border, #E2E7EF)',
        backgroundColor: 'var(--bg-header, #FFFFFF)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      <input
        type="text"
        placeholder={t('nexus.placeholder', 'Ask about traffic, weather, air quality, or a location...')}
        value={inputQuery}
        onChange={(e) => setInputQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
        style={{
          flex: 1,
          height: '44px',
          padding: '0 14px',
          borderRadius: '10px',
          border: '1px solid var(--border-hover, #CBD5E1)',
          backgroundColor: 'var(--assistant-card-bg, #FFFFFF)',
          fontSize: '13px',
          color: 'var(--text-primary, #172033)',
          outline: 'none',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          opacity: isProcessing ? 0.7 : 1,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary, #2563EB)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-hover, #CBD5E1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      <VoiceControl
        onTranscript={(text) => setInputQuery(text)}
        onSendQuery={(text) => onSend(text)}
        disabled={isProcessing}
      />

      <button
        type="button"
        onClick={() => onSend(inputQuery)}
        disabled={isProcessing || !inputQuery.trim()}
        style={{
          width: '76px',
          height: '42px',
          padding: 0,
          borderRadius: '9px',
          backgroundColor: isProcessing || !inputQuery.trim()
            ? 'var(--text-disabled, #A7B0BE)'
            : '#2563EB',
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 600,
          border: 'none',
          cursor: isProcessing || !inputQuery.trim() ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isProcessing && inputQuery.trim()) {
            e.currentTarget.style.backgroundColor = '#1D4ED8';
          }
        }}
        onMouseLeave={(e) => {
          if (!isProcessing && inputQuery.trim()) {
            e.currentTarget.style.backgroundColor = '#2563EB';
          }
        }}
      >
        {isProcessing ? t('nexus.thinking', 'Thinking...') : t('nexus.send', 'Send')}
      </button>
    </div>
  );
}
