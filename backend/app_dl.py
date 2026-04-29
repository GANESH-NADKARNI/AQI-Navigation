"""
AQI Eco-Nav — FastAPI Backend
Model: BiLSTM Deep Learning (better accuracy on time-series AQI data)

Run:
    uvicorn app_dl:app --reload --host 0.0.0.0 --port 8001
    python app_dl.py

Train DL model first:
    python ml/train_dl.py

Note: runs on port 8001 by default so you can run both servers side by side.
      Change PORT in .env or pass --port to uvicorn to override.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

# ── Import BiLSTM predictor and inject into the predict route ───────
from ml.predictor_dl  import predictor_dl       # BiLSTM singleton
import routes.predict as predict_route
predict_route.active_predictor = predictor_dl   # <-- inject here

from routes.geocode  import router as geocode_router
from routes.aqi      import router as aqi_router
from routes.predict  import router as predict_router
from routes.routing  import router as routing_router

# Default DL port = 8001 (so both servers can run simultaneously)
DL_PORT = int(settings.PORT) + 1  # 8001 if PORT=8000

app = FastAPI(
    title       = "AQI Eco-Nav API — BiLSTM",
    description = "AQI prediction (Bidirectional LSTM) + eco-friendly navigation",
    version     = "3.0-dl",
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
        "model_engine": "BiLSTM (Deep Learning)",
        "model_loaded": predictor_dl.loaded,
        "model_meta":   predictor_dl.meta or "Run: python ml/train_dl.py",
    }


if __name__ == "__main__":
    uvicorn.run("app_dl:app", host=settings.HOST, port=8000, reload=True)
