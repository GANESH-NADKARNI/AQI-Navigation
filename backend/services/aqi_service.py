import asyncio
import httpx
import numpy as np
from typing import Optional
from config import settings


def aqi_bucket(aqi: float) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Severe"


def aqi_color(aqi: float) -> str:
    if aqi <= 50:   return "#00e400"
    if aqi <= 100:  return "#a8e05f"
    if aqi <= 200:  return "#fdd74b"
    if aqi <= 300:  return "#fe9b57"
    if aqi <= 400:  return "#fe6a69"
    return "#a97abc"


def health_advice(aqi: float) -> str:
    if aqi <= 50:   return "Air quality is great. Enjoy outdoor activities!"
    if aqi <= 100:  return "Air quality is satisfactory. Safe for most people."
    if aqi <= 200:  return "Moderate air quality. Sensitive groups should limit prolonged outdoor exertion."
    if aqi <= 300:  return "Poor air quality. Reduce outdoor activities. Consider wearing a mask."
    if aqi <= 400:  return "Very poor. Avoid prolonged outdoors. Wear N95 if going out."
    return "Severe pollution. Stay indoors. Health emergency level."


async def fetch_live_aqi(lat: float, lng: float) -> Optional[dict]:
    """Try WAQI → OpenWeatherMap. Returns dict with aqi, bucket, color or None."""
    # 1. WAQI
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"https://api.waqi.info/feed/geo:{lat};{lng}/",
                params={"token": settings.WAQI_TOKEN}
            )
            if r.status_code == 200:
                d = r.json()
                if d.get("status") == "ok":
                    val = d["data"].get("aqi")
                    if isinstance(val, (int, float)) and val > 0:
                        aqi_val = float(val)
                        # Also try to extract pollutant breakdown
                        iaqi = d["data"].get("iaqi", {})
                        return {
                            "aqi": aqi_val,
                            "aqi_bucket": aqi_bucket(aqi_val),
                            "aqi_color": aqi_color(aqi_val),
                            "health_advice": health_advice(aqi_val),
                            "station": d["data"].get("city", {}).get("name", ""),
                            "pm25": iaqi.get("pm25", {}).get("v"),
                            "pm10": iaqi.get("pm10", {}).get("v"),
                            "no2":  iaqi.get("no2",  {}).get("v"),
                            "co":   iaqi.get("co",   {}).get("v"),
                            "o3":   iaqi.get("o3",   {}).get("v"),
                            "source": "WAQI"
                        }
    except Exception:
        pass

    # 2. OpenWeatherMap fallback
    if settings.OWM_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(
                    "https://api.openweathermap.org/data/2.5/air_pollution",
                    params={"lat": lat, "lon": lng, "appid": settings.OWM_API_KEY}
                )
                if r.status_code == 200:
                    d = r.json()
                    aqi_idx = d["list"][0]["main"]["aqi"]
                    owm_map = {1: 25, 2: 75, 3: 150, 4: 250, 5: 375}
                    aqi_val = float(owm_map.get(aqi_idx, 100))
                    comp = d["list"][0].get("components", {})
                    return {
                        "aqi": aqi_val,
                        "aqi_bucket": aqi_bucket(aqi_val),
                        "aqi_color": aqi_color(aqi_val),
                        "health_advice": health_advice(aqi_val),
                        "pm25": comp.get("pm2_5"),
                        "pm10": comp.get("pm10"),
                        "no2":  comp.get("no2"),
                        "co":   comp.get("co"),
                        "o3":   comp.get("o3"),
                        "source": "OpenWeatherMap"
                    }
        except Exception:
            pass

    return None


def sample_route_points(coords: list, n: int = 8) -> list:
    if len(coords) <= n:
        return [[c[1], c[0]] for c in coords]
    indices = np.linspace(0, len(coords) - 1, n, dtype=int)
    return [[coords[i][1], coords[i][0]] for i in indices]


async def score_route_aqi(coords: list) -> tuple[float, list]:
    """Return (avg_aqi, sample_list) for a route's coordinate list."""
    samples = sample_route_points(coords, n=7)
    tasks = [fetch_live_aqi(p[0], p[1]) for p in samples]
    results = await asyncio.gather(*tasks)
    
    aqi_samples = []
    valid_aqi = []
    for i, res in enumerate(results):
        val = res["aqi"] if res else None
        aqi_samples.append({"lat": samples[i][0], "lng": samples[i][1], "aqi": val, "color": aqi_color(val) if val else "#888"})
        if val is not None:
            valid_aqi.append(val)
    
    avg = float(np.mean(valid_aqi)) if valid_aqi else 100.0
    return avg, aqi_samples
