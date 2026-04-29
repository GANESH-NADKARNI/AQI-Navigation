import asyncio
import httpx
import numpy as np
from config import settings
from services.aqi_service import score_route_aqi, aqi_bucket, aqi_color


def format_distance(m: float) -> str:
    return f"{int(m)} m" if m < 1000 else f"{m/1000:.1f} km"


def format_duration(s: float) -> str:
    mins = int(s / 60)
    if mins < 60:
        return f"{mins} min"
    return f"{mins//60}h {mins%60}min"


def build_instruction(maneuver: dict, road: str) -> str:
    t   = maneuver.get("type", "")
    mod = maneuver.get("modifier", "")
    r   = f" onto {road}" if road and road not in ("-", "") else ""

    mapping = {
        ("depart",  ""):        lambda: f"Head {mod}{r}" if mod else f"Start{r}",
        ("arrive",  ""):        lambda: "You have arrived at your destination",
        ("turn", "left"):       lambda: f"Turn left{r}",
        ("turn", "right"):      lambda: f"Turn right{r}",
        ("turn", "slight left"):lambda: f"Bear left{r}",
        ("turn", "slight right"):lambda: f"Bear right{r}",
        ("turn", "sharp left"): lambda: f"Make a sharp left{r}",
        ("turn", "sharp right"):lambda: f"Make a sharp right{r}",
        ("turn", "uturn"):      lambda: "Make a U-turn",
        ("turn", "straight"):   lambda: f"Continue straight{r}",
        ("merge", ""):          lambda: f"Merge{r}",
        ("fork", "left"):       lambda: "Take the left fork",
        ("fork", "right"):      lambda: "Take the right fork",
        ("fork", "slight left"):lambda: "Keep left at the fork",
        ("fork", "slight right"):lambda: "Keep right at the fork",
    }

    key = (t, mod)
    if key in mapping:
        return mapping[key]()
    if t == "roundabout" or t == "rotary":
        ex = maneuver.get("exit", "")
        return f"Enter the roundabout and take exit {ex}" if ex else "Enter the roundabout"
    if t in ("exit roundabout", "exit rotary"):
        return f"Exit the roundabout{r}"
    if t in ("continue", "new name", "notification"):
        return f"Continue{r}" if road else ""
    if t == "depart":
        return f"Head {mod}{r}" if mod else f"Start{r}"
    return ""


def parse_steps(route: dict) -> list:
    steps = []
    for leg in route.get("legs", []):
        for step in leg.get("steps", []):
            instr = build_instruction(step.get("maneuver", {}), step.get("name", ""))
            if not instr:
                continue
            loc = step["maneuver"].get("location", [0, 0])
            steps.append({
                "instruction":  instr,
                "distance":     step.get("distance", 0),
                "distance_str": format_distance(step.get("distance", 0)),
                "duration":     step.get("duration", 0),
                "duration_str": format_duration(step.get("duration", 0)),
                "lng": loc[0],
                "lat": loc[1],
                "type": step.get("maneuver", {}).get("type", ""),
                "modifier": step.get("maneuver", {}).get("modifier", ""),
                "road": step.get("name", ""),
            })
    return steps


async def get_routes(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float
) -> dict:
    url = (
        f"{settings.OSRM_BASE}/route/v1/driving/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        f"?alternatives=3&steps=true&geometries=geojson&overview=full&annotations=false"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url)
        osrm = r.json()

    if osrm.get("code") != "Ok" or not osrm.get("routes"):
        raise ValueError(f"OSRM error: {osrm.get('code', 'no routes found')}")

    raw_routes = osrm["routes"]

    # Score all routes by AQI in parallel
    async def enrich(route: dict) -> dict:
        coords = route["geometry"]["coordinates"]
        avg_aqi, aqi_samples = await score_route_aqi(coords)
        steps = parse_steps(route)
        return {
            "geometry":    route["geometry"],
            "distance":    route["distance"],
            "duration":    route["duration"],
            "distance_str":format_distance(route["distance"]),
            "duration_str":format_duration(route["duration"]),
            "avg_aqi":     round(avg_aqi, 1),
            "aqi_bucket":  aqi_bucket(avg_aqi),
            "aqi_color":   aqi_color(avg_aqi),
            "steps":       steps,
            "aqi_samples": aqi_samples,
        }

    scored = await asyncio.gather(*[enrich(r) for r in raw_routes])

    shortest = scored[0]
    eco_idx  = int(np.argmin([s["avg_aqi"] for s in scored]))
    eco      = scored[eco_idx]

    return {
        "shortest":        {**shortest, "route_type": "shortest", "color": "#3b82f6"},
        "eco":             {**eco,      "route_type": "eco",      "color": "#22c55e"},
        "same_route":      eco_idx == 0,
        "n_alternatives":  len(scored),
    }
