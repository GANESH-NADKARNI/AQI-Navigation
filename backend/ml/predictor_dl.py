"""
AQI DL Predictor — BiLSTM inference
Same public interface as ml/predictor.py so all route code is unchanged.
Loaded by app_dl.py instead of the XGBoost predictor.
"""

import os
import json
import numpy as np
import joblib
from datetime import datetime, timedelta
from typing import Optional
from config import settings

# ── LSTM model definition (must match train_dl.py exactly) ──────────
try:
    import torch
    import torch.nn as nn
    TORCH_OK = True
except ImportError:
    TORCH_OK = False

FEATURES = [
    'PM2.5','PM10','NO','NO2','NOx','NH3','CO','SO2','O3',
    'Benzene','Toluene','Xylene',
    'Month','DayOfYear','DayOfWeek','City_Enc'
]


class BiLSTMAQI(nn.Module if TORCH_OK else object):
    def __init__(self, input_size, hidden_size=128, num_layers=2, dropout=0.25):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size, hidden_size=hidden_size,
            num_layers=num_layers, batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=True,
        )
        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_size * 2, 256),
            nn.ReLU(),
            nn.Dropout(dropout / 2),
            nn.Linear(256, 1),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :]).squeeze(1)


# ── Predictor class ──────────────────────────────────────────────────
class AQIPredictorDL:
    """
    Drop-in replacement for AQIPredictor (XGBoost).
    Exposes identical attributes: .loaded, .meta, .predict()
    """

    def __init__(self):
        self.model   = None
        self.scaler  = None
        self.le      = None
        self.medians = None
        self.meta    = None
        self.loaded  = False
        self.seq_len = 7
        self._device = None
        self._load()

    def _load(self):
        if not TORCH_OK:
            print("⚠  PyTorch not installed — DL model unavailable")
            print("   pip install torch --index-url https://download.pytorch.org/whl/cpu")
            return

        model_path = os.path.join(settings.MODEL_DIR, 'lstm_aqi_model.pt')
        sc_path    = os.path.join(settings.MODEL_DIR, 'dl_scaler.pkl')
        enc_path   = os.path.join(settings.MODEL_DIR, 'dl_city_encoder.pkl')
        med_path   = os.path.join(settings.MODEL_DIR, 'dl_feature_medians.pkl')
        meta_path  = os.path.join(settings.MODEL_DIR, 'dl_model_meta.json')

        try:
            self._device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

            # Load checkpoint (contains weights + arch params)
            ckpt = torch.load(model_path, map_location=self._device)

            self.model = BiLSTMAQI(
                input_size  = ckpt['input_size'],
                hidden_size = ckpt.get('hidden_size', 128),
                num_layers  = ckpt.get('num_layers',  2),
                dropout     = ckpt.get('dropout',     0.25),
            ).to(self._device)
            self.model.load_state_dict(ckpt['state_dict'])
            self.model.eval()
            self.seq_len = ckpt.get('seq_len', 7)

            self.scaler  = joblib.load(sc_path)
            self.le      = joblib.load(enc_path)
            self.medians = joblib.load(med_path)

            with open(meta_path) as f:
                self.meta = json.load(f)

            self.loaded = True
            print(f"✅ DL model loaded: {self.meta.get('model_type','?')} "
                  f"R²={self.meta.get('r2','?')} on {self._device}")

        except FileNotFoundError:
            print("⚠  DL model files not found — run: python ml/train_dl.py")

    # ── Predict ───────────────────────────────────────────────────────
    def predict(self, city: str, date_str: Optional[str], overrides: dict) -> dict:
        if not self.loaded:
            raise RuntimeError("DL model not loaded. Run: python ml/train_dl.py")

        from services.aqi_service import aqi_bucket, aqi_color, health_advice

        target = (datetime.strptime(date_str, "%Y-%m-%d")
                  if date_str else datetime.now() + timedelta(days=1))

        try:
            city_enc = float(self.le.transform([city])[0])
        except Exception:
            city_enc = 0.0

        # Build a single feature vector using overrides + median fallbacks
        row = {
            'PM2.5':    overrides.get('pm25'),
            'PM10':     overrides.get('pm10'),
            'NO':       overrides.get('no'),
            'NO2':      overrides.get('no2'),
            'NOx':      overrides.get('nox'),
            'NH3':      overrides.get('nh3'),
            'CO':       overrides.get('co'),
            'SO2':      overrides.get('so2'),
            'O3':       overrides.get('o3'),
            'Benzene':  overrides.get('benzene'),
            'Toluene':  overrides.get('toluene'),
            'Xylene':   overrides.get('xylene'),
            'Month':     float(target.month),
            'DayOfYear': float(target.timetuple().tm_yday),
            'DayOfWeek': float(target.weekday()),
            'City_Enc':  city_enc,
        }

        single = np.array([[
            float(row[f]) if row.get(f) is not None else self.medians.get(f, 0.0)
            for f in FEATURES
        ]], dtype=np.float32)                        # shape (1, 16)

        # Scale
        single_scaled = self.scaler.transform(single)  # (1, 16)

        # Replicate into a sequence of length seq_len (best approximation when
        # we only have one time-step of data from the user)
        # A sequence of identical rows is a reasonable fallback; the LSTM will
        # still apply its learned seasonal/city weights correctly.
        seq = np.repeat(single_scaled, self.seq_len, axis=0)  # (seq_len, 16)
        seq = seq[np.newaxis, :, :]                            # (1, seq_len, 16)

        # Inference
        with torch.no_grad():
            t   = torch.tensor(seq, dtype=torch.float32).to(self._device)
            out = self.model(t).item()

        pred = max(0.0, round(float(out), 1))

        return {
            "city":             city,
            "prediction_date":  target.strftime("%Y-%m-%d"),
            "predicted_aqi":    pred,
            "aqi_bucket":       aqi_bucket(pred),
            "aqi_color":        aqi_color(pred),
            "health_advice":    health_advice(pred),
            "available_cities": list(self.le.classes_) if self.le else [],
            "model_type":       self.meta.get("model_type", "BiLSTM") if self.meta else "BiLSTM",
        }


# Singleton — imported by app_dl.py
predictor_dl = AQIPredictorDL()
