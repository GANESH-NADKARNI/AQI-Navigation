import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    WAQI_TOKEN: str = os.getenv("WAQI_TOKEN", "demo")
    OWM_API_KEY: str = os.getenv("OWM_API_KEY", "")
    MODEL_DIR: str = os.path.join(os.path.dirname(__file__), "models")
    OSRM_BASE: str = "http://router.project-osrm.org"
    NOMINATIM_BASE: str = "https://nominatim.openstreetmap.org"
    NOMINATIM_UA: str = "AQI-EcoNav/2.0 (contact@ecoNav.dev)"

settings = Settings()
