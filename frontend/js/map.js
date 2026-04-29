// ═══════════════════════════════════════════════
// EcoNav — Map Module v3 (fixed)
// ═══════════════════════════════════════════════

const MapManager = (() => {

  let _map          = null;
  let _layers       = {};
  let _markers      = {};
  let _centreOnUser = true;
  let _watchId      = null;
  let _onGpsUpdate  = null;

  // ── Init ─────────────────────────────────────
  function init() {
    _map = L.map('map', {
      center:             Config.MAP.defaultCenter,
      zoom:               Config.MAP.defaultZoom,
      zoomControl:        false,
      attributionControl: true,
    });

    L.tileLayer(Config.MAP.tileUrl, {
      attribution: Config.MAP.tileAttrib,
      maxZoom: 19,
    }).addTo(_map);

    L.control.zoom({ position: 'bottomright' }).addTo(_map);

    // Named layer groups — ORDER MATTERS for z-index
    _layers.ecoLine      = L.featureGroup().addTo(_map);  // drawn first = below
    _layers.shortestLine = L.featureGroup().addTo(_map);  // drawn second = above
    _layers.aqiDots      = L.featureGroup().addTo(_map);  // AQI dots on top of lines
    _layers.navMarker    = L.featureGroup().addTo(_map);  // pulsing turn marker

    // Release re-centre lock on manual pan
    _map.on('dragstart', () => {
      _centreOnUser = false;
      const btn = document.getElementById('recentre-btn');
      if (btn) btn.classList.add('visible');
    });

    return _map;
  }

  // ── GPS watch ─────────────────────────────────
  function startGPSWatch(callback) {
    _onGpsUpdate = callback;
    if (!navigator.geolocation) {
      Utils.toast('⚠ Geolocation not available in this browser');
      return;
    }
    _watchId = navigator.geolocation.watchPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy || 20;
        const hdg = pos.coords.heading  || 0;

        _updateUserDot(lat, lng, hdg, acc);

        if (_centreOnUser) {
          _map.setView([lat, lng], _map.getZoom(), { animate: true, duration: 0.4 });
        }

        if (_onGpsUpdate) _onGpsUpdate({ lat, lng, heading: hdg, accuracy: acc });
      },
      err => console.warn('GPS watch error:', err.message),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 10000 }
    );
  }

  function stopGPSWatch() {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }
  }

  function recentre(lat, lng) {
    _centreOnUser = true;
    const btn = document.getElementById('recentre-btn');
    if (btn) btn.classList.remove('visible');
    _map.setView([lat, lng], 17, { animate: true, duration: 0.5 });
  }

  // ── User dot with heading cone ────────────────
  function _updateUserDot(lat, lng, heading, accuracy) {
    // Accuracy halo
    if (_markers.accCircle) {
      _markers.accCircle.setLatLng([lat, lng]).setRadius(accuracy);
    } else {
      _markers.accCircle = L.circle([lat, lng], {
        radius: accuracy, color: 'transparent',
        fillColor: '#3b82f6', fillOpacity: 0.13, weight: 0,
      }).addTo(_map);
    }

    const icon = L.divIcon({
      className: '',
      html: `<div class="user-dot-wrap">
               <div class="heading-cone" style="transform:rotate(${heading}deg)"></div>
               <div class="user-dot-inner"></div>
             </div>`,
      iconSize: [48, 48], iconAnchor: [24, 24],
    });

    if (_markers.user) {
      _markers.user.setLatLng([lat, lng]).setIcon(icon);
    } else {
      _markers.user = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(_map);
    }
  }

  // ── Route drawing ─────────────────────────────
  function drawRoutes(data) {
    clearRoutes();

    const sCoords = Utils.geoJsonToLatLng(data.shortest.geometry);
    const eCoords = Utils.geoJsonToLatLng(data.eco.geometry);

    // ── Eco route — green dashed (drawn first = below)
    L.polyline(eCoords, {
      color:      '#22c55e',
      weight:     7,
      opacity:    0.65,
      dashArray:  '12, 7',
      lineCap:    'round',
      lineJoin:   'round',
    }).addTo(_layers.ecoLine);

    // ── Shortest route — blue solid (drawn on top)
    L.polyline(sCoords, {
      color:    '#3b82f6',
      weight:   7,
      opacity:  0.90,
      lineCap:  'round',
      lineJoin: 'round',
    }).addTo(_layers.shortestLine);

    // ── AQI dots — on BOTH routes so user sees them
    //    Use eco samples for eco route dots
    if (data.eco.aqi_samples) {
      data.eco.aqi_samples.forEach(s => {
        if (s.aqi == null) return;
        _makeAqiDot(s.lat, s.lng, s.aqi, 'eco');
      });
    }
    //    Use shortest samples too (if backend provides them)
    if (data.shortest.aqi_samples) {
      data.shortest.aqi_samples.forEach(s => {
        if (s.aqi == null) return;
        _makeAqiDot(s.lat, s.lng, s.aqi, 'shortest');
      });
    }

    // Fit both routes in view
    const allCoords = [...sCoords, ...eCoords];
    _map.fitBounds(L.latLngBounds(allCoords).pad(0.15));
  }

  function _makeAqiDot(lat, lng, aqi, routeType) {
    const color = Utils.aqiColor(aqi);
    const size  = routeType === 'eco' ? 14 : 12;
    const icon  = L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px; height:${size}px; border-radius:50%;
        background:${color};
        border:2px solid rgba(255,255,255,0.85);
        box-shadow:0 1px 5px rgba(0,0,0,0.5);
      "></div>`,
      iconSize: [size, size], iconAnchor: [size/2, size/2],
    });

    const marker = L.marker([lat, lng], { icon, zIndexOffset: 200 })
      .addTo(_layers.aqiDots);

    marker.bindPopup(
      `<div style="font-family:sans-serif;font-size:13px;color:#222;min-width:100px">
         <b style="color:${color}">AQI: ${Math.round(aqi)}</b><br>
         <span>${Utils.aqiBucket(aqi)}</span><br>
         <span style="font-size:10px;color:#888">${routeType === 'eco' ? '🟢 Clean Air route' : '🔵 Shortest route'}</span>
       </div>`,
      { closeButton: false, autoPan: false }
    );
  }

  // ── Highlight active route ────────────────────
  function highlightRoute(which) {
    // Active route: full opacity, thicker
    // Inactive route: faded but still visible
    _layers.shortestLine.eachLayer(l => l.setStyle({
      opacity: which === 'shortest' ? 0.95 : 0.30,
      weight:  which === 'shortest' ? 8    : 5,
    }));
    _layers.ecoLine.eachLayer(l => l.setStyle({
      opacity: which === 'eco' ? 0.95 : 0.30,
      weight:  which === 'eco' ? 8    : 5,
    }));
  }

  function clearRoutes() {
    _layers.ecoLine.clearLayers();
    _layers.shortestLine.clearLayers();
    _layers.aqiDots.clearLayers();
    _layers.navMarker.clearLayers();
  }

  // ── Pulsing turn marker ───────────────────────
  function setTurnMarker(lat, lng) {
    _layers.navMarker.clearLayers();
    const icon = L.divIcon({
      className: '',
      html: `<div class="turn-pulse-outer"><div class="turn-pulse-inner"></div></div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
    L.marker([lat, lng], { icon, zIndexOffset: 900 }).addTo(_layers.navMarker);
  }

  function clearTurnMarker() { _layers.navMarker.clearLayers(); }

  // ── Pin markers ───────────────────────────────
  function _pinIcon(color, emoji) {
    return L.divIcon({
      className: '',
      html: `<div class="eco-marker" style="background:${color}"><span>${emoji}</span></div>`,
      iconSize: [36, 36], iconAnchor: [18, 36],
    });
  }

  function setOriginMarker(lat, lng) {
    if (_markers.origin) _map.removeLayer(_markers.origin);
    _markers.origin = L.marker([lat, lng], { icon: _pinIcon('#3b82f6', '📍') }).addTo(_map);
  }

  function setDestMarker(lat, lng) {
    if (_markers.dest) _map.removeLayer(_markers.dest);
    _markers.dest = L.marker([lat, lng], { icon: _pinIcon('#22c55e', '🏁') }).addTo(_map);
  }

  function setUserMarker(lat, lng) {
    _updateUserDot(lat, lng, 0, 20);
  }

  function panTo(lat, lng, zoom) {
    _map.setView([lat, lng], zoom || _map.getZoom(), { animate: true });
  }

  return {
    init,
    drawRoutes, highlightRoute, clearRoutes,
    setOriginMarker, setDestMarker, setUserMarker,
    setTurnMarker, clearTurnMarker,
    startGPSWatch, stopGPSWatch, recentre,
    panTo, getMap: () => _map,
    setCentred: v => { _centreOnUser = v; },
  };
})();
