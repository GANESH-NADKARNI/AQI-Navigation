from fastapi import APIRouter, Query
from services.aqi_service import fetch_live_aqi, aqi_bucket, aqi_color

router = APIRouter(prefix="/aqi", tags=["aqi"])


@router.get("/live")
async def live_aqi(lat: float = Query(...), lng: float = Query(...)):
    result = await fetch_live_aqi(lat, lng)
    if result is None:
        return {"aqi": None, "message": "No live data available for this location"}
    return result
