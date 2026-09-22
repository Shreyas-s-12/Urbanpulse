import { NextRequest, NextResponse } from 'next/server';

export type PulseWireCategory =
  | 'GENERAL'
  | 'TRAFFIC'
  | 'WEATHER'
  | 'HAZARD'
  | 'CRIME'
  | 'MUNICIPAL'
  | 'CIVIC'
  | 'ECONOMY'
  | 'NATIONAL'
  | 'WORLD';

export interface PulseWireArticle {
  id: string;
  title: string;
  headline: string;
  description?: string;
  summary: string;
  source: string;
  sourceName: string;
  sourceUrl?: string;
  url: string;
  articleUrl: string;
  imageUrl?: string;
  publishedAt: string;
  freshness: string;
  category: PulseWireCategory;
  location: string;
  scope: string;
}

export interface PulseWireErrorDetail {
  code: string;
  message: string;
}

export interface PulseWireTimeWindow {
  from: string;
  to: string;
}

export interface PulseWireLocationInfo {
  name: string;
}

export interface PulseWireApiResponse {
  status: 'AVAILABLE' | 'EMPTY' | 'ERROR';
  location: PulseWireLocationInfo;
  locationLabel: string;
  window: PulseWireTimeWindow;
  scope: string;
  count: number;
  totalCount: number;
  total_count: number;
  articles: PulseWireArticle[];
  items: PulseWireArticle[];
  retrievedAt: string;
  error?: PulseWireErrorDetail | null;
}

function sanitizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();

  trimmed = trimmed
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return '';
  if (!/^https?:\/\//i.test(trimmed)) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';

    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      '_ga',
      '_gl',
    ];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));

    return parsed.toString();
  } catch {
    if (/^https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }
}

function parsePubDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function computeFreshness(date: Date, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - date.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function detectCategory(text: string): PulseWireCategory {
  const lower = text.toLowerCase();
  if (lower.match(/\b(traffic|highway|road|transit|metro|train|bus|commute|jam|expressway|corridor|pothole|delay|diversion|flyover)\b/)) {
    return 'TRAFFIC';
  }
  if (lower.match(/\b(weather|rain|flood|monsoon|storm|cyclone|heatwave|temperature|forecast|aqi|air quality|pollution|smog|deluge|precipitation)\b/)) {
    return 'WEATHER';
  }
  if (lower.match(/\b(hazard|disaster|fire|collapse|blast|chemical|spill|leak|emergency|evacuation|earthquake|landslide|blaze)\b/)) {
    return 'HAZARD';
  }
  if (lower.match(/\b(police|crime|theft|robbery|murder|fraud|racket|arrest|seizure|contraband|assault|investigation|scam|court|drugs)\b/)) {
    return 'CRIME';
  }
  if (lower.match(/\b(civic|water supply|drainage|sewage|corporation|municipality|ward|power outage|electricity|waste|garbage|bbmp|property tax)\b/)) {
    return 'MUNICIPAL';
  }
  if (lower.match(/\b(economy|market|business|inflation|jobs|trade|tax|industry|startup|investment|commercial|finance)\b/)) {
    return 'ECONOMY';
  }
  if (lower.match(/\b(parliament|minister|government|supreme court|assembly|election|policy|national|cabinet)\b/)) {
    return 'NATIONAL';
  }
  if (lower.match(/\b(global|un|summit|treaty|international|diplomat|world|geopolitical)\b/)) {
    return 'WORLD';
  }
  return 'GENERAL';
}

function cleanHtml(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/&[a-zA-Z0-9#]+;/g, ' ');
  text = text.replace(/https?:\/\/\S+/gi, '');
  text = text.replace(/www\.\S+/gi, '');
  text = text.replace(/\bhref\s*=\s*["'][^"']*["']/gi, '');
  text = text.replace(/\bhref\s*=\s*\S+/gi, '');
  text = text.replace(/\bread\s+article\b/gi, '');
  text = text.replace(/\bread\s+more\b/gi, '');
  text = text.replace(/\bknow\s+more\b/gi, '');
  text = text.replace(/target\s*=\s*["'][^"']*["']/gi, '');

  return text.replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 3);
  return new Set(words);
}

function tokenJaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection++;
  });
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// In-memory cache (3 min TTL)
interface CacheEntry {
  timestamp: number;
  data: PulseWireApiResponse;
}
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get('scope') || 'CITY').toUpperCase();
  const query = (searchParams.get('query') || '').trim();
  const city = (searchParams.get('city') || '').trim();
  const state = (searchParams.get('state') || '').trim();
  const country = (searchParams.get('country') || '').trim();
  const countryCode = (searchParams.get('countryCode') || '').trim().toUpperCase();
  const category = (searchParams.get('category') || '').trim().toUpperCase();

  const cacheKey = `${scope}|${query}|${city}|${state}|${country}|${countryCode}|${category}`;
  const now = Date.now();
  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const defaultWindow: PulseWireTimeWindow = { from: cutoffIso, to: nowIso };

  // 1. Proxy to FastAPI backend (Browser -> UrbanPulse Backend -> Provider)
  const backendBase = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000/api/v1';
  const backendUrl = new URL(`${backendBase}/pulsewire`);
  backendUrl.searchParams.set('scope', scope);
  if (query) backendUrl.searchParams.set('query', query);
  if (city) backendUrl.searchParams.set('city', city);
  if (state) backendUrl.searchParams.set('state', state);
  if (country) backendUrl.searchParams.set('country', country);
  if (countryCode) backendUrl.searchParams.set('country_code', countryCode);
  if (category) backendUrl.searchParams.set('category', category);

  try {
    const backendRes = await fetch(backendUrl.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 180 },
    });

    if (backendRes.ok) {
      const bData = await backendRes.json();
      const rawList = Array.isArray(bData.articles) ? bData.articles : (Array.isArray(bData.items) ? bData.items : []);
      const normalizedArticles: PulseWireArticle[] = [];
      const cutoffMs = now - 24 * 60 * 60 * 1000;

      for (const it of rawList) {
        const title = (it.title || it.headline || '').trim();
        const source = (it.source || it.source_name || it.sourceName || 'Verified News Wire').trim();
        const url = (it.url || it.article_url || it.articleUrl || '').trim();
        const pubDateStr = it.published_at || it.publishedAt;
        const pubDate = parsePubDate(pubDateStr);

        // Strict validation: must have title, source, and valid URL
        if (!title || title.length < 4 || !source || !url || !/^https?:\/\//i.test(url)) {
          continue;
        }

        // Strict 24-hour filter
        if (!pubDate || pubDate.getTime() < cutoffMs) {
          continue;
        }

        const cat: PulseWireCategory = (it.category || 'GENERAL').toUpperCase() as PulseWireCategory;
        const desc = it.description || it.summary || `Verified reporting by ${source} on civic and urban developments.`;

        normalizedArticles.push({
          id: it.id || `pw-${normalizedArticles.length}-${Date.now()}`,
          title,
          headline: title,
          description: desc,
          summary: desc,
          source,
          sourceName: source,
          sourceUrl: it.source_url || it.sourceUrl,
          url,
          articleUrl: url,
          imageUrl: it.image_url || it.imageUrl,
          publishedAt: pubDate.toISOString(),
          freshness: it.freshness || computeFreshness(pubDate, now),
          category: cat,
          location: it.location || bData.location?.name || city || 'Location Context',
          scope: it.scope || scope,
        });
      }

      // Sort newest first
      normalizedArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      const status: 'AVAILABLE' | 'EMPTY' = normalizedArticles.length > 0 ? 'AVAILABLE' : 'EMPTY';
      const locName = bData.location?.name || bData.location_label || city || 'Location';
      const payload: PulseWireApiResponse = {
        status,
        scope: bData.scope || scope,
        location: { name: locName },
        locationLabel: locName,
        window: bData.window ? { from: bData.window.from || bData.window.from_, to: bData.window.to } : defaultWindow,
        count: normalizedArticles.length,
        totalCount: normalizedArticles.length,
        total_count: normalizedArticles.length,
        articles: normalizedArticles,
        items: normalizedArticles,
        retrievedAt: bData.retrieved_at || nowIso,
        error: null,
      };

      CACHE.set(cacheKey, { timestamp: now, data: payload });
      return NextResponse.json(payload);
    }
  } catch (backendErr) {
    console.warn('[PulseWire API Route] Backend offline, falling back to direct feed adapter:', backendErr);
  }

  // 2. Resilient Direct Feed Adapter (Fallback if FastAPI backend is temporarily restarting)
  let feedUrl = '';
  let locationLabel = city || query || 'Global';

  if (scope === 'GLOBAL') {
    feedUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    locationLabel = 'Worldwide';
  } else if (scope === 'COUNTRY') {
    const isIndia = country.toLowerCase() === 'india' || countryCode === 'IN';
    if (isIndia) {
      feedUrl = 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';
      locationLabel = 'India';
    } else {
      const targetCountry = country || 'World';
      feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(targetCountry)}+when:24h&hl=en-US&gl=US&ceid=US:en`;
      locationLabel = targetCountry;
    }
  } else if (scope === 'STATE') {
    const targetState = state || query || 'Karnataka';
    feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(targetState)}+when:24h&hl=en-IN&gl=IN&ceid=IN:en`;
    locationLabel = targetState;
  } else {
    // CITY
    const targetCity = city || query || 'Bengaluru';
    const isIndian = countryCode === 'IN' || country.toLowerCase() === 'india' || ['bengaluru', 'bangalore', 'mysuru', 'delhi', 'mumbai', 'chennai', 'hyderabad', 'kolkata', 'pune'].includes(targetCity.toLowerCase());
    const regionParam = isIndian ? '&hl=en-IN&gl=IN&ceid=IN:en' : '&hl=en-US&gl=US&ceid=US:en';
    feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(targetCity)}+when:24h${regionParam}`;
    locationLabel = targetCity;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 UrbanPulse/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      next: { revalidate: 180 },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Feed HTTP ${res.status}`);
    }

    const xmlText = await res.text();
    const items: PulseWireArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    const seenTokens: { tokens: Set<string>; id: string }[] = [];
    const cutoffMs = now - 24 * 60 * 60 * 1000;

    while ((match = itemRegex.exec(xmlText)) !== null && items.length < 25) {
      const itemContent = match[1];

      // Title
      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      let rawTitle = titleMatch ? cleanHtml(titleMatch[1]) : '';
      if (rawTitle.length < 5) continue;

      let source = 'Verified News Wire';
      const lastDash = rawTitle.lastIndexOf(' - ');
      if (lastDash !== -1 && lastDash > 10) {
        source = rawTitle.slice(lastDash + 3).trim();
        rawTitle = rawTitle.slice(0, lastDash).trim();
      }

      let sourceUrl: string | undefined = undefined;
      const sourceTagMatch = itemContent.match(/<source(?:\s+url=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/source>/);
      if (sourceTagMatch) {
        if (sourceTagMatch[1]) sourceUrl = sanitizeUrl(sourceTagMatch[1]);
        if (sourceTagMatch[2]) {
          const s = cleanHtml(sourceTagMatch[2]);
          if (s) source = s;
        }
      }

      // Link
      let rawLink = '';
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      if (linkMatch && linkMatch[1]) rawLink = linkMatch[1].trim();
      if (!rawLink || !rawLink.startsWith('http')) {
        const aHrefMatch = itemContent.match(/<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["']/i);
        if (aHrefMatch && aHrefMatch[1]) rawLink = aHrefMatch[1].trim();
      }

      const articleUrl = sanitizeUrl(rawLink);
      if (!articleUrl) continue;

      // Publication Date & 24-hour filter
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : '';
      const pubDate = parsePubDate(pubDateStr);
      if (!pubDate || pubDate.getTime() < cutoffMs) continue;

      // Summary
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
      const rawDesc = descMatch ? cleanHtml(descMatch[1]) : '';
      let summary = '';
      if (!rawDesc || rawDesc.toLowerCase() === rawTitle.toLowerCase() || rawDesc.toLowerCase().startsWith(rawTitle.toLowerCase().slice(0, 30))) {
        summary = `Verified reporting by ${source} on civic and urban developments in ${locationLabel}.`;
      } else {
        summary = rawDesc.length > 220 ? rawDesc.slice(0, 217) + '...' : rawDesc;
      }

      // Category
      const detectedCategory = detectCategory(rawTitle + ' ' + summary);
      if (category && category !== 'ALL' && detectedCategory !== category) {
        continue;
      }

      // Deduplication
      const currentTokens = tokenize(rawTitle);
      let isDuplicate = false;
      for (const seen of seenTokens) {
        if (tokenJaccardSimilarity(currentTokens, seen.tokens) > 0.55) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) continue;
      seenTokens.push({ tokens: currentTokens, id: articleUrl });

      const freshness = computeFreshness(pubDate, now);
      const id = `pw-${items.length}-${Buffer.from(rawTitle.slice(0, 16)).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;

      items.push({
        id,
        title: rawTitle,
        headline: rawTitle,
        description: summary,
        summary,
        source,
        sourceName: source,
        sourceUrl,
        publishedAt: pubDate.toISOString(),
        freshness,
        category: detectedCategory,
        location: locationLabel,
        articleUrl,
        url: articleUrl,
        scope,
      });
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    const status: 'AVAILABLE' | 'EMPTY' = items.length > 0 ? 'AVAILABLE' : 'EMPTY';
    const payload: PulseWireApiResponse = {
      status,
      scope,
      location: { name: locationLabel },
      locationLabel,
      window: defaultWindow,
      count: items.length,
      totalCount: items.length,
      total_count: items.length,
      articles: items,
      items,
      retrievedAt: nowIso,
      error: null,
    };

    CACHE.set(cacheKey, { timestamp: now, data: payload });
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[PulseWire] Direct feed error:', err?.message || err);
    const errorPayload: PulseWireApiResponse = {
      status: 'ERROR',
      scope,
      location: { name: locationLabel },
      locationLabel,
      window: defaultWindow,
      count: 0,
      totalCount: 0,
      total_count: 0,
      articles: [],
      items: [],
      retrievedAt: nowIso,
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'PulseWire news provider is currently unreachable. Other city intelligence systems remain fully active.',
      },
    };
    return NextResponse.json(errorPayload, { status: 200 });
  }
}
