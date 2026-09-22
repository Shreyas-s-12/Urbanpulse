'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SpeechRecognitionService, SpeechSynthesisService } from './voiceService';
import { useLanguage } from '@/context/LanguageContext';

export type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';

interface VoiceControlProps {
  onTranscript: (text: string) => void;
  onSendQuery?: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceControl({ onTranscript, onSendQuery, disabled }: VoiceControlProps) {
  const { speechLocale, t } = useLanguage();
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionServiceRef = useRef<SpeechRecognitionService | null>(null);

  useEffect(() => {
    recognitionServiceRef.current = new SpeechRecognitionService();
    return () => {
      recognitionServiceRef.current?.stop();
      SpeechSynthesisService.stop();
    };
  }, []);

  const handleToggleListening = () => {
    if (disabled) return;

    if (voiceState === 'LISTENING') {
      recognitionServiceRef.current?.stop();
      setVoiceState('IDLE');
      return;
    }

    setErrorMessage(null);
    setVoiceState('LISTENING');

    const started = recognitionServiceRef.current?.start(
      speechLocale,
      (transcript, isFinal) => {
        onTranscript(transcript);
        if (isFinal && onSendQuery && transcript.trim()) {
          setVoiceState('PROCESSING');
          setTimeout(() => {
            onSendQuery(transcript);
            setVoiceState('IDLE');
          }, 300);
        }
      },
      (error) => {
        setVoiceState('ERROR');
        setErrorMessage(error);
        setTimeout(() => {
          setVoiceState('IDLE');
          setErrorMessage(null);
        }, 3500);
      },
      () => {
        setVoiceState((prev) => (prev === 'LISTENING' ? 'IDLE' : prev));
      }
    );

    if (!started) {
      setVoiceState('ERROR');
      setErrorMessage(t('nexus.micUnavailable', 'Microphone access is unavailable.'));
      setTimeout(() => {
        setVoiceState('IDLE');
        setErrorMessage(null);
      }, 3500);
    }
  };

  const isListening = voiceState === 'LISTENING';
  const isProcessing = voiceState === 'PROCESSING';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleToggleListening}
        disabled={disabled}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        title={
          isListening
            ? t('nexus.listening', 'Listening...')
            : isProcessing
            ? t('nexus.processing', 'Processing...')
            : t('nexus.voiceControl', 'Voice Input')
        }
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: isListening
            ? '#EF4444'
            : isProcessing
            ? '#2563EB'
            : 'var(--nested-metric-bg, #F8FAFC)',
          color: isListening || isProcessing ? '#FFFFFF' : 'var(--text-secondary, #566174)',
          border: isListening ? '1px solid #DC2626' : '1px solid var(--assistant-card-border, #E2E7EF)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          boxShadow: isListening ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!isListening && !isProcessing && !disabled) {
            e.currentTarget.style.backgroundColor = 'var(--accent-primary-light, #EFF6FF)';
            e.currentTarget.style.borderColor = 'var(--accent-primary, #2563EB)';
            e.currentTarget.style.color = 'var(--accent-primary, #2563EB)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isListening && !isProcessing && !disabled) {
            e.currentTarget.style.backgroundColor = 'var(--nested-metric-bg, #F8FAFC)';
            e.currentTarget.style.borderColor = 'var(--assistant-card-border, #E2E7EF)';
            e.currentTarget.style.color = 'var(--text-secondary, #566174)';
          }
        }}
      >
        {isListening ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* Floating Status / Error Tooltip */}
      {(isListening || errorMessage) && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            whiteSpace: 'nowrap',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '11.5px',
            fontWeight: 600,
            backgroundColor: errorMessage ? '#991B1B' : '#1E293B',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isListening && (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                boxShadow: '0 0 6px #EF4444',
              }}
            />
          )}
          <span>{errorMessage || t('nexus.listening', 'Listening...')}</span>
        </div>
      )}
    </div>
  );
}
