import { create } from 'zustand';

export type AppTheme = 'light' | 'dark' | 'system';
export type FontSize = 'sm' | 'md' | 'lg';
export type DefaultMapMode = 'roadmap' | 'satellite' | 'terrain';

export interface SettingsState {
  // Appearance
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;

  // Accessibility
  reducedMotion: boolean;
  setReducedMotion: (val: boolean) => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  keyboardNav: boolean;
  setKeyboardNav: (val: boolean) => void;

  // Voice
  voiceEnabled: boolean;
  setVoiceEnabled: (val: boolean) => void;
  voiceLanguage: string;
  setVoiceLanguage: (lang: string) => void;
  speechOutput: boolean;
  setSpeechOutput: (val: boolean) => void;

  // Map
  defaultMapMode: DefaultMapMode;
  setDefaultMapMode: (mode: DefaultMapMode) => void;
  defaultRadiusKm: number;
  setDefaultRadiusKm: (radius: number) => void;

  // Init
  initializeFromStorage: () => void;
}

const STORAGE_KEY = 'urbanpulse_settings_v1';

export function resolveEffectiveTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  return theme;
}

export function applyThemeToDOM(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  const effective = resolveEffectiveTheme(theme);
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.style.colorScheme = effective;
  if (document.body) {
    document.body.style.colorScheme = effective;
  }
}

export function applyAccessibilityToDOM(reducedMotion: boolean, highContrast: boolean, fontSize: FontSize) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
  document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
  document.documentElement.setAttribute('data-font-size', fontSize);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'light',
  reducedMotion: false,
  highContrast: false,
  fontSize: 'md',
  keyboardNav: false,
  voiceEnabled: true,
  voiceLanguage: 'en-IN',
  speechOutput: false,
  defaultMapMode: 'roadmap',
  defaultRadiusKm: 25,

  setTheme: (theme: AppTheme) => {
    set({ theme });
    applyThemeToDOM(theme);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, theme }));
    } catch {}
  },

  setReducedMotion: (reducedMotion: boolean) => {
    set({ reducedMotion });
    applyAccessibilityToDOM(reducedMotion, get().highContrast, get().fontSize);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, reducedMotion }));
    } catch {}
  },

  setHighContrast: (highContrast: boolean) => {
    set({ highContrast });
    applyAccessibilityToDOM(get().reducedMotion, highContrast, get().fontSize);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, highContrast }));
    } catch {}
  },

  setFontSize: (fontSize: FontSize) => {
    set({ fontSize });
    applyAccessibilityToDOM(get().reducedMotion, get().highContrast, fontSize);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, fontSize }));
    } catch {}
  },

  setKeyboardNav: (keyboardNav: boolean) => {
    set({ keyboardNav });
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, keyboardNav }));
    } catch {}
  },

  setVoiceEnabled: (voiceEnabled: boolean) => {
    set({ voiceEnabled });
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, voiceEnabled }));
    } catch {}
  },

  setVoiceLanguage: (voiceLanguage: string) => {
    set({ voiceLanguage });
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, voiceLanguage }));
    } catch {}
  },

  setSpeechOutput: (speechOutput: boolean) => {
    set({ speechOutput });
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, speechOutput }));
    } catch {}
  },

  setDefaultMapMode: (defaultMapMode: DefaultMapMode) => {
    set({ defaultMapMode });
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, defaultMapMode }));
    } catch {}
  },

  setDefaultRadiusKm: (defaultRadiusKm: number) => {
    set({ defaultRadiusKm });
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, defaultRadiusKm }));
    } catch {}
  },

  initializeFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set((state) => ({
          ...state,
          theme: data.theme || state.theme,
          reducedMotion: data.reducedMotion ?? state.reducedMotion,
          highContrast: data.highContrast ?? state.highContrast,
          fontSize: data.fontSize || state.fontSize,
          keyboardNav: data.keyboardNav ?? state.keyboardNav,
          voiceEnabled: data.voiceEnabled ?? state.voiceEnabled,
          voiceLanguage: data.voiceLanguage || state.voiceLanguage,
          speechOutput: data.speechOutput ?? state.speechOutput,
          defaultMapMode: data.defaultMapMode || state.defaultMapMode,
          defaultRadiusKm: data.defaultRadiusKm || state.defaultRadiusKm,
        }));
        const currentTheme = data.theme || 'light';
        applyThemeToDOM(currentTheme);
        applyAccessibilityToDOM(data.reducedMotion ?? false, data.highContrast ?? false, data.fontSize || 'md');
      } else {
        applyThemeToDOM('light');
      }

      // Listen for OS theme changes when in 'system' mode
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        if (get().theme === 'system') {
          applyThemeToDOM('system');
        }
      };
      mediaQuery.addEventListener?.('change', handleMediaChange);
    } catch (err) {
      console.warn('[useSettingsStore] Initialization warning:', err);
    }
  },
}));
