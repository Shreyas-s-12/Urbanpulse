import { NextRequest, NextResponse } from 'next/server';

export interface PulseWireArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  freshness: string;
  category: 'Traffic' | 'Civic' | 'Weather' | 'Public Safety' | 'Economy' | 'National' | 'World' | 'General';
  location: string;
  url: string;
  scope: string;
}

export interface PulseWireApiResponse {
  scope: string;
  locationLabel: string;
  status: 'AVAILABLE' | 'NO_COVERAGE' | 'ERROR';
  articles: PulseWireArticle[];
  retrievedAt: string;
}

// In-memory short-lived cache (3 minutes TTL)
interface CacheEntry {
  timestamp: number;
  data: PulseWireApiResponse;
}
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000;

function computeFreshness(dateStr: string): string {
  try {
    const pub = new Date(dateStr).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - pub);
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recent';
  }
}

function detectCategory(text: string): PulseWireArticle['category'] {
  const lower = text.toLowerCase();
  if (lower.match(/\b(traffic|highway|road|transit|metro|train|bus|commute|jam|expressway|delay)\b/)) {
    return 'Traffic';
  }
  if (lower.match(/\b(weather|rain|flood|monsoon|storm|cyclone|heatwave|temperature|forecast|aqi|air quality|pollution)\b/)) {
    return 'Weather';
  }
  if (lower.match(/\b(police|crime|accident|crash|fire|rescue|hazard|safety|arrest|emergency)\b/)) {
    return 'Public Safety';
  }
  if (lower.match(/\b(civic|water|drain|municipality|corporation|ward|pothole|power|electricity|urban)\b/)) {
    return 'Civic';
  }
  if (lower.match(/\b(economy|market|business|inflation|jobs|industry|tech|investment)\b/)) {
    return 'Economy';
  }
  if (lower.match(/\b(election|parliament|minister|government|supreme court|policy|national)\b/)) {
    return 'National';
  }
  if (lower.match(/\b(un|global|summit|treaty|international|diplomat|world)\b/)) {
    return 'World';
  }
  return 'General';
}

function cleanHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  return new Set(words);
}

function tokenJaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach(token => {
    if (b.has(token)) intersection++;
  });
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get('scope') || 'GLOBAL').toUpperCase();
  const query = (searchParams.get('query') || '').trim();
  const city = (searchParams.get('city') || '').trim();
  const state = (searchParams.get('state') || '').trim();
  const country = (searchParams.get('country') || '').trim();
  const countryCode = (searchParams.get('countryCode') || '').trim().toUpperCase();

  const cacheKey = `${scope}|${query}|${city}|${state}|${country}|${countryCode}`;
  const now = Date.now();
  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // Construct target feed URL based on dynamic geographic scope
  let feedUrl = '';
  let locationLabel = 'Global';

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
    // CITY or LOCATION
    const targetCity = city || query || 'Bengaluru';
    const isIndianSub = countryCode === 'IN' || country.toLowerCase() === 'india' || ['mysuru', 'bengaluru', 'bangalore', 'delhi', 'mumbai', 'chennai', 'hyderabad'].includes(targetCity.toLowerCase());
    const regionParam = isIndianSub ? '&hl=en-IN&gl=IN&ceid=IN:en' : '&hl=en-US&gl=US&ceid=US:en';
    feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(targetCity)}+when:24h${regionParam}`;
    locationLabel = targetCity;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UrbanPulse/1.0; +https://urbanpulse.ai)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      next: { revalidate: 180 },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Feed response status: ${res.status}`);
    }

    const xmlText = await res.text();
    const items: PulseWireArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    const seenTokens: { tokens: Set<string>; id: string }[] = [];

    while ((match = itemRegex.exec(xmlText)) !== null && items.length < 25) {
      const itemContent = match[1];

      // Extract title
      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      let rawTitle = titleMatch ? cleanHtml(titleMatch[1]) : '';

      // Google News puts " - Source" at the end of the title
      let source = 'News Desk';
      const lastDash = rawTitle.lastIndexOf(' - ');
      if (lastDash !== -1) {
        source = rawTitle.slice(lastDash + 3).trim();
        rawTitle = rawTitle.slice(0, lastDash).trim();
      }

      // Extract explicit source tag if present
      const sourceTagMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      if (sourceTagMatch && sourceTagMatch[1]) {
        source = cleanHtml(sourceTagMatch[1]);
      }

      // Extract link
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const url = linkMatch ? cleanHtml(linkMatch[1]) : '';

      // Extract pubDate
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();

      // Extract description / summary
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
      let summary = descMatch ? cleanHtml(descMatch[1]) : '';
      if (summary.length > 220) {
        summary = summary.slice(0, 217) + '...';
      }

      if (!rawTitle) continue;

      // Deduplication by token overlap (>0.55 Jaccard similarity = duplicate syndicated story)
      const currentTokens = tokenize(rawTitle);
      let isDuplicate = false;
      for (const seen of seenTokens) {
        if (tokenJaccardSimilarity(currentTokens, seen.tokens) > 0.55) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) continue;

      seenTokens.push({ tokens: currentTokens, id: url || rawTitle });

      const category = detectCategory(rawTitle + ' ' + summary);
      const freshness = computeFreshness(pubDateStr);

      items.push({
        id: `pw-${items.length}-${Buffer.from(rawTitle.slice(0, 20)).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`,
        headline: rawTitle,
        summary: summary || `Verified report from ${source}.`,
        source,
        publishedAt: new Date(pubDateStr).toISOString(),
        freshness,
        category,
        location: locationLabel,
        url,
        scope,
      });
    }

    const payload: PulseWireApiResponse = {
      scope,
      locationLabel,
      status: items.length > 0 ? 'AVAILABLE' : 'NO_COVERAGE',
      articles: items,
      retrievedAt: new Date().toISOString(),
    };

    CACHE.set(cacheKey, { timestamp: now, data: payload });
    return NextResponse.json(payload);
  } catch (err: any) {
    console.warn('[PulseWire] Feed retrieval error:', err?.message || err);
    // Return graceful empty/error payload, never fake data
    const errorPayload: PulseWireApiResponse = {
      scope,
      locationLabel,
      status: 'NO_COVERAGE',
      articles: [],
      retrievedAt: new Date().toISOString(),
    };
    return NextResponse.json(errorPayload);
  }
}
