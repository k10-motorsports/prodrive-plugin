// Datastream renderer

  // ═══════════════════════════════════════════════════════════════
  //  DATASTREAM RENDERER
  // ═══════════════════════════════════════════════════════════════

  const _dsCanvas = document.getElementById('dsGforceCanvas');
  const _dsCtx = _dsCanvas ? _dsCanvas.getContext('2d') : null;
  let _dsPeakG = 0;
  const _dsTrailLen = 40;
  const _dsTrailLat = new Float32Array(_dsTrailLen);
  const _dsTrailLong = new Float32Array(_dsTrailLen);
  let _dsTrailIdx = 0;
  let _dsTrailCount = 0;
  let _dsAbsFlash = 0;

  // Yaw trail — ring buffer of recent yaw rate samples for waveform display
  const _yawTrailLen = 80;
  const _yawTrail = new Float32Array(_yawTrailLen);
  let _yawTrailIdx = 0;
  let _yawTrailCount = 0;
  const _yawTrailCanvas = document.getElementById('dsYawTrail');
  const _yawTrailCtx = _yawTrailCanvas ? _yawTrailCanvas.getContext('2d') : null;

  function renderYawTrail(yawRate) {
    // Store sample
    _yawTrail[_yawTrailIdx] = yawRate;
    _yawTrailIdx = (_yawTrailIdx + 1) % _yawTrailLen;
    _yawTrailCount++;

    if (!_yawTrailCtx) return;
    const c = _yawTrailCanvas;
    const w = c.width, h = c.height;
    const ctx = _yawTrailCtx;
    ctx.clearRect(0, 0, w, h);

    const count = Math.min(_yawTrailCount, _yawTrailLen);
    if (count < 2) return;

    const maxYaw = 1.5; // max expected yaw rate
    const mid = h / 2;

    // Draw filled waveform — left=oldest, right=newest
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < count; i++) {
      const idx = (_yawTrailIdx - count + i + _yawTrailLen) % _yawTrailLen;
      const x = (i / (count - 1)) * w;
      const val = _yawTrail[idx];
      const y = mid - (val / maxYaw) * (mid - 2);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Close to baseline on right, sweep back along baseline
    ctx.lineTo(w, mid);
    ctx.closePath();

    // Gradient fill: newest edge is bright, oldest fades out
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const absYaw = Math.abs(yawRate);
    const hue = Math.max(0, 210 - absYaw * 120);
    grad.addColorStop(0, `hsla(${hue}, 60%, 50%, 0.02)`);
    grad.addColorStop(0.7, `hsla(${hue}, 65%, 50%, 0.15)`);
    grad.addColorStop(1, `hsla(${hue}, 70%, 55%, 0.35)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke the waveform line
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const idx = (_yawTrailIdx - count + i + _yawTrailLen) % _yawTrailLen;
      const x = (i / (count - 1)) * w;
      const val = _yawTrail[idx];
      const y = mid - (val / maxYaw) * (mid - 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
    strokeGrad.addColorStop(0, `hsla(${hue}, 60%, 55%, 0.05)`);
    strokeGrad.addColorStop(0.8, `hsla(${hue}, 70%, 55%, 0.3)`);
    strokeGrad.addColorStop(1, `hsla(${hue}, 75%, 60%, 0.6)`);
    ctx.strokeStyle = strokeGrad;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Center line (zero yaw reference)
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.strokeStyle = 'hsla(0, 0%, 100%, 0.06)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  let _dsTcFlash = 0;
  let _dsPrevTrackTemp = 0;
  let _dsPrevIncidents = -1;
  let _dsPrevDeltaSign = 0;  // -1, 0, 1

  function dsFlash(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('ds-flash');
    void el.offsetWidth;
    el.classList.add('ds-flash');
  }

  function drawGforceDiamond(latG, longG) {
    if (!_dsCtx) return;
    const c = _dsCanvas;
    const dpr = window.devicePixelRatio || 1;
    const cssW = 64, cssH = 64;
    c.width = cssW * dpr;
    c.height = cssH * dpr;
    const ctx = _dsCtx;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const cx = cssW / 2, cy = cssH / 2;
    const maxG = 3.0;  // full scale
    const r = 28;       // diamond radius in px

    // Diamond outline (rotated square)
    ctx.strokeStyle = 'hsla(0,0%,100%,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.stroke();

    // Inner grid lines (crosshair)
    ctx.strokeStyle = 'hsla(0,0%,100%,0.04)';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Half-diamond
    ctx.strokeStyle = 'hsla(0,0%,100%,0.03)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r/2);
    ctx.lineTo(cx + r/2, cy);
    ctx.lineTo(cx, cy + r/2);
    ctx.lineTo(cx - r/2, cy);
    ctx.closePath();
    ctx.stroke();

    // G-force trail
    if (_dsTrailCount > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'hsla(210,60%,55%,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < Math.min(_dsTrailCount, _dsTrailLen); i++) {
        const idx = (_dsTrailIdx - 1 - i + _dsTrailLen) % _dsTrailLen;
        const px = cx + (_dsTrailLat[idx] / maxG) * r;
        const py = cy - (_dsTrailLong[idx] / maxG) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Store trail
    _dsTrailLat[_dsTrailIdx] = latG;
    _dsTrailLong[_dsTrailIdx] = longG;
    _dsTrailIdx = (_dsTrailIdx + 1) % _dsTrailLen;
    _dsTrailCount++;

    // Current G dot
    let dotX = cx + (latG / maxG) * r;
    let dotY = cy - (longG / maxG) * r;
    const totalG = Math.sqrt(latG * latG + longG * longG);

    // Check if dot is within diamond boundary
    // Diamond boundary: |dotX - cx|/r + |dotY - cy|/r <= 1
    const dx = Math.abs(dotX - cx);
    const dy = Math.abs(dotY - cy);
    const distanceFactor = dx / r + dy / r;
    let isClamped = false;
    let clampRatio = 0;

    if (distanceFactor > 1) {
      isClamped = true;
      // How far past the boundary (0 to infinity, where 1 = at boundary)
      clampRatio = Math.min((distanceFactor - 1) / (distanceFactor - 1), 1);

      // Project to nearest point on diamond edge
      // Scale the vector from center toward the dot to land on the boundary
      const signX = dotX >= cx ? 1 : -1;
      const signY = dotY >= cy ? 1 : -1;
      dotX = cx + signX * (r * Math.abs(dotX - cx)) / (dx + dy);
      dotY = cy - signY * (r * Math.abs(dotY - cy)) / (dx + dy);

      // Clamp to actual boundary more precisely
      // Recalculate to ensure we're exactly on the edge
      const newDx = Math.abs(dotX - cx);
      const newDy = Math.abs(dotY - cy);
      const scale = 1 / ((newDx + newDy) / r);
      if (scale < 1) {
        dotX = cx + (dotX - cx) * scale;
        dotY = cy + (dotY - cy) * scale;
      }
    }

    // Dot color: blue at low G, shifts toward red/orange at high G
    const hue = Math.max(0, 210 - totalG * 50);
    let lum = 55 + totalG * 5;

    // When clamped, boost luminosity by up to 20%
    if (isClamped) {
      lum = Math.min(lum + 20, 95);
    }

    ctx.fillStyle = `hsl(${hue},70%,${lum}%)`;
    ctx.beginPath();

    // Dot radius: 2.5 base, up to 5.0 when clamped
    let dotRadius = 2.5;
    if (isClamped) {
      dotRadius = 2.5 + (5.0 - 2.5) * clampRatio;
    }

    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.fillStyle = `hsla(${hue},70%,${lum}%,0.25)`;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function updateDatastream(p, isDemo) {
    const pre = isDemo ? 'K10MediaBroadcaster.Plugin.Demo.DS.' : 'K10MediaBroadcaster.Plugin.DS.';
    const vd = (key) => +p[pre + key] || 0;

    const latG = vd('LatG');
    const longG = vd('LongG');
    const yawRate = vd('YawRate');
    const steerTorque = vd('SteerTorque');
    const trackTemp = vd('TrackTemp');
    const incidentCount = vd('IncidentCount');
    const absActive = vd('AbsActive') > 0;
    const tcActive = vd('TcActive') > 0;
    const lapDelta = vd('LapDelta');

    // G-force diamond
    drawGforceDiamond(latG, longG);

    // Lat/Long G values
    const latEl = document.getElementById('dsLatG');
    const longEl = document.getElementById('dsLongG');
    if (latEl) latEl.textContent = Math.abs(latG).toFixed(2) + 'g';
    if (longEl) longEl.textContent = Math.abs(longG).toFixed(2) + 'g';

    // Peak G tracking
    const totalG = Math.sqrt(latG * latG + longG * longG);
    const wasNewPeak = totalG > _dsPeakG && _dsPeakG > 0;
    if (totalG > _dsPeakG) _dsPeakG = totalG;
    const peakEl = document.getElementById('dsPeakG');
    if (peakEl) { peakEl.textContent = _dsPeakG.toFixed(2) + 'g'; if (wasNewPeak) dsFlash('dsPeakG'); }

    // Yaw rate
    const yawEl = document.getElementById('dsYawRate');
    if (yawEl) yawEl.textContent = Math.abs(yawRate).toFixed(2) + ' r/s';

    // Yaw bar (centered, extends left for negative, right for positive)
    const yawFill = document.getElementById('dsYawFill');
    if (yawFill) {
      const maxYaw = 1.5;
      const pct = Math.min(Math.abs(yawRate) / maxYaw, 1.0) * 50;
      if (yawRate >= 0) {
        yawFill.style.left = '50%';
        yawFill.style.width = pct + '%';
      } else {
        yawFill.style.left = (50 - pct) + '%';
        yawFill.style.width = pct + '%';
      }
      // Color: blue for small, red for high yaw
      const yawHue = Math.max(0, 210 - Math.abs(yawRate) * 120);
      yawFill.style.background = `hsla(${yawHue},70%,55%,0.7)`;
    }

    // Yaw trail waveform
    renderYawTrail(yawRate);

    // Steering torque
    const ffbEl = document.getElementById('dsSteerTorque');
    if (ffbEl) ffbEl.textContent = steerTorque.toFixed(1) + ' Nm';

    // Lap delta
    const deltaEl = document.getElementById('dsDelta');
    if (deltaEl) {
      const sign = lapDelta >= 0 ? '+' : '';
      deltaEl.textContent = sign + lapDelta.toFixed(3);
      deltaEl.classList.remove('ds-positive', 'ds-negative', 'ds-neutral');
      if (lapDelta > 0.05) deltaEl.classList.add('ds-positive');
      else if (lapDelta < -0.05) deltaEl.classList.add('ds-negative');
      else deltaEl.classList.add('ds-neutral');
      // Flash on sign change
      const curSign = lapDelta > 0.05 ? 1 : lapDelta < -0.05 ? -1 : 0;
      if (_dsPrevDeltaSign !== 0 && curSign !== 0 && curSign !== _dsPrevDeltaSign) dsFlash('dsDelta');
      if (curSign !== 0) _dsPrevDeltaSign = curSign;
    }

    // Track temp
    const tempEl = document.getElementById('dsTrackTemp');
    if (tempEl) {
      tempEl.textContent = trackTemp > 0 ? trackTemp.toFixed(1) + '°C' : '—°C';
      if (_dsPrevTrackTemp > 0 && Math.abs(trackTemp - _dsPrevTrackTemp) > 0.3) dsFlash('dsTrackTemp');
      _dsPrevTrackTemp = trackTemp;
    }

    // ABS/TC activity → glow on adjustments module bars
    if (absActive) _dsAbsFlash = 8;
    if (tcActive) _dsTcFlash = 8;
    const absCtrl = document.getElementById('ctrlABS');
    const tcCtrl = document.getElementById('ctrlTC');
    if (absCtrl) {
      absCtrl.classList.toggle('ctrl-active', _dsAbsFlash > 0);
      if (_dsAbsFlash > 0) _dsAbsFlash--;
    }
    if (tcCtrl) {
      tcCtrl.classList.toggle('ctrl-active', _dsTcFlash > 0);
      if (_dsTcFlash > 0) _dsTcFlash--;
    }
  }

  // ═══════════════════════════════════════════════════════════════
