import { create } from 'zustand';
import { PulseWireArticle, PulseWireApiResponse, PulseWireCategory } from '@/app/api/pulsewire/route';

export type PulseWireScope = 'GLOBAL' | 'COUNTRY' | 'STATE' | 'CITY' | 'LOCATION';
export type PulseWireStatus = 'IDLE' | 'LOADING' | 'AVAILABLE' | 'EMPTY' | 'ERROR';

export interface FetchNewsOptions {
  scope?: PulseWireScope;
  query?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  category?: string;
}

export interface PulseWireState {
  isOpen: boolean;
  scope: PulseWireScope;
  articles: PulseWireArticle[];
  status: PulseWireStatus;
  error: string | null;
  locationLabel: string;
  searchQuery: string;
  totalCount: number;
  rejectedCount: number;
  lastRetrievedAt: string | null;
  window: { from: string; to: string } | null;

  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setScope: (scope: PulseWireScope) => void;
  setSearchQuery: (query: string) => void;
  fetchNews: (options?: FetchNewsOptions) => Promise<void>;
  retry: () => Promise<void>;
}

let activeAbortController: AbortController | null = null;
let lastFetchOptions: FetchNewsOptions | undefined = undefined;

export function isValidPulseWireArticle(item: any): item is PulseWireArticle {
  if (!item || typeof item !== 'object') return false;
  const title = (item.title || item.headline || '').trim();
  const source = (item.source || item.sourceName || item.source_name || '').trim();
  const url = (item.url || item.articleUrl || item.article_url || '').trim();
  const pubDate = item.publishedAt || item.published_at;

  if (title.length < 4) return false;
  if (!source) return false;
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (url === '#' || /^(javascript|data|vbscript|file):/i.test(url)) return false;
  if (!pubDate) return false;
  return true;
}

export function normalizePulseWireArticle(raw: any, fallbackLocation: string, fallbackScope: string): PulseWireArticle {
  const title = (raw.title || raw.headline || '').trim();
  const source = (raw.source || raw.sourceName || raw.source_name || 'Verified News Wire').trim();
  const url = (raw.url || raw.articleUrl || raw.article_url || '').trim();
  const pubDate = raw.publishedAt || raw.published_at || new Date().toISOString();

  // Normalize category to uppercase
  let cat: PulseWireCategory = 'GENERAL';
  if (raw.category && typeof raw.category === 'string') {
    const uc = raw.category.toUpperCase();
    if (['GENERAL', 'TRAFFIC', 'WEATHER', 'HAZARD', 'CRIME', 'MUNICIPAL', 'CIVIC', 'ECONOMY', 'NATIONAL', 'WORLD'].includes(uc)) {
      cat = uc as PulseWireCategory;
    }
  }

  // Calculate human relative freshness if not provided
  let freshness = raw.freshness;
  if (!freshness) {
    try {
      const diffMs = Date.now() - new Date(pubDate).getTime();
      const diffHrs = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      if (diffHrs === 0) {
        const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        freshness = `${diffMins}m ago`;
      } else {
        freshness = `${diffHrs}h ago`;
      }
    } catch {
      freshness = 'Within 24h';
    }
  }

  return {
    id: raw.id || `pw-${Math.random().toString(36).slice(2, 10)}`,
    title,
    headline: title,
    description: raw.description || raw.summary || `Verified reporting by ${source} on city events.`,
    summary: raw.summary || raw.description || `Verified reporting by ${source} on city events.`,
    source,
    sourceName: source,
    url,
    articleUrl: url,
    imageUrl: raw.imageUrl || raw.image_url,
    publishedAt: pubDate,
    freshness,
    category: cat,
    location: raw.location || fallbackLocation,
    scope: raw.scope || fallbackScope,
  };
}

export const usePulseWireStore = create<PulseWireState>((set, get) => ({
  isOpen: true,
  scope: 'CITY',
  articles: [],
  status: 'IDLE',
  error: null,
  locationLabel: '',
  searchQuery: '',
  totalCount: 0,
  rejectedCount: 0,
  lastRetrievedAt: null,
  window: null,

  setIsOpen: (open: boolean) => set({ isOpen: open }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setScope: (scope: PulseWireScope) => {
    set({ scope });
    get().fetchNews({ scope });
  },
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),

  retry: async () => {
    return get().fetchNews(lastFetchOptions);
  },

  fetchNews: async (options?: FetchNewsOptions) => {
    lastFetchOptions = options;

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
    const category = options?.category;

    // Immediately clear stale articles to prevent showing previous location's news during loading
    set({
      status: 'LOADING',
      error: null,
      articles: [],
      totalCount: 0,
    });

    try {
      const params = new URLSearchParams();
      params.set('scope', targetScope);
      if (query) params.set('query', query);
      if (city) params.set('city', city);
      if (state) params.set('state', state);
      if (country) params.set('country', country);
      if (countryCode) params.set('countryCode', countryCode);
      if (category) params.set('category', category);

      const endpoint = `/api/pulsewire?${params.toString()}`;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PULSEWIRE] Fetching query: location="${city || query || 'global'}", scope="${targetScope}", endpoint="${endpoint}"`);
      }

      const res = await fetch(endpoint, {
        signal: currentSignal,
      });

      if (!res.ok) {
        throw new Error(`PulseWire request failed with HTTP ${res.status}`);
      }

      const data: PulseWireApiResponse = await res.json();

      if (currentSignal.aborted) return;

      const rawArticles = Array.isArray(data.items) ? data.items : (Array.isArray(data.articles) ? data.articles : []);
      const locationLabel = data.locationLabel || city || 'Global';

      // Strict validation & normalization
      const validArticles: PulseWireArticle[] = [];
      let rejected = 0;

      for (const item of rawArticles) {
        if (isValidPulseWireArticle(item)) {
          validArticles.push(normalizePulseWireArticle(item, locationLabel, targetScope));
        } else {
          rejected++;
        }
      }

      // Explicit status determination
      let finalStatus: PulseWireStatus = 'AVAILABLE';
      let errorMsg: string | null = null;

      if (data.status === 'ERROR' || data.error) {
        finalStatus = 'ERROR';
        errorMsg = data.error?.message || 'PulseWire is temporarily unavailable.';
      } else if (validArticles.length === 0) {
        finalStatus = 'EMPTY';
      } else {
        finalStatus = 'AVAILABLE';
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[PULSEWIRE] Response status=${finalStatus}, rawItems=${rawArticles.length}, validItems=${validArticles.length}, rejectedItems=${rejected}`);
      }

      set({
        articles: validArticles,
        status: finalStatus,
        error: errorMsg,
        locationLabel,
        scope: targetScope,
        totalCount: validArticles.length,
        rejectedCount: rejected,
        lastRetrievedAt: data.retrievedAt || new Date().toISOString(),
        window: data.window || null,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[PulseWire Store] Retrieval error:', err);
      set({
        status: 'ERROR',
        error: err?.message || 'PulseWire is temporarily unavailable.',
        articles: [],
        totalCount: 0,
      });
    }
  },
}));
