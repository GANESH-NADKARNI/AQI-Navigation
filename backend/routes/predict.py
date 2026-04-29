"""
POST /predict — AQI prediction route.

The active predictor (XGBoost or BiLSTM) is injected into this module
by whichever app file imports it:
  • app.py    → sets active_predictor = XGBoost predictor
  • app_dl.py → sets active_predictor = BiLSTM predictor

All route logic is identical; only the model changes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/predict", tags=["predict"])

# This variable is set by app.py / app_dl.py before the router is included.
# Default = None so a clear error is raised if someone forgets to inject it.
active_predictor = None


class PredictRequest(BaseModel):
    city:    str             = "Bengaluru"
    date:    Optional[str]   = None       # YYYY-MM-DD; defaults to tomorrow
    pm25:    Optional[float] = None
    pm10:    Optional[float] = None
    no:      Optional[float] = None
    no2:     Optional[float] = None
    nox:     Optional[float] = None
    nh3:     Optional[float] = None
    co:      Optional[float] = None
    so2:     Optional[float] = None
    o3:      Optional[float] = None
    benzene: Optional[float] = None
    toluene: Optional[float] = None
    xylene:  Optional[float] = None


@router.post("")
def predict_aqi(req: PredictRequest):
    if active_predictor is None:
        raise HTTPException(500, "Predictor not injected — check app.py / app_dl.py")
    if not active_predictor.loaded:
        model_cmd = (
            "python ml/train.py"
            if getattr(active_predictor, '__class__', None) and
               'DL' not in active_predictor.__class__.__name__
            else "python ml/train_dl.py"
        )
        raise HTTPException(503, f"Model not loaded. Run: {model_cmd}")

    overrides = req.model_dump(exclude={"city", "date"})
    try:
        return active_predictor.predict(req.city, req.date, overrides)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
