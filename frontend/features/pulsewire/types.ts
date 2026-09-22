export type PulseWireCategory =
  | 'ALL'
  | 'TRAFFIC'
  | 'WEATHER'
  | 'CRIME'
  | 'HAZARD'
  | 'MUNICIPAL'
  | 'CIVIC'
  | 'ECONOMY'
  | 'NATIONAL'
  | 'WORLD'
  | 'GENERAL';

export interface PulseWireArticle {
  id: string;
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  imageUrl?: string;
  // Non-breaking helper aliases for backwards compatibility with any other callers
  headline?: string;
  summary?: string;
  sourceName?: string;
  articleUrl?: string;
  freshness?: string;
  location?: string;
  scope?: string;
}

export interface PulseWireLocationInfo {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface PulseWireTimeWindow {
  from: string;
  to: string;
}

export interface PulseWireErrorDetail {
  code?: string;
  message: string;
}

export interface PulseWireApiResponse {
  status: 'AVAILABLE' | 'EMPTY' | 'ERROR';
  scope?: string;
  location: PulseWireLocationInfo;
  locationLabel?: string;
  window: PulseWireTimeWindow;
  count: number;
  totalCount: number;
  total_count?: number;
  articles: PulseWireArticle[];
  items: PulseWireArticle[];
  retrievedAt: string;
  error?: PulseWireErrorDetail | null;
}

export function isValidHttpUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#' || trimmed === 'null' || trimmed === 'undefined') return false;
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidArticle(item: any): item is PulseWireArticle {
  if (!item || typeof item !== 'object') return false;
  const title = (item.title || item.headline || '').trim();
  const url = (item.url || item.articleUrl || item.article_url || '').trim();
  const source = (item.source || item.sourceName || item.source_name || '').trim();
  const publishedAt = item.publishedAt || item.published_at;

  if (!title || title.length < 4) return false;
  if (!url || !isValidHttpUrl(url)) return false;
  if (!source) return false;
  if (!publishedAt) return false;

  const time = new Date(publishedAt).getTime();
  if (isNaN(time)) return false;

  return true;
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return 'Recent';
    const diffMs = Math.max(0, now - time);
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return 'Recent';
  }
}
