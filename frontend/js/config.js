// ═══════════════════════════════════════════════
// EcoNav — Frontend Configuration
// ═══════════════════════════════════════════════

const Config = {
  API_BASE: 'http://localhost:8000',

  // Nominatim called directly from browser (avoids proxy issues)
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org/search',

  ENDPOINTS: {
    health:    () => `${Config.API_BASE}/health`,
    predict:   () => `${Config.API_BASE}/predict`,
    route:     (oLat, oLng, dLat, dLng) =>
      `${Config.API_BASE}/route?origin_lat=${oLat}&origin_lng=${oLng}&dest_lat=${dLat}&dest_lng=${dLng}`,
    liveAqi:   (lat, lng) =>
      `${Config.API_BASE}/aqi/live?lat=${lat}&lng=${lng}`,
  },

  MAP: {
    defaultCenter: [12.9716, 77.5946],   // Bengaluru
    defaultZoom: 13,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttrib: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
  },

  AUTOCOMPLETE: {
    debounceMs: 400,
    minChars: 3,
    maxResults: 6,
  },
};
