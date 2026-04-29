// ═══════════════════════════════════════════════
// EcoNav — Navigation Module v3 (fixed)
//
// • GPS watchPosition tracks you in real time
// • Map follows your dot automatically
// • Distance to next turn counts down live
// • Auto-announces turn at 80 m, advances at 30 m
// • Re-centre button when user pans
// • Voice (Web Speech API, en-IN)
// • Step list slides up on tap
// ═══════════════════════════════════════════════

const Navigation = (() => {

  const ANNOUNCE_M = 80;
  const ADVANCE_M  = 30;

  let _steps     = [];
  let _stepIndex = 0;
  let _active    = false;
  let _muted     = false;
  let _route     = null;
  let _stepsOpen = false;
  let _announced = new Set();
  let _userLat   = null;
  let _userLng   = null;

  const _synth = window.speechSynthesis;

  // ── Start ─────────────────────────────────────
  function start() {
    _route = Routing.getActiveRoute();

    if (!_route) {
      Utils.toast('⚠ Select a route first, then tap Start Navigation');
      return;
    }
    if (!_route.steps || _route.steps.length === 0) {
      Utils.toast('⚠ No turn-by-turn steps found for this route');
      return;
    }

    _steps     = _route.steps;
    _stepIndex = 0;
    _active    = true;
    _stepsOpen = false;
    _announced = new Set();

    // Show overlay (use flex, not block, so layout works)
    const overlay = document.getElementById('nav-overlay');
    if (overlay) overlay.style.display = 'block';

    // Hide search sheet
    const sheet = document.getElementById('search-sheet');
    if (sheet) sheet.classList.add('sheet-hidden');

    // Populate HUD
    _updateHUD();

    // Build and show first step
    _buildStepsList();
    _renderStep(0);
    _speak(`Starting navigation. ${_steps[0].instruction}`);

    // Start GPS — map will follow you
    MapManager.startGPSWatch(_onGPS);

    Utils.toast('🧭 Navigation started — map follows your GPS');
  }

  // ── Stop ──────────────────────────────────────
  function stop() {
    _active = false;
    MapManager.stopGPSWatch();
    MapManager.clearTurnMarker();
    if (_synth) _synth.cancel();

    const overlay = document.getElementById('nav-overlay');
    if (overlay) overlay.style.display = 'none';

    const sheet = document.getElementById('search-sheet');
    if (sheet) sheet.classList.remove('sheet-hidden');

    const recentreBtn = document.getElementById('recentre-btn');
    if (recentreBtn) recentreBtn.classList.remove('visible');

    Utils.toast('Navigation ended');
  }

  // ── GPS callback ──────────────────────────────
  function _onGPS({ lat, lng }) {
    if (!_active) return;
    _userLat = lat;
    _userLng = lng;

    const step = _steps[_stepIndex];
    if (!step) return;

    const dist = _haversine(lat, lng, step.lat, step.lng);

    // Live countdown on distance badge
    _setDistBadge(dist);

    // Show pulsing dot at the upcoming turn
    if (step.lat && step.lng) MapManager.setTurnMarker(step.lat, step.lng);

    // Announce when approaching
    if (dist < ANNOUNCE_M && !_announced.has(_stepIndex)) {
      _announced.add(_stepIndex);
      const distLabel = dist < 50
        ? 'now'
        : `in ${Math.round(dist / 10) * 10} metres`;
      _speak(`${distLabel}, ${step.instruction}`);
    }

    // Auto-advance past turn
    if (dist < ADVANCE_M) _advance();
  }

  function _advance() {
    if (_stepIndex + 1 < _steps.length) {
      _stepIndex++;
      _renderStep(_stepIndex);
      _speak(_steps[_stepIndex].instruction);
    } else {
      _speak('You have arrived at your destination. Navigation complete.');
      MapManager.clearTurnMarker();
      setTimeout(stop, 4500);
    }
  }

  // ── Render step ───────────────────────────────
  function _renderStep(idx) {
    const step = _steps[idx];
    const next = _steps[idx + 1];
    if (!step) return;

    const icon = Utils.maneuverIcon(step.type, step.modifier);

    const iconEl   = document.getElementById('nav-maneuver-icon');
    const instrEl  = document.getElementById('nav-instruction-text');
    const roadEl   = document.getElementById('nav-road-bar');
    const thenEl   = document.getElementById('nav-then-bar');
    const distEl   = document.getElementById('nav-dist-badge');

    if (iconEl)  iconEl.textContent  = icon;
    if (instrEl) instrEl.textContent = step.instruction;
    if (roadEl)  roadEl.textContent  = step.road ? `on ${step.road}` : '';
    if (distEl)  distEl.textContent  = step.distance_str;

    if (thenEl) {
      if (next) {
        const nextIcon = Utils.maneuverIcon(next.type, next.modifier);
        thenEl.textContent = `Then  ${nextIcon}  ${next.instruction}`;
      } else {
        thenEl.textContent = 'Then arrive at destination';
      }
    }

    // Progress bar
    const pct  = ((idx + 1) / _steps.length) * 100;
    const fill = document.getElementById('nav-progress-fill');
    if (fill) fill.style.width = pct + '%';

    // Highlight in step list
    document.querySelectorAll('.nav-step-item').forEach((el, i) => {
      const active = i === idx;
      el.classList.toggle('active', active);
      const iconEl2 = el.querySelector('.step-icon');
      if (iconEl2) iconEl2.classList.toggle('active-icon', active);
      if (active) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // ── Live distance countdown ───────────────────
  function _setDistBadge(metres) {
    const el = document.getElementById('nav-dist-badge');
    if (!el) return;
    if (metres === Infinity) return;
    el.textContent = metres >= 1000
      ? `${(metres / 1000).toFixed(1)} km`
      : `${Math.round(metres)} m`;
  }

  // ── HUD ───────────────────────────────────────
  function _updateHUD() {
    const dur    = document.getElementById('hud-duration-big');
    const dist   = document.getElementById('hud-dist');
    const eta    = document.getElementById('hud-eta');
    const aqi    = document.getElementById('hud-aqi');
    const bucket = document.getElementById('hud-aqi-bucket');

    if (dur)    { dur.textContent   = _route.duration_str; }
    if (dist)   { dist.textContent  = _route.distance_str; }
    if (eta)    { eta.textContent   = Utils.calcETA(_route.duration); }
    if (aqi)    { aqi.textContent   = `AQI ${_route.avg_aqi}`;  aqi.style.color   = _route.aqi_color; }
    if (bucket) { bucket.textContent = `· ${_route.aqi_bucket}`; bucket.style.color = _route.aqi_color; }
  }

  // ── Build step list ───────────────────────────
  function _buildStepsList() {
    const list = document.getElementById('nav-steps-list');
    if (!list) return;
    list.innerHTML = '';

    _steps.forEach((step, i) => {
      const icon = Utils.maneuverIcon(step.type, step.modifier);
      const div  = document.createElement('div');
      div.className = 'nav-step-item' + (i === 0 ? ' active' : '');
      div.innerHTML = `
        <div class="step-icon${i === 0 ? ' active-icon' : ''}">${icon}</div>
        <div class="step-text">${step.instruction}</div>
        <div class="step-dist">${step.distance_str}</div>`;
      div.addEventListener('click', () => {
        _stepIndex = i;
        _renderStep(i);
        _speak(step.instruction);
      });
      list.appendChild(div);
    });
  }

  // ── Voice ─────────────────────────────────────
  function _speak(text) {
    if (!_synth || _muted || !text) return;
    _synth.cancel();
    const utt    = new SpeechSynthesisUtterance(text);
    utt.lang     = 'en-IN';
    utt.rate     = 0.88;
    utt.pitch    = 1.0;
    utt.volume   = 1.0;
    const btn    = document.getElementById('nav-voice-btn');
    utt.onstart  = () => btn?.classList.add('speaking');
    utt.onend    = () => btn?.classList.remove('speaking');
    _synth.speak(utt);
  }

  function toggleMute() {
    _muted = !_muted;
    const btn = document.getElementById('nav-voice-btn');
    if (btn) {
      btn.textContent = _muted ? '🔇' : '🔊';
      btn.classList.toggle('muted', _muted);
    }
    if (_muted) {
      _synth?.cancel();
    } else if (_steps[_stepIndex]) {
      _speak(_steps[_stepIndex].instruction);
    }
  }

  // ── Step panel ────────────────────────────────
  function toggleSteps() {
    _stepsOpen = !_stepsOpen;
    const panel = document.getElementById('nav-steps-panel');
    if (panel) panel.classList.toggle('open', _stepsOpen);
  }

  // ── Re-centre ─────────────────────────────────
  function recentreOnUser() {
    if (_userLat !== null) MapManager.recentre(_userLat, _userLng);
  }

  // ── Haversine ─────────────────────────────────
  function _haversine(lat1, lng1, lat2, lng2) {
    if (!lat2 || !lng2) return Infinity;
    const R  = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Manual prev/next ──────────────────────────
  function nextStep() {
    if (_stepIndex + 1 < _steps.length) {
      _stepIndex++;
      _renderStep(_stepIndex);
      _speak(_steps[_stepIndex].instruction);
    } else {
      stop();
    }
  }

  function prevStep() {
    if (_stepIndex > 0) {
      _stepIndex--;
      _renderStep(_stepIndex);
      _speak(_steps[_stepIndex].instruction);
    }
  }

  // ── Keyboard shortcuts ─────────────────────────
  document.addEventListener('keydown', e => {
    if (!_active) return;
    if (e.code === 'Space' || e.code === 'ArrowRight') { e.preventDefault(); nextStep(); }
    else if (e.code === 'ArrowLeft') prevStep();
    else if (e.code === 'Escape')    stop();
  });

  return {
    start, stop,
    toggleMute, toggleSteps,
    recentreOnUser, nextStep, prevStep,
    isActive: () => _active,
  };
})();
