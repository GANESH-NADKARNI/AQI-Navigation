import httpx
from fastapi import APIRouter, Query, HTTPException
from config import settings

router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("")
async def geocode(q: str = Query(..., min_length=2)):
    """
    Address → lat/lng via Nominatim (OpenStreetMap).
    No API key required. Rate limit: 1 req/sec — handled client-side with debounce.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{settings.NOMINATIM_BASE}/search",
                params={
                    "q":              q,
                    "format":         "jsonv2",
                    "limit":          6,
                    "addressdetails": 1,
                    "extratags":      0,
                },
                headers={
                    "User-Agent":      settings.NOMINATIM_UA,
                    "Accept":          "application/json",
                    "Accept-Language": "en",
                },
                follow_redirects=True,
            )

        if r.status_code != 200:
            return []

        content = r.content.strip()
        if not content:
            return []

        data = r.json()
        # Normalise to a consistent shape
        results = []
        for item in data:
            results.append({
                "display_name": item.get("display_name", ""),
                "lat":          float(item.get("lat", 0)),
                "lon":          float(item.get("lon", 0)),
                "type":         item.get("type", ""),
                "category":     item.get("category", ""),
            })
        return results

    except Exception as e:
        # Never crash — just return empty
        return []
