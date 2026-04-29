// ═══════════════════════════════════════════════
// EcoNav — Geocoding & Autocomplete
// Uses Nominatim directly from browser (no proxy)
// to avoid empty-response issues with server relay.
// ═══════════════════════════════════════════════

const Geocoding = (() => {

  // Active input context: 'origin' | 'dest'
  let _activeInput = null;

  const _state = {
    origin: { coords: null, name: '' },
    dest:   { coords: null, name: '' },
  };

  // ── Nominatim search ─────────────────────────
  async function search(query) {
    const params = new URLSearchParams({
      q:              query,
      format:         'jsonv2',
      limit:          String(Config.AUTOCOMPLETE.maxResults),
      addressdetails: '1',
    });

    try {
      const res = await fetch(`${Config.NOMINATIM_URL}?${params}`, {
        headers: {
          'Accept':          'application/json',
          'Accept-Language': 'en',
        },
      });

      if (!res.ok) return [];
      const text = await res.text();
      if (!text || text.trim() === '') return [];
      return JSON.parse(text);
    } catch (e) {
      console.warn('Nominatim error:', e);
      return [];
    }
  }

  // ── Render autocomplete list ─────────────────
  function renderList(results, targetKey) {
    const panel = document.getElementById('autocomplete-panel');
    const list  = document.getElementById('autocomplete-list');
    list.innerHTML = '';

    if (!results.length) {
      panel.style.display = 'none';
      return;
    }

    results.forEach((item, i) => {
      const parts  = item.display_name.split(',');
      const name   = parts[0].trim();
      const sub    = parts.slice(1, 3).join(',').trim();
      const icon   = iconForType(item.type, item.category);

      const div = document.createElement('div');
      div.className = 'ac-item';
      div.tabIndex  = 0;
      div.innerHTML = `
        <div class="ac-icon">${icon}</div>
        <div>
          <div class="ac-name">${name}</div>
          <div class="ac-sub">${sub}</div>
        </div>`;

      div.addEventListener('click', () => {
        selectPlace(targetKey, {
          lat:  parseFloat(item.lat),
          lng:  parseFloat(item.lon),
          name: `${name}, ${sub}`,
        });
      });

      list.appendChild(div);
    });

    panel.style.display = 'block';
  }

  function iconForType(type, category) {
    const map = {
      city: '🏙', town: '🏘', village: '🌿', suburb: '🏠',
      amenity: '📍', road: '🛣', street: '🛣', highway: '🛣',
      restaurant: '🍽', hospital: '🏥', school: '🏫',
      station: '🚉', airport: '✈', park: '🌳',
    };
    return map[type] || map[category] || '📍';
  }

  // ── Select a place ───────────────────────────
  function selectPlace(key, place) {
    _state[key] = { coords: { lat: place.lat, lng: place.lng }, name: place.name };

    const inputId = key === 'origin' ? 'origin-input' : 'dest-input';
    document.getElementById(inputId).value = place.name;
    document.getElementById('autocomplete-panel').style.display = 'none';

    if (key === 'origin') {
      MapManager.setOriginMarker(place.lat, place.lng, '');
      MapManager.panTo(place.lat, place.lng, 14);
      // Fetch AQI for origin
      fetchAndUpdateHeaderAQI(place.lat, place.lng);
    } else {
      MapManager.setDestMarker(place.lat, place.lng, '');
    }

    // If both set, trigger route search automatically
    if (_state.origin.coords && _state.dest.coords) {
      Routing.findRoutes(_state.origin.coords, _state.dest.coords);
    }
  }

  // ── Geolocation ──────────────────────────────
  async function useMyLocation() {
    if (!navigator.geolocation) {
      Utils.toast('⚠ Geolocation not supported by your browser');
      return;
    }

    const input = document.getElementById('origin-input');
    input.value = '📡 Getting your location…';
    input.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        input.disabled = false;

        // Reverse geocode to get address
        let name = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`,
            { headers: { 'Accept': 'application/json', 'Accept-Language': 'en' } }
          );
          const d = await res.json();
          if (d.display_name) {
            const parts = d.display_name.split(',');
            name = parts.slice(0, 3).join(',').trim();
          }
        } catch (_) {}

        input.value = name;
        selectPlace('origin', { lat, lng, name });
        MapManager.setUserMarker(lat, lng);
        MapManager.panTo(lat, lng, 14);
        fetchAndUpdateHeaderAQI(lat, lng);
      },
      (err) => {
        input.disabled = false;
        input.value = '';
        const msgs = {
          1: 'Location permission denied. Please allow location access.',
          2: 'Position unavailable. Check your connection.',
          3: 'Location request timed out.',
        };
        Utils.toast('⚠ ' + (msgs[err.code] || 'Could not get location'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  // ── Fetch + update header AQI ─────────────────
  async function fetchAndUpdateHeaderAQI(lat, lng) {
    try {
      const res = await fetch(Config.ENDPOINTS.liveAqi(lat, lng));
      if (!res.ok) return;
      const d = await res.json();
      if (d.aqi == null) return;

      const dot  = document.getElementById('header-aqi-dot');
      const text = document.getElementById('header-aqi-text');
      if (dot && text) {
        dot.style.background  = d.aqi_color;
        text.textContent       = `AQI ${Math.round(d.aqi)} · ${d.aqi_bucket}`;
        text.style.color       = d.aqi_color;
        document.getElementById('header-aqi-pill').style.borderColor = d.aqi_color + '44';
      }
    } catch (_) {}
  }

  // ── Setup input event listeners ───────────────
  function setupInput(inputId, key) {
    const input = document.getElementById(inputId);
    const debouncedSearch = Utils.debounce(async (q) => {
      if (q.length < Config.AUTOCOMPLETE.minChars) {
        document.getElementById('autocomplete-panel').style.display = 'none';
        return;
      }
      _activeInput = key;
      const results = await search(q);
      if (_activeInput === key) renderList(results, key);
    }, Config.AUTOCOMPLETE.debounceMs);

    input.addEventListener('input', e => debouncedSearch(e.target.value.trim()));
    input.addEventListener('focus', () => { _activeInput = key; });
  }

  // ── Public API ────────────────────────────────
  function getState() { return _state; }

  function setOriginCoords(lat, lng, name) {
    selectPlace('origin', { lat, lng, name });
  }

  return {
    setup() {
      setupInput('origin-input', 'origin');
      setupInput('dest-input',   'dest');
      document.getElementById('use-location-btn')
              .addEventListener('click', useMyLocation);

      // Close autocomplete on outside click
      document.addEventListener('click', e => {
        const panel = document.getElementById('autocomplete-panel');
        if (!document.getElementById('search-sheet').contains(e.target)) {
          panel.style.display = 'none';
        }
      });

      // Initial location detection
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            const { latitude: lat, longitude: lng } = pos.coords;
            MapManager.setUserMarker(lat, lng);
            MapManager.panTo(lat, lng, 13);
            fetchAndUpdateHeaderAQI(lat, lng);
          },
          () => {}
        );
      }
    },
    getState,
    fetchAndUpdateHeaderAQI,
    setOriginCoords,
    useMyLocation,
  };
})();
