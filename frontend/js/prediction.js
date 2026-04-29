// ═══════════════════════════════════════════════
// EcoNav — AQI Prediction Panel
// ═══════════════════════════════════════════════

const Prediction = (() => {

  const CITIES = [
    'Ahmedabad','Aizawl','Amaravati','Amritsar','Bengaluru','Bhopal',
    'Brajrajnagar','Chennai','Coimbatore','Delhi','Ernakulam','Gurugram',
    'Guwahati','Hyderabad','Jaipur','Jorapokhar','Kochi','Kolkata',
    'Lucknow','Mumbai','Nagpur','Patna','Pune','Shillong','Surat',
    'Talcher','Thiruvananthapuram','Visakhapatnam',
  ];

  // ── Inject prediction form into the panel ────
  function init() {
    const container = document.getElementById('pred-panel');
    if (!container) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const cityOptions = CITIES.map(c =>
      `<option${c === 'Bengaluru' ? ' selected' : ''}>${c}</option>`
    ).join('');

    container.innerHTML = `
      <div class="pred-form">
        <div class="form-row">
          <div class="form-field">
            <label>City</label>
            <select id="pred-city">${cityOptions}</select>
          </div>
          <div class="form-field">
            <label>Date</label>
            <input type="date" id="pred-date" value="${tomorrowStr}" />
          </div>
        </div>

        <div style="font-size:11px;color:var(--text2);line-height:1.5">
          Optional — fill for higher accuracy:
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>PM2.5 µg/m³</label>
            <input type="number" id="pred-pm25" placeholder="auto" step="0.1" min="0" />
          </div>
          <div class="form-field">
            <label>PM10 µg/m³</label>
            <input type="number" id="pred-pm10" placeholder="auto" step="0.1" min="0" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>NO₂ µg/m³</label>
            <input type="number" id="pred-no2" placeholder="auto" step="0.1" min="0" />
          </div>
          <div class="form-field">
            <label>CO mg/m³</label>
            <input type="number" id="pred-co" placeholder="auto" step="0.01" min="0" />
          </div>
        </div>

        <button class="pred-btn" id="pred-submit-btn">
          <span id="pred-btn-label">🔮 Predict Next-Day AQI</span>
        </button>

        <div class="pred-result" id="pred-result">
          <div class="pred-aqi-big" id="pred-aqi-num">—</div>
          <div class="pred-bucket-label" id="pred-bucket-lbl"></div>
          <div class="pred-date-lbl"    id="pred-date-lbl"></div>
          <div class="pred-advice"      id="pred-advice-text"></div>
        </div>
      </div>
    `;

    document.getElementById('pred-submit-btn')
            .addEventListener('click', run);
  }

  // ── Run prediction ────────────────────────────
  async function run() {
    const btn   = document.getElementById('pred-submit-btn');
    const label = document.getElementById('pred-btn-label');
    label.innerHTML = '<span class="spinner"></span> Predicting…';
    btn.disabled    = true;

    const body = {
      city:    document.getElementById('pred-city').value,
      date:    document.getElementById('pred-date').value || undefined,
      pm25:    parseNum('pred-pm25'),
      pm10:    parseNum('pred-pm10'),
      no2:     parseNum('pred-no2'),
      co:      parseNum('pred-co'),
    };

    try {
      const res = await fetch(Config.ENDPOINTS.predict(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Prediction failed');

      // Update city list from model's known cities
      if (d.available_cities?.length) {
        const sel = document.getElementById('pred-city');
        sel.innerHTML = d.available_cities.map(c =>
          `<option${c === body.city ? ' selected' : ''}>${c}</option>`
        ).join('');
      }

      showResult(d);
    } catch (e) {
      Utils.toast('❌ ' + e.message);
    } finally {
      label.textContent = '🔮 Predict Next-Day AQI';
      btn.disabled      = false;
    }
  }

  // ── Show result ───────────────────────────────
  function showResult(d) {
    const resultEl = document.getElementById('pred-result');
    resultEl.classList.add('visible');
    resultEl.style.background   = d.aqi_color + '18';
    resultEl.style.borderColor  = d.aqi_color + '44';

    const num = document.getElementById('pred-aqi-num');
    num.textContent  = Math.round(d.predicted_aqi);
    num.style.color  = d.aqi_color;

    document.getElementById('pred-bucket-lbl').textContent  = d.aqi_bucket;
    document.getElementById('pred-bucket-lbl').style.color  = d.aqi_color;
    document.getElementById('pred-date-lbl').textContent    = `Forecast for ${d.prediction_date}`;
    document.getElementById('pred-advice-text').textContent = d.health_advice;
  }

  function parseNum(id) {
    const v = document.getElementById(id)?.value?.trim();
    return v ? parseFloat(v) : null;
  }

  return { init, run };
})();

// Global toggle for the panel
function togglePredPanel() {
  const panel   = document.getElementById('pred-panel');
  const chevron = document.getElementById('pred-chevron');
  const open    = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  chevron.classList.toggle('open', !open);
}
