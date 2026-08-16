(() => {
  const API_BASE = 'http://127.0.0.1:2200';

  /* ---------------------------------------------------------
     Element refs
  --------------------------------------------------------- */
  const form          = document.getElementById('predictForm');
  const submitBtn      = document.getElementById('submitBtn');
  const errorBanner    = document.getElementById('errorBanner');

  const countrySelect  = document.getElementById('country');
  const countryOther   = document.getElementById('countryOther');
  const countryOtherField = document.getElementById('countryOtherField');

  const usageRange = document.getElementById('usage');
  const studyRange = document.getElementById('study');
  const activityRange = document.getElementById('activity');
  const sleepRange = document.getElementById('sleep');

  const gaugeWrap    = document.querySelector('.gauge-wrap');
  const needleGroup  = document.getElementById('needleGroup');
  const gaugeTicksEl = document.getElementById('gaugeTicks');

  const readoutIdle  = document.getElementById('readoutIdle');
  const readoutValue = document.getElementById('readoutValue');
  const readoutBand  = document.getElementById('readoutBand');
  const scoreNumber  = document.getElementById('scoreNumber');
  const resultDetail = document.getElementById('resultDetail');

  const connDot   = document.getElementById('connDot');
  const connLabel = document.getElementById('connLabel');

  /* ---------------------------------------------------------
     Segmented controls
  --------------------------------------------------------- */
  const segmentState = {
    gender: 'Male',
    academic_level: 'Undergraduate',
    stress_level: 'Medium',
  };

  document.querySelectorAll('.segmented').forEach((group) => {
    const name = group.dataset.name;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      group.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      segmentState[name] = btn.dataset.value;
    });
  });

  /* ---------------------------------------------------------
     Country "Other" toggle
  --------------------------------------------------------- */
  function syncCountryField() {
    const isOther = countrySelect.value === 'Other';
    countryOtherField.classList.toggle('is-disabled', !isOther);
    countryOther.required = isOther;
  }
  countrySelect.addEventListener('change', syncCountryField);
  syncCountryField();

  /* ---------------------------------------------------------
     Live slider readouts
  --------------------------------------------------------- */
  const sliderOutputs = [
    [usageRange,    document.getElementById('usageOut')],
    [studyRange,    document.getElementById('studyOut')],
    [activityRange, document.getElementById('activityOut')],
    [sleepRange,    document.getElementById('sleepOut')],
  ];
  sliderOutputs.forEach(([input, out]) => {
    const update = () => { out.textContent = `${parseFloat(input.value).toFixed(1)} h`; };
    input.addEventListener('input', update);
    update();
  });

  /* ---------------------------------------------------------
     Gauge: build tick marks (0..10, every 1 unit)
  --------------------------------------------------------- */
  const GAUGE_CX = 110, GAUGE_CY = 110, GAUGE_R_OUT = 90, GAUGE_R_IN = 78;
  function polar(cx, cy, r, angleDeg) {
    const a = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  for (let i = 0; i <= 10; i++) {
    const angle = -90 + (i / 10) * 180;
    const p1 = polar(GAUGE_CX, GAUGE_CY, GAUGE_R_OUT, angle);
    const p2 = polar(GAUGE_CX, GAUGE_CY, GAUGE_R_IN, angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x.toFixed(2));
    line.setAttribute('y1', p1.y.toFixed(2));
    line.setAttribute('x2', p2.x.toFixed(2));
    line.setAttribute('y2', p2.y.toFixed(2));
    gaugeTicksEl.appendChild(line);
  }

  function setNeedle(value) {
    const clamped = Math.max(0, Math.min(10, value));
    const deg = -90 + (clamped / 10) * 180;
    needleGroup.style.transform = `rotate(${deg}deg)`;
  }

  function bandForScore(value) {
    if (value <= 3.3) return { label: 'Lower range', color: 'var(--accent-mint)' };
    if (value <= 6.6) return { label: 'Mid range', color: 'var(--accent-amber)' };
    return { label: 'Upper range', color: 'var(--accent-coral)' };
  }

  /* ---------------------------------------------------------
     API connectivity indicator
  --------------------------------------------------------- */
  async function checkConnection() {
    try {
      const res = await fetch(`${API_BASE}/`, { method: 'GET' });
      if (res.ok) {
        connDot.classList.add('is-online');
        connDot.classList.remove('is-offline');
        connLabel.textContent = 'API online';
      } else {
        throw new Error('bad status');
      }
    } catch {
      connDot.classList.add('is-offline');
      connDot.classList.remove('is-online');
      connLabel.textContent = 'API unreachable';
    }
  }
  checkConnection();

  /* ---------------------------------------------------------
     Validation helpers
  --------------------------------------------------------- */
  function markInvalid(el, invalid) {
    el.classList.toggle('field-invalid', invalid);
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
  }
  function clearError() {
    errorBanner.hidden = true;
    errorBanner.textContent = '';
  }

  function buildPayload() {
    const ageEl = document.getElementById('age');
    const unlocksEl = document.getElementById('unlocks');
    [ageEl, unlocksEl, countryOther].forEach((el) => markInvalid(el, false));

    let country = countrySelect.value;
    if (country === 'Other') {
      country = countryOther.value.trim();
      if (!country) {
        markInvalid(countryOther, true);
        throw new Error('Please specify your country, or pick one from the list.');
      }
    }

    const age = parseInt(ageEl.value, 10);
    if (Number.isNaN(age) || age < 10 || age > 100) {
      markInvalid(ageEl, true);
      throw new Error('Age must be between 10 and 100.');
    }

    const dailyUnlocks = parseInt(unlocksEl.value, 10);
    if (Number.isNaN(dailyUnlocks) || dailyUnlocks < 0) {
      markInvalid(unlocksEl, true);
      throw new Error('Daily unlocks must be zero or more.');
    }

    return {
      age,
      gender: segmentState.gender,
      country,
      academic_level: segmentState.academic_level,
      most_used_platform: document.getElementById('platform').value,
      purpose_of_use: document.getElementById('purpose').value,
      avg_daily_usage_hours: parseFloat(usageRange.value),
      daily_unlocks: dailyUnlocks,
      study_hours: parseFloat(studyRange.value),
      physical_activity_hours: parseFloat(activityRange.value),
      sleep_hours_per_night: parseFloat(sleepRange.value),
      stress_level: segmentState.stress_level,
    };
  }

  /* ---------------------------------------------------------
     Submit
  --------------------------------------------------------- */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('is-loading', isLoading);
    gaugeWrap.classList.toggle('is-loading', isLoading);
  }

  function renderResult(score) {
    readoutIdle.hidden = true;
    readoutValue.hidden = false;
    readoutBand.hidden = false;
    resultDetail.hidden = false;

    scoreNumber.textContent = score.toFixed(2);
    const band = bandForScore(score);
    readoutBand.textContent = band.label;
    readoutBand.style.color = band.color;
    readoutBand.style.borderColor = band.color;

    setNeedle(score);
  }

  async function parseErrorResponse(res) {
    try {
      const data = await res.json();
      if (data && Array.isArray(data.detail)) {
        return data.detail
          .map((d) => {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : 'field';
            return `${field}: ${d.msg}`;
          })
          .join(' · ');
      }
      if (data && typeof data.detail === 'string') return data.detail;
      return `Request failed (${res.status}).`;
    } catch {
      return `Request failed (${res.status}).`;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    let payload;
    try {
      payload = buildPayload();
    } catch (validationErr) {
      showError(validationErr.message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const message = await parseErrorResponse(res);
        throw new Error(message);
      }

      const data = await res.json();
      renderResult(data.predicted_mental_health_score);
      connDot.classList.add('is-online');
      connDot.classList.remove('is-offline');
      connLabel.textContent = 'API online';
    } catch (err) {
      const isNetworkError = err instanceof TypeError;
      showError(
        isNetworkError
          ? `Can't reach the API at ${API_BASE}. Make sure uvicorn is running with --port 2200.`
          : err.message
      );
      if (isNetworkError) {
        connDot.classList.add('is-offline');
        connDot.classList.remove('is-online');
        connLabel.textContent = 'API unreachable';
      }
    } finally {
      setLoading(false);
    }
  });

  // initialize needle at rest position
  setNeedle(0);
  needleGroup.style.transform = 'rotate(-90deg)';
})();
