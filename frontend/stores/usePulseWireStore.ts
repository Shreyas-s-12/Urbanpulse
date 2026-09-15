import { create } from 'zustand';
import { PulseWireArticle, PulseWireApiResponse } from '@/app/api/pulsewire/route';

export type PulseWireScope = 'GLOBAL' | 'COUNTRY' | 'STATE' | 'CITY' | 'LOCATION';

interface FetchNewsOptions {
  scope?: PulseWireScope;
  query?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
}

interface PulseWireState {
  isOpen: boolean;
  scope: PulseWireScope;
  articles: PulseWireArticle[];
  status: 'IDLE' | 'LOADING' | 'AVAILABLE' | 'NO_COVERAGE' | 'ERROR';
  locationLabel: string;
  searchQuery: string;
  lastRetrievedAt: string | null;

  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setScope: (scope: PulseWireScope) => void;
  setSearchQuery: (query: string) => void;
  fetchNews: (options?: FetchNewsOptions) => Promise<void>;
}

let activeAbortController: AbortController | null = null;

export const usePulseWireStore = create<PulseWireState>((set, get) => ({
  isOpen: true,
  scope: 'CITY',
  articles: [],
  status: 'IDLE',
  locationLabel: '',
  searchQuery: '',
  lastRetrievedAt: null,

  setIsOpen: (open: boolean) => set({ isOpen: open }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setScope: (scope: PulseWireScope) => {
    set({ scope });
    get().fetchNews({ scope });
  },
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  fetchNews: async (options?: FetchNewsOptions) => {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const currentSignal = activeAbortController.signal;

    const targetScope = options?.scope || get().scope;
    const query = options?.query ?? get().searchQuery;
    const city = options?.city;
    const state = options?.state;
    const country = options?.country;
    const countryCode = options?.countryCode;

    set({ status: 'LOADING' });

    try {
      const params = new URLSearchParams();
      params.set('scope', targetScope);
      if (query) params.set('query', query);
      if (city) params.set('city', city);
      if (state) params.set('state', state);
      if (country) params.set('country', country);
      if (countryCode) params.set('countryCode', countryCode);

      const res = await fetch(`/api/pulsewire?${params.toString()}`, {
        signal: currentSignal,
      });

      if (!res.ok) {
        throw new Error(`PulseWire request failed: ${res.status}`);
      }

      const data: PulseWireApiResponse = await res.json();

      // Ensure request has not been superseded
      if (currentSignal.aborted) return;

      set({
        articles: data.articles || [],
        status: data.status === 'AVAILABLE' ? 'AVAILABLE' : 'NO_COVERAGE',
        locationLabel: data.locationLabel,
        scope: targetScope,
        lastRetrievedAt: data.retrievedAt,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[PulseWire Store] Error:', err);
      set({ status: 'NO_COVERAGE', articles: [] });
    }
  },
}));
