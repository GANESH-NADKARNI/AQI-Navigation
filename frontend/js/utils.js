// ═══════════════════════════════════════════════
// EcoNav — Shared Utilities
// ═══════════════════════════════════════════════

const Utils = {

  // ── AQI classification ─────────────────────
  aqiBucket(v) {
    if (v <= 50)  return 'Good';
    if (v <= 100) return 'Satisfactory';
    if (v <= 200) return 'Moderate';
    if (v <= 300) return 'Poor';
    if (v <= 400) return 'Very Poor';
    return 'Severe';
  },

  aqiColor(v) {
    if (v <= 50)  return '#00e400';
    if (v <= 100) return '#a8e05f';
    if (v <= 200) return '#fdd74b';
    if (v <= 300) return '#fe9b57';
    if (v <= 400) return '#fe6a69';
    return '#a97abc';
  },

  aqiCssClass(v) {
    if (v <= 50)  return 'aqi-good';
    if (v <= 100) return 'aqi-satisfactory';
    if (v <= 200) return 'aqi-moderate';
    if (v <= 300) return 'aqi-poor';
    if (v <= 400) return 'aqi-very-poor';
    return 'aqi-severe';
  },

  // ── Maneuver icon ──────────────────────────
  maneuverIcon(type, modifier) {
    const icons = {
      'depart':            '🟢',
      'arrive':            '🏁',
      'turn-left':         '←',
      'turn-right':        '→',
      'turn-slight left':  '↖',
      'turn-slight right': '↗',
      'turn-sharp left':   '⬅',
      'turn-sharp right':  '➡',
      'turn-uturn':        '↩',
      'turn-straight':     '↑',
      'merge':             '⇒',
      'fork-left':         '↰',
      'fork-right':        '↱',
      'roundabout':        '🔄',
      'continue':          '↑',
    };
    return icons[`${type}-${modifier}`] || icons[type] || '↑';
  },

  // ── Toast ──────────────────────────────────
  _toastTimer: null,
  toast(msg, duration = 3500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  },

  // ── Debounce ───────────────────────────────
  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // ── ETA calculator ─────────────────────────
  calcETA(durationSeconds) {
    const now = new Date();
    now.setSeconds(now.getSeconds() + durationSeconds);
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  // ── GeoJSON coords → Leaflet LatLng ────────
  geoJsonToLatLng(geoJson) {
    return geoJson.coordinates.map(c => [c[1], c[0]]);
  },
};
