"""
AQI Eco-Nav — FastAPI Backend
Model: XGBoost (fast, tabular, best ML model)

Run:
    uvicorn app:app --reload --host 0.0.0.0 --port 8000
    python app.py

Train first:
    python ml/train.py
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

# ── Import XGBoost predictor and inject into the predict route ──────
from ml.predictor     import predictor          # XGBoost singleton
import routes.predict as predict_route
predict_route.active_predictor = predictor      # <-- inject here

from routes.geocode  import router as geocode_router
from routes.aqi      import router as aqi_router
from routes.predict  import router as predict_router
from routes.routing  import router as routing_router

app = FastAPI(
    title       = "AQI Eco-Nav API — XGBoost",
    description = "AQI prediction (XGBoost) + eco-friendly navigation",
    version     = "3.0-xgb",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

app.include_router(geocode_router)
app.include_router(aqi_router)
app.include_router(predict_router)
app.include_router(routing_router)


@app.get("/health", tags=["system"])
def health():
    return {
        "status":       "ok",
        "model_engine": "XGBoost",
        "model_loaded": predictor.loaded,
        "model_meta":   predictor.meta or "Run: python ml/train.py",
    }


if __name__ == "__main__":
    uvicorn.run("app:app", host=settings.HOST, port=settings.PORT, reload=True)
