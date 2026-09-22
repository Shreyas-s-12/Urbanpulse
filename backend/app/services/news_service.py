"""
UrbanPulse 24-Hour Location-Based News & PulseWire Provider Service.
Retrieves real-world syndicated news feeds across any city worldwide,
strictly enforces a 24-hour UTC publication window (publishedAt >= now - 24h),
decodes real publisher destination URLs, sorts newest first,
and emits explicit terminal statuses (AVAILABLE, EMPTY, ERROR).
"""

import re
import html
import asyncio
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Any
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import httpx
try:
    from googlenewsdecoder import gnews_decoder_async
except ImportError:
    gnews_decoder_async = None

from app.schemas.news_schema import (
    PulseWireArticleItem,
    PulseWireResponse,
    PulseWireErrorDetail,
    PulseWireTimeWindow,
    PulseWireLocationInfo,
)

logger = logging.getLogger("urbanpulse.news")

# 3-minute in-memory cache for news responses
_NEWS_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TTL_SECONDS = 180

# In-memory decoded destination URL cache
_URL_CACHE: Dict[str, str] = {}


def _clean_html(raw: str) -> str:
    if not raw:
        return ""
    text = html.unescape(raw)
    text = html.unescape(text)

    # Strip HTML tags
    text = re.sub(r"<[^>]*>", " ", text)
    # Strip residual entity encodings
    text = re.sub(r"&[a-zA-Z0-9#]+;", " ", text)
    # Strip naked URLs
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"www\.\S+", "", text)
    # Strip href and markup artifacts
    text = re.sub(r"\bhref\s*=\s*[\"'][^\"']*[\"']", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bread\s+article\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bread\s+more\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bknow\s+more\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bread\s+report\b", "", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


def _sanitize_url(raw_url: str) -> str:
    if not raw_url or not isinstance(raw_url, str):
        return ""
    trimmed = raw_url.strip()
    trimmed = html.unescape(trimmed)

    if re.match(r"^(javascript|data|vbscript|file):", trimmed, flags=re.IGNORECASE):
        return ""
    if not re.match(r"^https?://", trimmed, flags=re.IGNORECASE):
        return ""

    try:
        parsed = urlparse(trimmed)
        if parsed.scheme not in ("http", "https"):
            return ""

        tracking_params = {
            "utm_source", "utm_medium", "utm_campaign", "utm_term",
            "utm_content", "fbclid", "gclid", "_ga", "_gl"
        }
        query_dict = parse_qs(parsed.query, keep_blank_values=True)
        filtered_query = {k: v for k, v in query_dict.items() if k.lower() not in tracking_params}
        new_query = urlencode(filtered_query, doseq=True)

        return urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        ))
    except Exception:
        if re.match(r"^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]+$", trimmed):
            return trimmed
        return ""


def _parse_pub_date(pub_date_raw: str) -> Optional[datetime]:
    if not pub_date_raw:
        return None
    cleaned = pub_date_raw.strip()

    # Try RFC 2822
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %Z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            dt = datetime.strptime(cleaned[:25].strip(), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue

    try:
        dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _compute_freshness(dt: datetime, now_utc: datetime) -> str:
    try:
        diff_seconds = max(0, int((now_utc - dt).total_seconds()))
        diff_mins = diff_seconds // 60
        if diff_mins < 1:
            return "Just now"
        if diff_mins < 60:
            return f"{diff_mins}m ago"
        diff_hours = diff_mins // 60
        if diff_hours < 24:
            return f"{diff_hours}h ago"
        diff_days = diff_hours // 24
        return f"{diff_days}d ago"
    except Exception:
        return "Recent"


def _detect_category(text: str) -> str:
    lower = text.lower()
    if re.search(r"\b(traffic|highway|road|transit|metro|train|bus|commute|jam|expressway|corridor|pothole|delay|diversion|flyover)\b", lower):
        return "TRAFFIC"
    if re.search(r"\b(weather|rain|flood|monsoon|storm|cyclone|heatwave|temperature|forecast|aqi|air quality|pollution|smog|deluge|precipitation)\b", lower):
        return "WEATHER"
    if re.search(r"\b(hazard|disaster|fire|collapse|blast|chemical|spill|leak|emergency|evacuation|earthquake|landslide|blaze)\b", lower):
        return "HAZARD"
    if re.search(r"\b(police|crime|theft|robbery|murder|fraud|racket|arrest|seizure|contraband|assault|investigation|scam|court|drugs)\b", lower):
        return "CRIME"
    if re.search(r"\b(civic|water supply|drainage|sewage|corporation|municipality|ward|power outage|electricity|waste|garbage|bbmp|property tax)\b", lower):
        return "MUNICIPAL"
    if re.search(r"\b(economy|market|business|inflation|jobs|trade|tax|industry|startup|investment|commercial|finance)\b", lower):
        return "ECONOMY"
    if re.search(r"\b(parliament|minister|government|supreme court|assembly|election|policy|national|cabinet)\b", lower):
        return "NATIONAL"
    if re.search(r"\b(global|un|summit|treaty|international|diplomat|world|geopolitical)\b", lower):
        return "WORLD"
    return "GENERAL"


def _tokenize(text: str) -> Set[str]:
    words = re.sub(r"[^a-z0-9\s]", "", text.lower()).split()
    return {w for w in words if len(w) > 3}


def _token_jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    intersection = len(a.intersection(b))
    union = len(a.union(b))
    return intersection / union if union > 0 else 0.0


async def _resolve_real_url(google_url: str) -> str:
    """Decodes Google News RSS redirect link to authentic publisher destination article URL."""
    if not google_url:
        return ""
    if "news.google.com/rss/articles/" not in google_url and "news.google.com/articles/" not in google_url:
        return _sanitize_url(google_url)

    if gnews_decoder_async:
        try:
            # Timeout guard: 2.0s max per article decode
            decode_res = await asyncio.wait_for(gnews_decoder_async(google_url), timeout=2.0)
            if isinstance(decode_res, dict) and decode_res.get("success") and decode_res.get("decoded_url"):
                real_url = decode_res["decoded_url"].strip()
                if real_url.startswith("http"):
                    return _sanitize_url(real_url)
        except Exception:
            pass

    return _sanitize_url(google_url)


class NewsService:
    """Enterprise 24-hour location-based news engine for UrbanPulse."""

    @classmethod
    async def get_pulsewire(
        cls,
        scope: str = "CITY",
        query: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        country_code: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 25,
    ) -> PulseWireResponse:
        clean_scope = (scope or "CITY").strip().upper()
        clean_query = (query or "").strip()
        clean_city = (city or "").strip()
        clean_state = (state or "").strip()
        clean_country = (country or "").strip()
        clean_country_code = (country_code or "").strip().upper()
        clean_category = (category or "").strip().upper() if category else None

        # 24-Hour Time Window in UTC
        now_utc = datetime.now(timezone.utc)
        cutoff_utc = now_utc - timedelta(hours=24)
        time_window = PulseWireTimeWindow(
            from_=cutoff_utc.isoformat(),
            to=now_utc.isoformat(),
        )

        target_location_name = clean_city or clean_query or ("India" if clean_scope == "COUNTRY" else "Worldwide")

        cache_key = f"{clean_scope}|{clean_query}|{clean_city}|{clean_state}|{clean_country}|{clean_country_code}|{clean_category}"
        now_ts = now_utc.timestamp()

        # Check Cache
        cached = _NEWS_CACHE.get(cache_key)
        if cached and (now_ts - cached["timestamp"]) < _CACHE_TTL_SECONDS:
            cached_data = cached["data"]
            has_undecoded = any("news.google.com" in (a.url or "") for a in cached_data.articles[:3])
            if not has_undecoded:
                logger.info(f"[PULSEWIRE] Serving cached 24h news for {cache_key}")
                return cached_data

        feed_url, location_label = cls._build_feed_url(
            scope=clean_scope,
            query=clean_query,
            city=clean_city,
            state=clean_state,
            country=clean_country,
            country_code=clean_country_code,
        )

        logger.info(f"[PULSEWIRE] 24H Feed URL: {feed_url} for location: {location_label}")

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 UrbanPulse/1.0",
                "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.get(feed_url, headers=headers)

            if res.status_code != 200:
                logger.error(f"[PULSEWIRE] Feed returned HTTP {res.status_code}")
                return PulseWireResponse(
                    status="ERROR",
                    location=PulseWireLocationInfo(name=location_label),
                    window=time_window,
                    count=0,
                    total_count=0,
                    articles=[],
                    items=[],
                    retrieved_at=now_utc.isoformat(),
                    error=PulseWireErrorDetail(
                        code="PROVIDER_HTTP_ERROR",
                        message=f"News provider returned status code {res.status_code}",
                    ),
                )

            xml_text = res.text
            raw_candidates = cls._extract_raw_candidates(
                xml_text=xml_text,
                location_label=location_label,
                scope=clean_scope,
                cutoff_utc=cutoff_utc,
                now_utc=now_utc,
            )

            # Concurrently decode real publisher destination URLs
            articles = await cls._decode_and_validate_articles(
                candidates=raw_candidates,
                category_filter=clean_category,
                limit=limit,
            )

            # Sort newest first (publishedAt DESC)
            articles.sort(key=lambda x: x.published_at, reverse=True)

            count = len(articles)
            status = "AVAILABLE" if count > 0 else "EMPTY"

            response = PulseWireResponse(
                status=status,
                location=PulseWireLocationInfo(name=location_label),
                window=time_window,
                count=count,
                total_count=count,
                articles=articles,
                items=articles,
                retrieved_at=now_utc.isoformat(),
                error=None,
            )

            _NEWS_CACHE[cache_key] = {"timestamp": now_ts, "data": response}
            return response

        except httpx.TimeoutException as ex:
            logger.warning(f"[PULSEWIRE] News provider timeout: {ex}")
            return PulseWireResponse(
                status="ERROR",
                location=PulseWireLocationInfo(name=location_label),
                window=time_window,
                count=0,
                total_count=0,
                articles=[],
                items=[],
                retrieved_at=now_utc.isoformat(),
                error=PulseWireErrorDetail(
                    code="PROVIDER_TIMEOUT",
                    message="News provider connection timed out. All other intelligence systems remain active.",
                ),
            )
        except Exception as ex:
            logger.exception(f"[PULSEWIRE] News provider error: {ex}")
            return PulseWireResponse(
                status="ERROR",
                location=PulseWireLocationInfo(name=location_label),
                window=time_window,
                count=0,
                total_count=0,
                articles=[],
                items=[],
                retrieved_at=now_utc.isoformat(),
                error=PulseWireErrorDetail(
                    code="PROVIDER_UNAVAILABLE",
                    message=f"Failed to retrieve 24-hour news: {str(ex)}",
                ),
            )

    @classmethod
    def _build_feed_url(
        cls,
        scope: str,
        query: str,
        city: str,
        state: str,
        country: str,
        country_code: str,
    ) -> tuple[str, str]:
        if scope == "GLOBAL":
            return (
                "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
                "Worldwide",
            )
        if scope == "COUNTRY":
            is_india = country.lower() == "india" or country_code == "IN"
            if is_india:
                return (
                    "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
                    "India",
                )
            target_country = country or "World"
            return (
                f"https://news.google.com/rss/search?q={target_country}+when:24h&hl=en-US&gl=US&ceid=US:en",
                target_country,
            )
        if scope == "STATE":
            target_state = state or query or "Karnataka"
            return (
                f"https://news.google.com/rss/search?q={target_state}+when:24h&hl=en-IN&gl=IN&ceid=IN:en",
                target_state,
            )
        # Default: CITY or SPECIFIC LOCATION
        target_city = city or query or "Bengaluru"
        is_indian = (
            country_code == "IN"
            or country.lower() == "india"
            or target_city.lower() in ("bengaluru", "bangalore", "mysuru", "delhi", "mumbai", "chennai", "hyderabad", "kolkata", "pune")
        )
        region = "&hl=en-IN&gl=IN&ceid=IN:en" if is_indian else "&hl=en-US&gl=US&ceid=US:en"
        return (
            f"https://news.google.com/rss/search?q={target_city}+when:24h{region}",
            target_city,
        )

    @classmethod
    def _extract_raw_candidates(
        cls,
        xml_text: str,
        location_label: str,
        scope: str,
        cutoff_utc: datetime,
        now_utc: datetime,
    ) -> List[Dict[str, Any]]:
        item_matches = re.findall(r"<item>([\s\S]*?)</item>", xml_text)
        candidates: List[Dict[str, Any]] = []
        seen_tokens: List[Set[str]] = []

        for raw_item in item_matches:
            # 1. Headline
            title_m = re.search(r"<title>([\s\S]*?)</title>", raw_item)
            if not title_m:
                continue
            raw_title = _clean_html(title_m.group(1))
            if len(raw_title) < 5:
                continue

            # 2. Publisher source & Source URL
            source = "Verified News Wire"
            last_dash = raw_title.rfind(" - ")
            if last_dash != -1 and last_dash > 10:
                candidate_src = raw_title[last_dash + 3:].strip()
                if candidate_src:
                    source = candidate_src
                raw_title = raw_title[:last_dash].strip()

            source_url = None
            source_tag_m = re.search(r'<source(?:\s+url=["\']([^"\']+)["\'])?[^>]*>([\s\S]*?)</source>', raw_item)
            if source_tag_m:
                if source_tag_m.group(1):
                    source_url = _sanitize_url(source_tag_m.group(1))
                if source_tag_m.group(2):
                    clean_src = _clean_html(source_tag_m.group(2))
                    if clean_src:
                        source = clean_src

            # 3. Publication Date — Strict 24-Hour Window Filter
            pub_date_m = re.search(r"<pubDate>([\s\S]*?)</pubDate>", raw_item)
            pub_date_raw = pub_date_m.group(1).strip() if pub_date_m else ""
            dt = _parse_pub_date(pub_date_raw)

            # Strict 24-hour window filter: reject if published earlier than now - 24h
            if dt is None:
                continue
            if dt < cutoff_utc or dt > (now_utc + timedelta(minutes=10)):
                continue

            # 4. Raw link
            raw_link = ""
            link_m = re.search(r"<link>([\s\S]*?)</link>", raw_item)
            if link_m and link_m.group(1):
                raw_link = link_m.group(1).strip()
            if not raw_link or not raw_link.startswith("http"):
                a_m = re.search(r'<a\s+(?:[^>]*?\s+)?href=["\'](https?://[^"\']+)["\']', raw_item, flags=re.IGNORECASE)
                if a_m:
                    raw_link = a_m.group(1).strip()

            if not raw_link or not raw_link.startswith("http"):
                continue

            # 5. Description / Summary
            desc_m = re.search(r"<description>([\s\S]*?)</description>", raw_item)
            raw_desc = _clean_html(desc_m.group(1)) if desc_m else ""
            if not raw_desc or raw_desc.lower() == raw_title.lower() or raw_desc.lower().startswith(raw_title.lower()[:30]):
                summary = f"Verified reporting by {source} on civic and urban developments in {location_label}."
            else:
                summary = raw_desc[:240] + ("..." if len(raw_desc) > 240 else "")

            # 6. Deduplication by Jaccard similarity (>0.55 similarity rejected)
            item_tokens = _tokenize(raw_title)
            is_dup = False
            for past_tokens in seen_tokens:
                if _token_jaccard(item_tokens, past_tokens) > 0.55:
                    is_dup = True
                    break
            if is_dup:
                continue
            seen_tokens.append(item_tokens)

            candidates.append({
                "title": raw_title,
                "raw_link": raw_link,
                "source": source,
                "source_url": source_url,
                "dt": dt,
                "summary": summary,
                "location_label": location_label,
                "scope": scope,
            })

        return candidates

    @classmethod
    async def _decode_and_validate_articles(
        cls,
        candidates: List[Dict[str, Any]],
        category_filter: Optional[str],
        limit: int,
    ) -> List[PulseWireArticleItem]:
        if not candidates:
            return []

        # Limit candidates directly to the requested limit to ensure fast response times
        candidate_slice = candidates[:min(len(candidates), limit)]

        # Batch decode real destination URLs using googlenewsdecoder with connection pooling
        candidate_urls = [c["raw_link"] for c in candidate_slice if c.get("raw_link")]
        missing_urls = [u for u in candidate_urls if u not in _URL_CACHE and ("news.google.com" in u)]

        if missing_urls and gnews_decoder_async:
            try:
                batch_results = await asyncio.wait_for(
                    gnews_decoder_async(missing_urls, concurrency=10, timeout=8.0),
                    timeout=10.0,
                )
                if isinstance(batch_results, list):
                    for u, r in zip(missing_urls, batch_results):
                        if isinstance(r, dict) and r.get("success") and r.get("decoded_url"):
                            decoded = r["decoded_url"].strip()
                            if decoded.startswith("http"):
                                _URL_CACHE[u] = decoded
            except Exception as e:
                logger.warning(f"[PULSEWIRE] Batch decode warning: {e}")

        now_utc = datetime.now(timezone.utc)
        validated_articles: List[PulseWireArticleItem] = []

        for cand in candidate_slice:
            if len(validated_articles) >= limit:
                break

            raw_url = cand["raw_link"]
            resolved_url = _URL_CACHE.get(raw_url) or raw_url
            final_url = _sanitize_url(resolved_url) if resolved_url else ""

            # Strict URL requirement: Must have a valid external URL
            if not final_url or not final_url.startswith("http"):
                continue

            detected_cat = _detect_category(cand["title"] + " " + cand["summary"])
            if category_filter and category_filter != "ALL" and detected_cat != category_filter:
                continue

            freshness = _compute_freshness(cand["dt"], now_utc)
            art_id = "pw-" + hashlib.md5((cand["title"] + final_url).encode("utf-8")).hexdigest()[:12]

            validated_articles.append(
                PulseWireArticleItem(
                    id=art_id,
                    title=cand["title"],
                    headline=cand["title"],
                    description=cand["summary"],
                    summary=cand["summary"],
                    url=final_url,
                    article_url=final_url,
                    source=cand["source"],
                    source_name=cand["source"],
                    source_url=cand["source_url"],
                    published_at=cand["dt"].isoformat(),
                    freshness=freshness,
                    category=detected_cat,
                    image_url=None,
                    location=cand["location_label"],
                    scope=cand["scope"],
                )
            )

        return validated_articles
