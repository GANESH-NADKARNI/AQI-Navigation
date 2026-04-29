from fastapi import APIRouter, HTTPException, Query
from services.routing_service import get_routes

router = APIRouter(prefix="/route", tags=["route"])


@router.get("")
async def route(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat:   float = Query(...),
    dest_lng:   float = Query(...),
):
    try:
        return await get_routes(origin_lat, origin_lng, dest_lat, dest_lng)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(503, f"Routing service error: {e}")
