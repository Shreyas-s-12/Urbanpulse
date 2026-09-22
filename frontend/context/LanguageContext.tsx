'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import de from '@/locales/de.json';
import tr from '@/locales/tr.json';
import tl from '@/locales/tl.json';
import hi from '@/locales/hi.json';
import ta from '@/locales/ta.json';
import te from '@/locales/te.json';
import kn from '@/locales/kn.json';
import ml from '@/locales/ml.json';
import pt from '@/locales/pt.json';
import ar from '@/locales/ar.json';
import bn from '@/locales/bn.json';
import mr from '@/locales/mr.json';
import id from '@/locales/id.json';
import ja from '@/locales/ja.json';
import ko from '@/locales/ko.json';
import zh from '@/locales/zh.json';

export type SupportedLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'tr'
  | 'tl'
  | 'hi'
  | 'ta'
  | 'te'
  | 'kn'
  | 'ml'
  | 'pt'
  | 'ar'
  | 'bn'
  | 'mr'
  | 'id'
  | 'ja'
  | 'ko'
  | 'zh';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (keyPath: string, fallback?: string) => string;
  speechLocale: string;
  isRTL: boolean;
}

const dictionaries: Record<SupportedLanguage, any> = {
  en,
  es,
  fr,
  de,
  tr,
  tl,
  hi,
  ta,
  te,
  kn,
  ml,
  pt,
  ar,
  bn,
  mr,
  id,
  ja,
  ko,
  zh,
};

const speechLocales: Record<SupportedLanguage, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  tr: 'tr-TR',
  tl: 'fil-PH',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pt: 'pt-BR',
  ar: 'ar-SA',
  bn: 'bn-IN',
  mr: 'mr-IN',
  id: 'id-ID',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function applyLanguageToDOM(lang: SupportedLanguage) {
  if (typeof document === 'undefined') return;
  const isRTL = lang === 'ar';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('urbanpulse_lang') as SupportedLanguage | null;
      if (stored && stored in dictionaries) {
        setLanguageState(stored);
        applyLanguageToDOM(stored);
      } else {
        applyLanguageToDOM('en');
      }
    } catch {
      applyLanguageToDOM('en');
    }
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    applyLanguageToDOM(lang);
    try {
      localStorage.setItem('urbanpulse_lang', lang);
    } catch {
      // Ignore localStorage access issues
    }
  }, []);

  const t = useCallback(
    (keyPath: string, fallback?: string): string => {
      if (!keyPath) return fallback || '';
      const parts = keyPath.split('.');
      let current = dictionaries[language];

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          current = undefined;
          break;
        }
      }

      if (typeof current === 'string' && current.trim()) {
        return current;
      }

      // Fallback to English dictionary
      let enCurrent = dictionaries.en;
      for (const enPart of parts) {
        if (enCurrent && typeof enCurrent === 'object' && enPart in enCurrent) {
          enCurrent = enCurrent[enPart];
        } else {
          enCurrent = undefined;
          break;
        }
      }

      if (typeof enCurrent === 'string' && enCurrent.trim()) {
        return enCurrent;
      }

      return fallback || '';
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        speechLocale: speechLocales[language] || 'en-US',
        isRTL: language === 'ar',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
