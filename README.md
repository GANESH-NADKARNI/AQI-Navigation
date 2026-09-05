# 🌿 AQI Eco-Nav

> **Real-time Air Quality Prediction + Eco-Friendly Navigation**  
> Predict tomorrow's AQI with ML/Deep Learning · Navigate via the cleanest air route · Live GPS tracking like Google Maps  
> 100% Free & Open Source — No Google Maps, No Paid APIs

---

## 🤗 Try it / Hosted on Hugging Face

[![Hugging Face Space](https://img.shields.io/badge/🤗%20Space-Aqi--Predictor--Demo-FFD21E?style=for-the-badge)](https://huggingface.co/spaces/Ganesh-Nadkarni/Aqi-Predictor-Demo)
[![Hugging Face Model](https://img.shields.io/badge/🤗%20Model-aqi--eco--nav--models-FFD21E?style=for-the-badge)](https://huggingface.co/Ganesh-Nadkarni/aqi-eco-nav-models)

Try the live AQI predictor in your browser (no setup needed), or grab the trained model weights directly from the model repo.

---

## 📸 Features

| Feature | Details |
|---|---|
| 🗺 **Dual Route Map** | 🔵 Shortest (blue) + 🟢 Clean Air (green) routes shown simultaneously on OpenStreetMap |
| 🤖 **AQI Prediction** | XGBoost (fast) or BiLSTM (accurate) — predicts next-day AQI with pollution classification |
| 📍 **Live GPS Tracking** | Map follows your dot with heading cone, just like Google Maps |
| 🔊 **Voice Navigation** | Auto-announces turns when you approach them (Web Speech API, en-IN) |
| ↩ **Re-centre Button** | Appears when you pan — one tap snaps back to your position |
| 🌡 **Live AQI on Route** | Coloured dots sampled along each route from real-time WAQI data |
| 🔮 **AQI Forecast Panel** | Enter city + optional pollutant readings → get next-day AQI + health advice |
| 📋 **Step-by-Step Directions** | Full turn-by-turn list, slides up from bottom during navigation |

---

## 🏗 Project Structure

```
aqi-eco-nav/
│
├── backend/
│   ├── app.py                  ← FastAPI server using XGBoost model
│   ├── app_dl.py               ← FastAPI server using BiLSTM DL model
│   ├── config.py               ← Settings & environment variables
│   ├── requirements.txt
│   │
│   ├── ml/
│   │   ├── train.py            ← Train XGBoost / LightGBM / Random Forest
│   │   ├── train_dl.py         ← Train Bidirectional LSTM (PyTorch)
│   │   ├── predictor.py        ← XGBoost inference singleton
│   │   └── predictor_dl.py     ← BiLSTM inference singleton
│   │
│   ├── routes/
│   │   ├── aqi.py              ← GET  /aqi/live
│   │   ├── geocode.py          ← GET  /geocode
│   │   ├── predict.py          ← POST /predict  (model-agnostic)
│   │   └── routing.py          ← GET  /route
│   │
│   ├── services/
│   │   ├── aqi_service.py      ← WAQI + OpenWeatherMap live AQI fetching
│   │   └── routing_service.py  ← OSRM routing + AQI scoring
│   │
│   └── models/                 ← Auto-populated after training
│       ├── xgb_aqi_model.pkl
│       ├── lstm_aqi_model.pt
│       └── ...
│
├── frontend/
│   ├── index.html              ← Main app (clean markup only)
│   ├── css/
│   │   └── main.css            ← All styles (Google Maps dark theme)
│   └── js/
│       ├── config.js           ← API endpoints & constants
│       ├── utils.js            ← AQI colors, debounce, maneuver icons
│       ├── map.js              ← Leaflet map, GPS dot, route layers
│       ├── geocoding.js        ← Nominatim autocomplete + geolocation
│       ├── routing.js          ← Route fetch + tab UI
│       ├── navigation.js       ← Turn-by-turn GPS nav + voice
│       ├── prediction.js       ← AQI forecast panel
│       └── app.js              ← Entry point — wires all modules
│
├── data/
│   └── city_day.csv            ← Place Kaggle dataset here
│
└── .env.example
```

---

## 🆓 Free APIs Used

| API | Purpose | Key needed |
|---|---|---|
| [OpenStreetMap](https://openstreetmap.org) + Leaflet.js | Map tiles & rendering | ❌ No |
| [Nominatim](https://nominatim.openstreetmap.org) | Address autocomplete & geocoding | ❌ No |
| [OSRM](http://router.project-osrm.org) | Routing — shortest + alternatives | ❌ No |
| [WAQI](https://aqicn.org) | Live AQI dots along route | ✅ Free token |
| [OpenWeatherMap](https://openweathermap.org/api/air-pollution) | Backup AQI source | ✅ Free key |
| Web Speech API | Voice navigation | ❌ Built into browser |

---

## 🤖 Models

### Option A — XGBoost (`app.py`)
Best for: fast startup, low memory, tabular data

```
city_day.csv → XGBoost (500 trees) → AQI prediction
Typical MAE : ~16–20  |  R² : ~0.92  |  Train time: ~30 sec
```

### Option B — BiLSTM (`app_dl.py`)
Best for: higher accuracy, captures multi-day pollution patterns

```
city_day.csv → 7-day sliding window → 2-layer BiLSTM → AQI prediction
Typical MAE : ~12–15  |  R² : ~0.95  |  Train time: ~10 min (CPU)

Architecture: Input(16) → BiLSTM(128, bidir) × 2 → FC(256) → ReLU → FC(1)
```

Why BiLSTM wins on AQI: pollution is a time-series — yesterday's PM2.5 strongly predicts today's AQI. LSTM captures this memory; XGBoost treats each day independently.

---

## 🚀 Setup

### 1. Get the dataset
Download from Kaggle → place `city_day.csv` in `data/`:  
[rohanrao/air-quality-data-in-india](https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india)

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env:
#   WAQI_TOKEN  → free at aqicn.org/data-platform/token/
#   OWM_API_KEY → free at openweathermap.org/api  (optional backup)
```

### 3. Install dependencies
```bash
cd backend
pip install -r requirements.txt

# For BiLSTM (Deep Learning) — CPU install:
pip install torch --index-url https://download.pytorch.org/whl/cpu

# For GPU (NVIDIA CUDA 12):
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

### 4. Train the model

**XGBoost** (recommended to start):
```bash
cd backend
python ml/train.py
```

**BiLSTM** (better accuracy, takes longer):
```bash
cd backend
python ml/train_dl.py
# Optional: python ml/train_dl.py --epochs 80
```

### 5. Run the server

**XGBoost server** (port 8000):
```bash
cd backend
python app.py
# or: uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

**BiLSTM server** (port 8001):
```bash
cd backend
python app_dl.py
# or: uvicorn app_dl:app --reload --host 0.0.0.0 --port 8001
```

### 6. Open the frontend
```bash
cd frontend
python -m http.server 3000
# Open: http://localhost:3000
```

> **Tip:** Use `python -m http.server` instead of opening the file directly — this avoids browser CORS restrictions when calling the API.

---

## 📡 API Reference

Base URL: `http://localhost:8000` (XGBoost) or `http://localhost:8001` (BiLSTM)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server status + model info (type, R², MAE) |
| `GET` | `/geocode?q=MG Road Bengaluru` | Address → lat/lng via Nominatim |
| `GET` | `/aqi/live?lat=12.97&lng=77.59` | Live AQI at coordinates (WAQI/OWM) |
| `POST` | `/predict` | Next-day AQI prediction |
| `GET` | `/route?origin_lat=...&dest_lat=...` | Shortest + eco routes with AQI scores |

Interactive docs: `http://localhost:8000/docs`

**Predict request example:**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"city": "Bengaluru", "pm25": 45.2, "pm10": 80.1, "no2": 28.5}'
```

**Response:**
```json
{
  "city": "Bengaluru",
  "prediction_date": "2026-04-17",
  "predicted_aqi": 118.4,
  "aqi_bucket": "Moderate",
  "aqi_color": "#fdd74b",
  "health_advice": "Sensitive groups should limit prolonged outdoor exertion.",
  "model_type": "XGBoost"
}
```

---

## 🗺 How Navigation Works

```
User types address
       ↓
Nominatim autocomplete (called directly from browser — no proxy)
       ↓
User selects origin + destination
       ↓
OSRM returns up to 3 alternative routes
       ↓
Backend samples 7 GPS points per route
       ↓
WAQI fetches live AQI at each point
       ↓
Route with lowest average AQI  →  🟢 Clean Air route
Fastest / shortest route       →  🔵 Shortest route
       ↓
Both drawn on Leaflet map
       ↓
User picks one route → taps "Start Navigation"
       ↓
GPS watchPosition fires every ~1–2 sec
       ↓
Distance to next turn counted down live
At 80 m  →  voice announces "In 80 metres, turn right onto MG Road"
At 30 m  →  step auto-advances to next instruction
       ↓
Re-centre button appears if user pans — one tap follows GPS again
```

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| Autocomplete not working | Works via browser → Nominatim directly. Check internet connection. |
| `Model not loaded` | Run `python ml/train.py` inside `backend/` |
| `DL model not loaded` | Run `python ml/train_dl.py` and install PyTorch |
| Routes not loading | OSRM public server may be slow — wait 10 sec and retry |
| AQI dots missing | Add valid `WAQI_TOKEN` in `.env` (free at aqicn.org) |
| Voice not working | Use Chrome or Edge — Firefox Web Speech support is limited |
| CORS error | Serve frontend with `python -m http.server`, not `file://` |
| Only one route shown | OSRM found no alternative path for that trip — normal for some routes |

---

## 🛠 Tech Stack

**Backend:** Python · FastAPI · XGBoost · PyTorch · scikit-learn · httpx · Uvicorn  
**Frontend:** Vanilla JS (ES6 modules) · Leaflet.js · Web Speech API · CSS3  
**APIs:** OpenStreetMap · Nominatim · OSRM · WAQI · OpenWeatherMap  
**ML:** XGBoost, LightGBM, Random Forest (tabular) · BiLSTM (time-series)  

---

## 📄 License

MIT License — free to use, modify, and distribute.

Dataset: © Kaggle / rohanrao — [CC0 Public Domain](https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india)  
Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL)
