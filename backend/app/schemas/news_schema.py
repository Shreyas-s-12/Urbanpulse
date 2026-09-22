from typing import List, Optional
from pydantic import BaseModel, Field


class PulseWireErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error description")


class PulseWireTimeWindow(BaseModel):
    from_: str = Field(..., alias="from", description="ISO 8601 UTC start time (now - 24 hours)")
    to: str = Field(..., description="ISO 8601 UTC end time (now)")

    class Config:
        populate_by_name = True


class PulseWireLocationInfo(BaseModel):
    name: str = Field(..., description="Target location name, e.g. Bengaluru")


class PulseWireArticleItem(BaseModel):
    id: str = Field(..., description="Unique deterministic article ID")
    title: str = Field(..., description="Clean article headline")
    headline: str = Field(..., description="Article headline alias")
    description: Optional[str] = Field(None, description="Article summary or description")
    summary: Optional[str] = Field(None, description="Summary alias")
    url: str = Field(..., description="Real destination article URL on publisher site")
    article_url: str = Field(..., description="Article URL alias")
    source: str = Field(..., description="Publisher name, e.g. The Hindu, Reuters")
    source_name: str = Field(..., description="Publisher name alias")
    source_url: Optional[str] = Field(None, description="Publisher root domain URL")
    published_at: str = Field(..., description="ISO 8601 UTC publication timestamp")
    freshness: str = Field(..., description="Human-readable relative time, e.g. 2h ago")
    category: str = Field(..., description="Canonical category: TRAFFIC, WEATHER, HAZARD, CRIME, MUNICIPAL, GENERAL")
    image_url: Optional[str] = Field(None, description="Optional lead image URL")
    location: Optional[str] = Field(None, description="Geographic context")
    scope: Optional[str] = Field(None, description="Scope context")


class PulseWireResponse(BaseModel):
    status: str = Field(..., description="Feed status: AVAILABLE, EMPTY, or ERROR")
    location: PulseWireLocationInfo = Field(..., description="Location context")
    window: PulseWireTimeWindow = Field(..., description="Strict 24-hour time window")
    count: int = Field(0, description="Exact count of valid articles within 24h window")
    total_count: int = Field(0, description="Count alias")
    articles: List[PulseWireArticleItem] = Field(default_factory=list, description="Validated articles sorted newest first")
    items: List[PulseWireArticleItem] = Field(default_factory=list, description="Articles alias")
    retrieved_at: str = Field(..., description="ISO 8601 UTC timestamp of retrieval")
    error: Optional[PulseWireErrorDetail] = Field(None, description="Error detail if status is ERROR")

    class Config:
        populate_by_name = True
