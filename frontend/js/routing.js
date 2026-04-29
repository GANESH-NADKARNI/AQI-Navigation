// ═══════════════════════════════════════════════
// EcoNav — Routing Module v3 (fixed)
// ═══════════════════════════════════════════════

const Routing = (() => {

  let _routeData   = null;
  let _activeRoute = 'shortest';
  let _loading     = false;

  // ── Find routes ──────────────────────────────
  async function findRoutes(origin, dest) {
    if (_loading) return;
    _loading = true;

    Utils.toast('🔍 Finding routes…');

    try {
      const url = Config.ENDPOINTS.route(origin.lat, origin.lng, dest.lat, dest.lng);
      const res = await fetch(url);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      _routeData = await res.json();

      // If OSRM only returned one route (same_route:true), synthesise a
      // slightly-offset eco visual so the user always sees two lines.
      if (_routeData.same_route) {
        _routeData.eco = {
          ..._routeData.shortest,
          route_type:  'eco',
          color:       '#22c55e',
          // Eco label notes that this is the only available path
          aqi_bucket:  _routeData.shortest.aqi_bucket + ' (only route)',
        };
        _showSameRouteNote();
      }

      _renderTabSubtitles(_routeData);
      MapManager.drawRoutes(_routeData);
      _showRouteCards();
      selectRoute('shortest');   // always start highlighted on shortest

      const msg = _routeData.same_route
        ? '✅ Route found (only one path available for this trip)'
        : '✅ Both routes found — 🟢 green = cleaner air';
      Utils.toast(msg);

    } catch (e) {
      Utils.toast('❌ Route error: ' + e.message);
      console.error('Routing error:', e);
    } finally {
      _loading = false;
    }
  }

  // ── Select active route ───────────────────────
  function selectRoute(which) {
    if (!_routeData) return;
    _activeRoute = which;

    MapManager.highlightRoute(which);
    _updateDetailCard(_routeData[which]);

    // Tab button styles
    const btnS = document.getElementById('btn-shortest');
    const btnE = document.getElementById('btn-eco');
    if (btnS) btnS.className = 'route-btn' + (which === 'shortest' ? ' active blue-route'  : '');
    if (btnE) btnE.className = 'route-btn' + (which === 'eco'      ? ' active green-route' : '');

    // Mini header bar — uses correct ID 'header-mini'
    const state = Geocoding.getState();
    const oEl   = document.getElementById('mini-origin');
    const dEl   = document.getElementById('mini-dest');
    const mini  = document.getElementById('header-mini');
    if (oEl)  oEl.textContent   = (state.origin.name || '').split(',')[0] || '—';
    if (dEl)  dEl.textContent   = (state.dest.name   || '').split(',')[0] || '—';
    if (mini) mini.style.display = 'flex';
  }

  // ── Render tab subtitles ──────────────────────
  function _renderTabSubtitles(data) {
    const fmt = r => `${r.distance_str} · ${r.duration_str} · AQI ${r.avg_aqi}`;
    const subS = document.getElementById('sub-shortest');
    const subE = document.getElementById('sub-eco');
    if (subS) subS.textContent = fmt(data.shortest);
    if (subE) subE.textContent = fmt(data.eco);
  }

  // ── Detail card ───────────────────────────────
  function _updateDetailCard(route) {
    const dEl    = document.getElementById('stat-dist');
    const durEl  = document.getElementById('stat-dur');
    const aqiEl  = document.getElementById('stat-aqi');
    const badge  = document.getElementById('route-aqi-badge');

    if (dEl)   dEl.textContent   = route.distance_str;
    if (durEl) durEl.textContent = route.duration_str;
    if (aqiEl) {
      aqiEl.textContent = route.avg_aqi;
      aqiEl.style.color = route.aqi_color;
    }
    if (badge) {
      badge.textContent        = `● ${route.aqi_bucket}`;
      badge.style.cssText      = `
        background:${route.aqi_color}1a;
        color:${route.aqi_color};
        border:1px solid ${route.aqi_color}55;
        border-radius:20px;
        padding:3px 10px;
        font-size:12px;
        font-weight:600;
        display:inline-flex;
      `;
    }
  }

  // ── Show route cards ──────────────────────────
  function _showRouteCards() {
    const cards  = document.getElementById('route-cards');
    const acPanel = document.getElementById('autocomplete-panel');
    if (cards)   cards.style.display   = 'block';
    if (acPanel) acPanel.style.display = 'none';

    // Scroll sheet to show cards
    const sheet = document.getElementById('search-sheet');
    if (sheet) sheet.scrollTop = 0;
  }

  // ── Same-route note ───────────────────────────
  function _showSameRouteNote() {
    const ecoBtn = document.getElementById('btn-eco');
    if (ecoBtn) {
      const sub = ecoBtn.querySelector('.rbtn-sub');
      if (sub) sub.textContent = 'Same path — no alternative';
    }
  }

  // ── Public API ────────────────────────────────
  function getActiveRoute() { return _routeData ? _routeData[_activeRoute] : null; }
  function getActiveKey()   { return _activeRoute; }
  function getRouteData()   { return _routeData; }

  return { findRoutes, selectRoute, getActiveRoute, getActiveKey, getRouteData };
})();
