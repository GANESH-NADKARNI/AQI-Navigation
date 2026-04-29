// ═══════════════════════════════════════════════
// EcoNav v3 — App Entry Point
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  // 1. Map
  MapManager.init();

  // 2. Geocoding + autocomplete
  Geocoding.setup();

  // 3. Prediction panel
  Prediction.init();

  // 4. Route tab buttons
  document.getElementById('btn-shortest')
          .addEventListener('click', () => Routing.selectRoute('shortest'));
  document.getElementById('btn-eco')
          .addEventListener('click', () => Routing.selectRoute('eco'));

  // 5. Start navigation
  document.getElementById('go-btn')
          .addEventListener('click', () => Navigation.start());

  // 6. Clear destination
  document.getElementById('clear-dest-btn').addEventListener('click', () => {
    document.getElementById('dest-input').value = '';
    document.getElementById('route-cards').style.display = 'none';
    document.getElementById('header-mini').style.display = 'none';
    MapManager.clearRoutes();
    const s = Geocoding.getState();
    s.dest = { coords: null, name: '' };
  });

  // 7. Route switch button inside nav overlay
  document.getElementById('nav-route-switch-btn')?.addEventListener('click', () => {
    const current = Routing.getActiveKey();
    const next    = current === 'shortest' ? 'eco' : 'shortest';
    Routing.selectRoute(next);
    // Re-draw the active route highlighted
    if (Navigation.isActive()) {
      // Restart navigation on the new route
      Navigation.stop();
      setTimeout(() => Navigation.start(), 300);
    }
    Utils.toast(`Switched to ${next === 'eco' ? '🟢 Clean Air' : '🔵 Shortest'} route`);
  });

  // 8. Model health check
  try {
    const res = await fetch(Config.ENDPOINTS.health());
    const d   = await res.json();
    const el  = document.getElementById('model-badge');
    if (d.model_loaded) {
      const m = d.model_meta || {};
      el.title       = `${m.model_type || 'Model'} · R²=${m.r2 || '?'} · MAE=${m.mae || '?'}`;
      el.textContent = '✅';
      el.classList.add('loaded');
    } else {
      el.title       = 'Model not loaded — run: python ml/train.py';
      el.textContent = '⚠';
    }
  } catch {
    const el = document.getElementById('model-badge');
    el.title       = 'API offline — start: uvicorn app:app --reload';
    el.textContent = '🔴';
  }
});
