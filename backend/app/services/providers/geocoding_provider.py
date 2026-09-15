"""
UrbanPulse Geocoding Provider
Translates geographic coordinates into location context and supports global place/coordinate search.
"""
from typing import Any, Dict, List, Optional
import httpx
import re
import math
from app.core.config import settings
class GeocodingProvider:
    @staticmethod
    async def resolve_timezone(latitude: float, longitude: float) -> str:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m",
            "timezone": "auto",
        }
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(settings.OPENMETEO_API_URL, params=params)
                if res.status_code == 200:
                    timezone_name = res.json().get("timezone")
                    if timezone_name:
                        return timezone_name
        except Exception:
            pass
        return "UTC"
    @staticmethod
    async def reverse_geocode(latitude: float, longitude: float, accuracy: Optional[float] = None) -> Dict[str, Any]:
        """
        Reverse geocodes coordinates to country, region/state, district, city, and timezone.
        Works globally for any latitude/longitude including rural or offshore coordinates.
        """
        url = "https://nominatim.openstreetmap.org/reverse"
        headers = {
            "User-Agent": settings.NOMINATIM_USER_AGENT,
            "Accept-Language": "en, *;q=0.5",
        }
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
        }
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, params=params, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    addr = data.get("address", {})
                    city = (
                        addr.get("city")
                        or addr.get("town")
                        or addr.get("village")
                        or addr.get("municipality")
                        or addr.get("suburb")
                        or addr.get("hamlet")
                        or addr.get("locality")
                        or None
                    )
                    district = addr.get("county") or addr.get("state_district") or None
                    state = addr.get("state") or addr.get("province") or None
                    region = state
                    country = addr.get("country") or None
                    country_code = addr.get("country_code", "").upper() or None
                    region_code = addr.get("ISO3166-2-lvl4") or None
                    display_name = data.get("display_name")
                    if not display_name:
                        parts = [p for p in [city, state, country] if p]
                        display_name = ", ".join(parts) if parts else f"{latitude:.4f}°, {longitude:.4f}°"
                    timezone_name = await GeocodingProvider.resolve_timezone(latitude, longitude)
                    return {
                        "latitude": latitude,
                        "longitude": longitude,
                        "accuracy": accuracy,
                        "city": city,
                        "district": district,
                        "state": state,
                        "region": region,
                        "country": country,
                        "countryCode": country_code,
                        "regionCode": region_code,
                        "timezone": timezone_name,
                        "displayName": display_name,
                        "isUserLocation": True,
                    }
        except Exception:
            pass
        # Fallback coordinate representation (e.g. offshore or offline)
        return {
            "latitude": latitude,
            "longitude": longitude,
            "accuracy": accuracy,
            "city": None,
            "district": None,
            "state": None,
            "region": None,
            "country": None,
            "countryCode": None,
            "regionCode": None,
            "timezone": await GeocodingProvider.resolve_timezone(latitude, longitude),
            "displayName": f"Coordinates ({latitude:.4f}, {longitude:.4f})",
            "isUserLocation": True,
        }
    @staticmethod
    @staticmethod
    def _haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
        return 2.0 * r * math.asin(math.sqrt(max(0.0, min(1.0, a))))
    @staticmethod
    async def geocode(
        query: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        country_code: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Geocodes a single location query string to a location context dict.
        """
        results = await GeocodingProvider.search(query, lat=lat, lon=lon, country_code=country_code)
        if results and len(results) > 0:
            return results[0]
        return None
    @staticmethod
    async def search(
        query: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        country_code: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Searches any city, district, address, landmark, or raw coordinates worldwide.
        Uses deterministic geographic scoring, population & administrative hierarchy,
        user proximity bias, and country context without hardcoded city special-cases.
        """
        q = query.strip()
        if not q:
            return []
        # Check if coordinates input like "12.2958, 76.6394" or "35.6762 139.6503"
        coord_match = re.match(r"^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$", q)
        if coord_match:
            item_lat = float(coord_match.group(1))
            item_lon = float(coord_match.group(2))
            resolved = await GeocodingProvider.reverse_geocode(item_lat, item_lon)
            resolved["isUserLocation"] = False
            return [resolved]
        candidates: List[Dict[str, Any]] = []
        # 1. Query Open-Meteo Geocoding API (Fast, comprehensive global cities & populations, no rate limits)
        try:
            om_url = "https://geocoding-api.open-meteo.com/v1/search"
            om_params = {
                "name": q,
                "count": 8,
                "language": "en",
                "format": "json",
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(om_url, params=om_params)
                if res.status_code == 200:
                    for item in res.json().get("results", []):
                        item_lat = float(item.get("latitude"))
                        item_lon = float(item.get("longitude"))
                        city_name = item.get("name") or q
                        state_name = item.get("admin1") or None
                        country_name = item.get("country") or None
                        ccode = (item.get("country_code") or "").upper() or None
                        pop = int(item.get("population") or 0)
                        fcode = str(item.get("feature_code") or "")
                        disp = f"{city_name}"
                        if state_name and state_name != city_name:
                            disp += f", {state_name}"
                        if country_name:
                            disp += f", {country_name}"
                        candidates.append({
                            "latitude": item_lat,
                            "longitude": item_lon,
                            "accuracy": None,
                            "city": city_name,
                            "district": item.get("admin2") or None,
                            "state": state_name,
                            "region": state_name,
                            "country": country_name,
                            "countryCode": ccode,
                            "regionCode": None,
                            "timezone": item.get("timezone") or "UTC",
                            "displayName": disp,
                            "isUserLocation": False,
                            "_pop": pop,
                            "_fcode": fcode,
                            "_source": "openmeteo",
                        })
        except Exception:
            pass
        # 2. Query OSM Nominatim (Complements with streets, POIs, landmarks, exact parcels)
        try:
            nom_url = "https://nominatim.openstreetmap.org/search"
            nom_headers = {
                "User-Agent": settings.NOMINATIM_USER_AGENT,
                "Accept-Language": "en, *;q=0.5",
            }
            nom_params = {
                "q": q,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": 6,
            }
            if country_code:
                nom_params["countrycodes"] = country_code.lower()
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(nom_url, params=nom_params, headers=nom_headers)
                if res.status_code == 200:
                    for item in res.json():
                        addr = item.get("address", {})
                        city = (
                            addr.get("city")
                            or addr.get("town")
                            or addr.get("village")
                            or addr.get("municipality")
                            or addr.get("suburb")
                            or addr.get("hamlet")
                            or item.get("name")
                            or None
                        )
                        district = addr.get("county") or addr.get("state_district") or None
                        state = addr.get("state") or addr.get("province") or None
                        country = addr.get("country") or None
                        c_code = (addr.get("country_code", "")).upper() or None
                        item_lat = float(item.get("lat"))
                        item_lon = float(item.get("lon"))
                        importance = float(item.get("importance") or 0.3)
                        addresstype = str(item.get("type") or item.get("addresstype") or "")
                        candidates.append({
                            "latitude": item_lat,
                            "longitude": item_lon,
                            "accuracy": None,
                            "city": city,
                            "district": district,
                            "state": state,
                            "region": state,
                            "country": country,
                            "countryCode": c_code,
                            "regionCode": addr.get("ISO3166-2-lvl4") or None,
                            "timezone": "UTC",
                            "displayName": item.get("display_name", f"{city or 'Location'}, {country or ''}"),
                            "isUserLocation": False,
                            "_pop": int(importance * 500000),
                            "_fcode": "PPLA" if addresstype in ["city", "administrative"] else "PPL",
                            "_source": "nominatim",
                        })
        except Exception:
            pass
        if not candidates:
            return []
        # 3. Deterministic Global Disambiguation & Ranking
        q_lower = q.lower().strip()
        scored_candidates: List[Dict[str, Any]] = []
        for cand in candidates:
            score = 0.0
            city_name = (cand.get("city") or "").lower().strip()
            cand_country_code = (cand.get("countryCode") or "").upper()
            # Exact query match on city name
            if city_name == q_lower:
                score += 30.0
            elif city_name.startswith(q_lower):
                score += 15.0
            # Population / administrative prominence
            pop = cand.get("_pop", 0)
            score += math.log10(max(pop, 1000)) * 2.5
            fcode = cand.get("_fcode", "")
            if fcode in ["PPLC", "PPLA", "PPLA2"]:
                score += 18.0
            elif fcode in ["PPL", "town"]:
                score += 8.0
            # User country context bonus
            if country_code and cand_country_code == country_code.upper():
                score += 16.0
            # Proximity bonus if user location provided
            if lat is not None and lon is not None:
                dist_km = GeocodingProvider._haversine_distance_km(lat, lon, cand["latitude"], cand["longitude"])
                if dist_km < 50:
                    score += 25.0
                elif dist_km < 250:
                    score += 18.0
                elif dist_km < 1000:
                    score += 10.0
                elif dist_km < 3000:
                    score += 5.0
            cand["_disambiguationScore"] = score
            scored_candidates.append(cand)
        # Sort by disambiguation score descending
        scored_candidates.sort(key=lambda x: x["_disambiguationScore"], reverse=True)
        # 4. Deduplicate close spatial clusters (within 8km)
        unique_results: List[Dict[str, Any]] = []
        for cand in scored_candidates:
            is_dup = False
            for existing in unique_results:
                d = GeocodingProvider._haversine_distance_km(
                    cand["latitude"], cand["longitude"],
                    existing["latitude"], existing["longitude"]
                )
                if d < 8.0:
                    is_dup = True
                    break
            if not is_dup:
                # Clean up internal calculation metadata
                clean_cand = {k: v for k, v in cand.items() if not k.startswith("_")}
                unique_results.append(clean_cand)
            if len(unique_results) >= 8:
                break
        return unique_results
    forward_geocode = search
