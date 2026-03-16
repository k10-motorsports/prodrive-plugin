// SIMHUB HTTP API POLLING ENGINE
// Depends on: config.js (SIMHUB_URL, POLL_MS, PROP_KEYS)

  // ═══════════════════════════════════════════════════════════════
  // SIMHUB HTTP API POLLING ENGINE
  // Self-contained data bridge — polls SimHub's web server directly.
  // Works as standalone browser overlay or OBS Browser Source.
  // The JavascriptExtensions file is unused in this mode.
  //
  // Config: K10 Media Broadcaster plugin HTTP server (port 8889)
  // The plugin serves all telemetry, demo, commentary and track map data
  // as a flat JSON map from its own HTTP server — no SimHub web API needed.
  // ═══════════════════════════════════════════════════════════════

  // Constants and property keys are defined in config.js
  // Connection status, fetchProps, applyGameMode are in game-detect.js
  // Settings persistence and Discord state are in connections.js

  // ─── Main update loop ───
  async function pollUpdate() {
    if (_pollActive) return;
    _pollActive = true;
    try {

    const p = await fetchProps();
    if (!p) { _pollActive = false; return; }

    _pollFrame++;
    _cycleFrameCount++;

    // Diagnostic logging (first 3 frames + every 300 frames ~10s)
    if (_pollFrame <= 3 || _pollFrame % 300 === 0) {
      const keys = Object.keys(p).filter(k => p[k] != null && p[k] !== 0 && p[k] !== '');
      console.log(`[K10 poll #${_pollFrame}] Got ${Object.keys(p).length} keys, ${keys.length} non-empty. DemoMode=${p['K10MediaBroadcaster.Plugin.DemoMode']}, GameRunning=${p['DataCorePlugin.GameRunning']}`);
      if (_pollFrame === 1) console.log('[K10 poll] Sample values:', JSON.stringify(Object.fromEntries(keys.slice(0, 10).map(k => [k, p[k]]))));
    }

    // ── Plugin version check — warn if old DLL is serving incomplete data ──
    if (_pollFrame === 1 && !p['DataCorePlugin.GameRunning'] && p['DataCorePlugin.GameRunning'] !== 0) {
      let dbg = document.createElement('div');
      dbg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(20,20,28,0.95);color:#ff8;font:12px/1.6 system-ui,sans-serif;padding:20px 28px;z-index:99999;border-radius:10px;max-width:420px;text-align:center;border:1px solid rgba(255,255,255,0.12);';
      dbg.innerHTML = '<div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:8px">Plugin needs rebuild</div>' +
        '<div style="color:#aaa;font-size:11px;line-height:1.6">The SimHub plugin is an older version that doesn\'t serve telemetry data via HTTP.<br><br>' +
        'Rebuild the C# project in Visual Studio and restart SimHub.<br>' +
        `<span style="color:#666;font-size:10px">Got ${Object.keys(p).length} keys, expected 50+</span></div>`;
      document.body.appendChild(dbg);
      setTimeout(() => dbg.remove(), 15000);
    }

    const v = (k) => p[k] != null ? p[k] : 0;
    const vs = (k) => p[k] != null ? '' + p[k] : '';

    // Demo mode: swap data sources when plugin demo mode is active
    const _demo = +v('K10MediaBroadcaster.Plugin.DemoMode') || 0;
    const d = (gameKey, demoKey) => _demo ? v('K10MediaBroadcaster.Plugin.' + demoKey) : v(gameKey);
    const ds = (gameKey, demoKey) => _demo ? vs('K10MediaBroadcaster.Plugin.' + demoKey) : vs(gameKey);

    // ─── Idle State Detection ───
    const gameRunning = +v('DataCorePlugin.GameRunning') || 0;
    const sessionPre = _demo ? 'K10MediaBroadcaster.Plugin.Demo.Grid.' : 'K10MediaBroadcaster.Plugin.Grid.';
    const dsPre = _demo ? 'K10MediaBroadcaster.Plugin.Demo.DS.' : 'K10MediaBroadcaster.Plugin.DS.';
    const sessNum = parseInt(vs(sessionPre + 'SessionState')) || 0;

    // Detect game and apply feature gating
    const rawGameId = v('K10MediaBroadcaster.Plugin.GameId') || '';
    const newGameId = detectGameId(rawGameId);
    if (newGameId !== _currentGameId) {
      _currentGameId = newGameId;
      _isIRacing = (_currentGameId === 'iracing');
      _isRally = isRallyGame() || _rallyModeEnabled;
      applyGameMode();
    }

    // Block non-iRacing games unless Discord connected
    if (!isGameAllowed()) {
      // Show "Connect Discord to unlock" message
      return;
    }

    const nowIdle = !_demo && (!gameRunning || sessNum <= 1);
    const idleLogo = document.getElementById('idleLogo');
    if (nowIdle !== _isIdle) {
      _isIdle = nowIdle;
      if (nowIdle) {
        document.body.classList.add('idle-state');
        if (idleLogo) idleLogo.classList.add('idle-visible');
      } else {
        document.body.classList.remove('idle-state');
        if (idleLogo) idleLogo.classList.remove('idle-visible');
      }
    }
    // Skip rest of update in idle (except settings remain responsive)
    if (_isIdle) { _pollActive = false; return; }

    // ─── Gear / Speed / RPM ───
    const gear = ds('DataCorePlugin.GameData.Gear', 'Demo.Gear') || 'N';
    const rpm = +d('DataCorePlugin.GameData.Rpms', 'Demo.Rpm') || 0;
    const maxRpm = +d('DataCorePlugin.GameData.CarSettings_MaxRPM', 'Demo.MaxRpm') || 1;
    const speed = +d('DataCorePlugin.GameData.SpeedMph', 'Demo.SpeedMph') || 0;

    const gearEl = document.getElementById('gearText');
    const rpmEl = document.getElementById('rpmText');
    const speedEl = document.getElementById('speedText');
    if (gearEl) gearEl.textContent = gear;
    if (rpmEl) rpmEl.textContent = rpm > 0 ? Math.round(rpm) : '0';
    if (speedEl) speedEl.textContent = speed > 0 ? Math.round(speed) : '0';
    // RPM ratio — server-computed (DS.RpmRatio), fallback to client math
    const rpmRatio = +(p[dsPre + 'RpmRatio']) || (maxRpm > 0 ? Math.min(1, rpm / maxRpm) : 0);
    updateTacho(rpmRatio);
    // Redline flash on entire tacho block
    const tachoBlock = document.querySelector('.tacho-block');
    if (tachoBlock) {
      if (rpmRatio >= 0.91) tachoBlock.classList.add('tacho-redline');
      else tachoBlock.classList.remove('tacho-redline');
    }

    // ─── Pedals — server-normalized (DS.ThrottleNorm etc.), fallback to client math ───
    let thr = +(p[dsPre + 'ThrottleNorm']);
    let brk = +(p[dsPre + 'BrakeNorm']);
    let clt = +(p[dsPre + 'ClutchNorm']);
    // Fallback: normalize client-side if server values not available
    if (!(thr >= 0)) {
      thr = +d('DataCorePlugin.GameData.Throttle', 'Demo.Throttle') || 0;
      while (thr > 1.01) thr /= 100;
      thr = Math.min(1, Math.max(0, thr));
    }
    if (!(brk >= 0)) {
      brk = +d('DataCorePlugin.GameData.Brake', 'Demo.Brake') || 0;
      while (brk > 1.01) brk /= 100;
      brk = Math.min(1, Math.max(0, brk));
    }
    if (!(clt >= 0)) {
      clt = +d('DataCorePlugin.GameData.Clutch', 'Demo.Clutch') || 0;
      while (clt > 1.01) clt /= 100;
      clt = Math.min(1, Math.max(0, clt));
    }

    // Auto-hide clutch for cars with autoclutch/DCT/no manual clutch pedal
    if (clt > 0.03) _clutchSeenActive = true;
    if (!_clutchSeenActive && _pollFrame > 60 && speed > 10) {
      if (!_clutchHidden) {
        _clutchHidden = true;
        const cltLabel = document.getElementById('clutchLabelGroup');
        const cltLayer = document.querySelector('.clutch-layer');
        if (cltLabel) cltLabel.style.display = 'none';
        if (cltLayer) cltLayer.style.display = 'none';
      }
    } else if (_clutchSeenActive && _clutchHidden) {
      _clutchHidden = false;
      const cltLabel = document.getElementById('clutchLabelGroup');
      const cltLayer = document.querySelector('.clutch-layer');
      if (cltLabel) cltLabel.style.display = '';
      if (cltLayer) cltLayer.style.display = '';
    }

    if (_pollFrame % 2 === 0) {
      _thrHist.shift(); _thrHist.push(thr);
      _brkHist.shift(); _brkHist.push(brk);
      _cltHist.shift(); _cltHist.push(clt);
      renderHist('throttleHist', _thrHist);
      renderHist('brakeHist', _brkHist);
      if (!_clutchHidden) renderHist('clutchHist', _cltHist);
      renderPedalTrace(thr, brk, _clutchHidden ? 0 : clt);
    }
    const pcts = document.querySelectorAll('.pedal-pct');
    if (pcts.length >= 3) {
      pcts[0].textContent = (Math.round(thr * 100) | 0) + '%';
      pcts[1].textContent = (Math.round(brk * 100) | 0) + '%';
      pcts[2].textContent = (Math.round(clt * 100) | 0) + '%';
    }

    // ─── WebGL FX update ───
    if (window.updateGLFX) window.updateGLFX(rpmRatio, thr, brk, clt);

    // ─── Fuel — server-computed (DS.FuelPct, DS.FuelLapsRemaining) ───
    const fuel = +d('DataCorePlugin.GameData.Fuel', 'Demo.Fuel') || 0;
    const fuelPct = +(p[dsPre + 'FuelPct']) || 0;
    const fuelRem = document.querySelector('.fuel-remaining');
    if (fuelRem) fuelRem.innerHTML = fuel > 0 ? fuel.toFixed(1) + ' <span class="unit">L</span>' : '— <span class="unit">L</span>';
    updateFuelBar(fuelPct, 0);

    const fuelPerLap = _demo ? (+v('K10MediaBroadcaster.Plugin.Demo.FuelPerLap') || 0) : (+v('DataCorePlugin.Computed.Fuel_LitersPerLap') || 0);
    const fuelLapsEst = +(p[dsPre + 'FuelLapsRemaining']) || (fuelPerLap > 0 ? fuel / fuelPerLap : 0);
    const fuelVals = document.querySelectorAll('.fuel-stats .val');
    if (fuelVals.length >= 2) {
      fuelVals[0].textContent = fuelPerLap > 0 ? fuelPerLap.toFixed(2) : '—';
      fuelVals[1].textContent = fuelLapsEst > 0 ? fuelLapsEst.toFixed(1) : '—';
    }
    const pitSug = document.querySelector('.fuel-pit-suggest');
    if (pitSug) {
      const remLaps = +d('DataCorePlugin.GameData.RemainingLaps', 'Demo.RemainingLaps') || 0;
      pitSug.textContent = (fuelLapsEst > 0 && remLaps > 0 && fuelLapsEst < remLaps)
        ? 'PIT in ~' + Math.ceil(fuelLapsEst) + ' laps' : '';
    }

    // ─── Tyres ───
    if (_demo) {
      updateTyreCell(0, +v('K10MediaBroadcaster.Plugin.Demo.TyreTempFL'), (+v('K10MediaBroadcaster.Plugin.Demo.TyreWearFL') || 1) * 100);
      updateTyreCell(1, +v('K10MediaBroadcaster.Plugin.Demo.TyreTempFR'), (+v('K10MediaBroadcaster.Plugin.Demo.TyreWearFR') || 1) * 100);
      updateTyreCell(2, +v('K10MediaBroadcaster.Plugin.Demo.TyreTempRL'), (+v('K10MediaBroadcaster.Plugin.Demo.TyreWearRL') || 1) * 100);
      updateTyreCell(3, +v('K10MediaBroadcaster.Plugin.Demo.TyreTempRR'), (+v('K10MediaBroadcaster.Plugin.Demo.TyreWearRR') || 1) * 100);
    } else {
      updateTyreCell(0, +v('DataCorePlugin.GameData.TyreTempFrontLeft'), (p['DataCorePlugin.GameData.TyreWearFrontLeft'] != null ? +p['DataCorePlugin.GameData.TyreWearFrontLeft'] * 100 : 100));
      updateTyreCell(1, +v('DataCorePlugin.GameData.TyreTempFrontRight'), (p['DataCorePlugin.GameData.TyreWearFrontRight'] != null ? +p['DataCorePlugin.GameData.TyreWearFrontRight'] * 100 : 100));
      updateTyreCell(2, +v('DataCorePlugin.GameData.TyreTempRearLeft'), (p['DataCorePlugin.GameData.TyreWearRearLeft'] != null ? +p['DataCorePlugin.GameData.TyreWearRearLeft'] * 100 : 100));
      updateTyreCell(3, +v('DataCorePlugin.GameData.TyreTempRearRight'), (p['DataCorePlugin.GameData.TyreWearRearRight'] != null ? +p['DataCorePlugin.GameData.TyreWearRearRight'] * 100 : 100));
    }

    // ─── Controls (BB / TC / ABS) ───
    const bb = _demo ? +v('K10MediaBroadcaster.Plugin.Demo.BrakeBias') : (+v('DataCorePlugin.GameRawData.Telemetry.dcBrakeBias') || 0);
    const tc = _demo ? +v('K10MediaBroadcaster.Plugin.Demo.TC') : p['DataCorePlugin.GameRawData.Telemetry.dcTractionControl'];
    const abs = _demo ? +v('K10MediaBroadcaster.Plugin.Demo.ABS') : p['DataCorePlugin.GameRawData.Telemetry.dcABS'];
    const carModel = ds('DataCorePlugin.GameData.CarModel', 'Demo.CarModel');
    if (carModel !== _lastCarModel) {
      _tcSeen = false; _absSeen = false;
      _lastCarModel = carModel;
      setCarLogo(detectMfr(carModel), carModel);
    }
    if (_demo) { _tcSeen = true; _absSeen = true; }
    else {
      // Once we see any valid value (even 0), the car has this system
      if (tc != null && +tc >= 0) _tcSeen = true;
      if (abs != null && +abs >= 0) _absSeen = true;
    }
    // Show TC/ABS blocks if the car reports them at all; hide only if car lacks them
    const tcOk = _demo || _tcSeen;
    const absOk = _demo || _absSeen;
    const bbOk = _demo || (bb > 0);
    setCtrlVisibility(bbOk, tcOk, absOk);

    const bbEl = document.querySelector('#ctrlBB .ctrl-value');
    if (bbEl && bbOk) { bbEl.textContent = bb > 0 ? bb.toFixed(1) : '—'; document.getElementById('ctrlBB').style.setProperty('--ctrl-pct', (bb > 0 ? Math.min(100, ((bb-30)/40)*100) : 0) + '%'); }
    if (tcOk) {
      const el = document.querySelector('#ctrlTC .ctrl-value');
      const tcBox = document.getElementById('ctrlTC');
      if (el) {
        if (+tc === 0) {
          el.textContent = 'fixed';
          el.classList.add('ctrl-value-fixed');
          tcBox.style.setProperty('--ctrl-pct', '0%');
        } else {
          el.textContent = Math.round(+tc);
          el.classList.remove('ctrl-value-fixed');
          tcBox.style.setProperty('--ctrl-pct', Math.min(100, (+tc/12)*100) + '%');
        }
      }
    }
    if (absOk) {
      const el = document.querySelector('#ctrlABS .ctrl-value');
      const absBox = document.getElementById('ctrlABS');
      if (el) {
        if (+abs === 0) {
          el.textContent = 'fixed';
          el.classList.add('ctrl-value-fixed');
          absBox.style.setProperty('--ctrl-pct', '0%');
        } else {
          el.textContent = Math.round(+abs);
          el.classList.remove('ctrl-value-fixed');
          absBox.style.setProperty('--ctrl-pct', Math.min(100, (+abs/12)*100) + '%');
        }
      }
    }

    // Flash control bars on value change + announce via spotter
    if (_prevBB >= 0 && bb > 0 && Math.abs(bb - _prevBB) > 0.05) {
      flashCtrlBar('ctrlBB');
      if (window.announceAdjustment) window.announceAdjustment('bb', bb, bb > _prevBB ? 1 : -1);
    }
    if (_prevTC >= 0 && +tc !== _prevTC) {
      flashCtrlBar('ctrlTC');
      if (window.announceAdjustment) window.announceAdjustment('tc', +tc, +tc > _prevTC ? 1 : -1);
    }
    if (_prevABS >= 0 && +abs !== _prevABS) {
      flashCtrlBar('ctrlABS');
      if (window.announceAdjustment) window.announceAdjustment('abs', +abs, +abs > _prevABS ? 1 : -1);
    }
    if (bb > 0) _prevBB = bb;
    if (tcOk) _prevTC = +tc;
    if (absOk) _prevABS = +abs;

    // ─── Position / Lap / Best Lap ───
    // Snapshot previous position BEFORE it gets overwritten (used by grid viz)
    const _vizSnapPrevPos = _lastPosition;
    const pos = +d('DataCorePlugin.GameData.Position', 'Demo.Position') || 0;
    const lap = +d('DataCorePlugin.GameData.CurrentLap', 'Demo.CurrentLap') || 0;
    const bestLap = +d('DataCorePlugin.GameData.BestLapTime', 'Demo.BestLapTime') || 0;
    document.querySelectorAll('.pos-number').forEach(el => {
      const sp = el.querySelector('.skew-accent');
      if (sp) sp.textContent = pos > 0 ? 'P' + pos : 'P—';
    });
    document.querySelectorAll('.pos-meta-row .val').forEach(el => {
      if (el.classList.contains('purple')) el.textContent = fmtLap(bestLap);
      else el.textContent = lap > 0 ? lap : '—';
    });
    if (pos !== _lastPosition && _lastPosition > 0 && pos > 0) {
      document.querySelectorAll('.pos-number').forEach(el => flashElement(el, pos < _lastPosition ? 'ahead-changed' : 'behind-changed'));
      // WebGL leaderboard event animation on position change
      if (window.triggerLBEvent) {
        if (pos === 1 && pos < _lastPosition) {
          window.triggerLBEvent('p1');   // P1 gold celebration
        } else {
          window.triggerLBEvent(pos < _lastPosition ? 'gain' : 'lose');
        }
      }
    }
    // Start position — prefer server-computed, fallback to client-side
    const serverStartPos = +(p[dsPre + 'StartPosition']) || 0;
    if (serverStartPos > 0) _startPosition = serverStartPos;
    else if (_startPosition === 0 && pos > 0) _startPosition = pos;
    _lastPosition = pos;
    // Position delta indicator — prefer server-computed DS.PositionDelta
    document.querySelectorAll('.pos-delta').forEach(el => {
      const delta = +(p[dsPre + 'PositionDelta']) || (_startPosition > 0 && pos > 0 ? _startPosition - pos : 0);
      if (delta > 0) {
        el.textContent = '▲ ' + delta;
        el.className = 'pos-delta visible delta-up';
      } else if (delta < 0) {
        el.textContent = '▼ ' + Math.abs(delta);
        el.className = 'pos-delta visible delta-down';
      } else {
        el.textContent = '';
        el.className = 'pos-delta delta-same';
      }
    });
    // Update player highlight: 0=blue(same), 1=green(ahead), 2=red(behind), 3=gold(P1)
    if (window.setLBHighlightMode) {
      if (pos === 1) {
        window.setLBHighlightMode(3);
      } else if (_startPosition > 0 && pos > 0) {
        if (pos < _startPosition) window.setLBHighlightMode(1);      // ahead of start
        else if (pos > _startPosition) window.setLBHighlightMode(2); // behind start
        else window.setLBHighlightMode(0);                           // same as start
      } else {
        window.setLBHighlightMode(0);
      }
    }

    // ─── Race Timer + Last Lap + End-of-Race Logic ───
    const sessionTime = +d('DataCorePlugin.GameData.SessionTimeSpan', 'Demo.SessionTime') || 0;
    const lastLapTime = +d('DataCorePlugin.GameData.LastLapTime', 'Demo.LastLapTime') || 0;
    const remTime = +d('DataCorePlugin.GameData.RemainingTime', 'Demo.RemainingTime') || 0;
    const totalLaps = +d('DataCorePlugin.GameData.TotalLaps', 'Demo.TotalLaps') || 0;
    const remLaps = +d('DataCorePlugin.GameData.RemainingLaps', 'Demo.RemainingLaps') || 0;
    const timerEl = document.getElementById('raceTimerValue');
    const timerRow = document.querySelector('.timer-row');
    if (timerEl) {
      // Prefer server-formatted remaining time, fallback to client math
      const serverFmt = p[dsPre + 'RemainingTimeFormatted'] || '';
      if (serverFmt) {
        timerEl.textContent = serverFmt;
      } else {
        const displayTime = remTime > 0 ? remTime : sessionTime;
        if (displayTime > 0) {
          const h = Math.floor(displayTime / 3600);
          const m = Math.floor((displayTime % 3600) / 60);
          const s = Math.floor(displayTime % 60);
          timerEl.textContent = h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        } else {
          timerEl.textContent = '0:00:00';
        }
      }
    }
    const lastLapEl = document.getElementById('lastLapTimeValue');
    if (lastLapEl) { lastLapEl.textContent = fmtLap(lastLapTime); }

    // Detect lap change → show timer block + force position page
    if (lap > 0 && lap !== _prevLap && _prevLap > 0 && timerRow) {
      timerRow.classList.add('timer-visible');
      showPositionPage();
      // Clear any pending hide
      if (_timerHideTimeout) clearTimeout(_timerHideTimeout);
      // Auto-hide after 30s unless pinned for end-of-race
      if (!_timerPinned) {
        _timerHideTimeout = setTimeout(() => {
          if (!_timerPinned) timerRow.classList.remove('timer-visible');
        }, 30000);
      }
    }
    _prevLap = lap;

    // End-of-race: pin timer visible for final 3 laps or final 5 minutes
    const isTimedRace = +(p[dsPre + 'IsTimedRace']) > 0 || totalLaps <= 0 || totalLaps > 9999;
    const serverEndOfRace = +(p[dsPre + 'IsEndOfRace']) > 0;  // checkered flag
    const isEndOfRace = serverEndOfRace || (isTimedRace
      ? (remTime > 0 && remTime <= 300)   // final 5 minutes for timed races
      : (remLaps > 0 && remLaps <= 3));   // final 3 laps for lap races
    if (isEndOfRace && timerRow) {
      _timerPinned = true;
      showPositionPage();
      if (_timerHideTimeout) { clearTimeout(_timerHideTimeout); _timerHideTimeout = null; }
      timerRow.classList.add('timer-visible');
    } else if (_timerPinned && !isEndOfRace) {
      _timerPinned = false; // race ended or data reset
    }

    // ─── iRating / Safety ───
    const ir = _demo ? (+v('K10MediaBroadcaster.Plugin.Demo.IRating') || 0) : (+v('IRacingExtraProperties.iRacing_DriverInfo_IRating') || 0);
    const sr = _demo ? (+v('K10MediaBroadcaster.Plugin.Demo.SafetyRating') || 0) : (+v('IRacingExtraProperties.iRacing_DriverInfo_SafetyRating') || 0);
    _hasRatingData = (ir > 0 || sr > 0);
    const ratVals = document.querySelectorAll('.rating-value');
    if (ratVals.length >= 2) { ratVals[0].textContent = ir > 0 ? ir : '—'; ratVals[1].textContent = sr > 0 ? sr.toFixed(2) : '—'; }
    updateIRBar(ir);
    updateSRPie(sr);

    // ─── Gaps / Lap Timing ───
    // Prefer server-computed DS.IsNonRaceSession, fallback to client-side string check
    const nonRace = +(p[dsPre + 'IsNonRaceSession']) > 0 || _isNonRaceSession(
      _demo ? (p['K10MediaBroadcaster.Plugin.Demo.SessionTypeName'] || '')
            : (p['K10MediaBroadcaster.Plugin.SessionTypeName'] || ''));

    const gapLabels = document.querySelectorAll('.panel-label');
    const gapTimes = document.querySelectorAll('.gap-time');
    const gapDrivers = document.querySelectorAll('.gap-driver');
    const gapIRs = document.querySelectorAll('.gap-ir');
    const gapItems = document.querySelectorAll('.gap-item');

    if (nonRace) {
      // ── Non-race: show best lap / last lap ──
      const bestLap = _demo
        ? (+(p['K10MediaBroadcaster.Plugin.Demo.BestLapTime']) || 0)
        : (+(p['DataCorePlugin.GameData.BestLapTime']) || 0);
      const lastLap = _demo
        ? (+(p['K10MediaBroadcaster.Plugin.Demo.LastLapTime']) || 0)
        : (+(p['DataCorePlugin.GameData.LastLapTime']) || 0);
      const curLap = _demo
        ? (+(p['K10MediaBroadcaster.Plugin.Demo.CurrentLap']) || 0)
        : (+(p['DataCorePlugin.GameData.CurrentLap']) || 0);

      // Track worst lap
      if (lastLap > 0 && lastLap !== _gapsLastLap) {
        _gapsLastLap = lastLap;
        if (lastLap > _gapsWorstLap) _gapsWorstLap = lastLap;
      }
      _gapsBestLap = bestLap;
      _gapsLapNum = curLap;

      // Update labels
      if (gapLabels.length >= 2) { gapLabels[0].textContent = 'Best Lap'; gapLabels[1].textContent = 'Last Lap'; }
      if (gapTimes.length >= 2) {
        gapTimes[0].textContent = bestLap > 0 ? _fmtLapTime(bestLap) : '—';
        gapTimes[1].textContent = lastLap > 0 ? _fmtLapTime(lastLap) : '—';
      }
      // Show delta from best instead of driver name
      if (gapDrivers.length >= 2) {
        gapDrivers[0].textContent = curLap > 0 ? 'Lap ' + curLap : '';
        if (lastLap > 0 && bestLap > 0) {
          const delta = lastLap - bestLap;
          gapDrivers[1].textContent = delta <= 0.001 ? 'Personal Best' : '+' + delta.toFixed(3);
        } else {
          gapDrivers[1].textContent = '';
        }
      }
      if (gapIRs.length >= 2) { gapIRs[0].textContent = ''; gapIRs[1].textContent = ''; }
      _gapsNonRaceMode = true;
    } else {
      // ── Race: show ahead / behind gaps ──
      if (_gapsNonRaceMode) {
        // Restore labels when switching back to race
        if (gapLabels.length >= 2) { gapLabels[0].textContent = 'Ahead'; gapLabels[1].textContent = 'Behind'; }
        _gapsNonRaceMode = false;
        _gapsWorstLap = 0;
        _gapsLastLap = 0;
      }
      const gAhead  = _demo ? (+v('K10MediaBroadcaster.Plugin.Demo.GapAhead') || 0)  : (+v('IRacingExtraProperties.iRacing_Opponent_Ahead_Gap') || 0);
      const gBehind = _demo ? (+v('K10MediaBroadcaster.Plugin.Demo.GapBehind') || 0) : (+v('IRacingExtraProperties.iRacing_Opponent_Behind_Gap') || 0);
      const dAhead  = _demo ? vs('K10MediaBroadcaster.Plugin.Demo.DriverAhead')  : vs('IRacingExtraProperties.iRacing_Opponent_Ahead_Name');
      const dBehind = _demo ? vs('K10MediaBroadcaster.Plugin.Demo.DriverBehind') : vs('IRacingExtraProperties.iRacing_Opponent_Behind_Name');
      const irA     = _demo ? (+v('K10MediaBroadcaster.Plugin.Demo.IRAhead') || 0)   : (+v('IRacingExtraProperties.iRacing_Opponent_Ahead_IRating') || 0);
      const irB     = _demo ? (+v('K10MediaBroadcaster.Plugin.Demo.IRBehind') || 0)  : (+v('IRacingExtraProperties.iRacing_Opponent_Behind_IRating') || 0);
      if (gapTimes.length >= 2) { gapTimes[0].textContent = gAhead ? fmtGap(-Math.abs(gAhead)) : '—'; gapTimes[1].textContent = gBehind ? fmtGap(Math.abs(gBehind)) : '—'; }
      if (gapDrivers.length >= 2) { gapDrivers[0].textContent = dAhead || '—'; gapDrivers[1].textContent = dBehind || '—'; }
      if (gapIRs.length >= 2) { gapIRs[0].textContent = irA > 0 ? irA + ' iR' : ''; gapIRs[1].textContent = irB > 0 ? irB + ' iR' : ''; }
      if (gapItems.length >= 2) {
        if (dAhead !== _lastDriverAhead && _lastDriverAhead) flashElement(gapItems[0], 'ahead-changed');
        if (dBehind !== _lastDriverBehind && _lastDriverBehind) flashElement(gapItems[1], 'behind-changed');
      }
      _lastDriverAhead = dAhead; _lastDriverBehind = dBehind;
    }

    // ─── Flag Status → Gaps Block ───
    const flagState = (_forceFlagState && _demo) ? _forceFlagState : (vs('currentFlagState') || 'none');
    const gapsBlock = document.getElementById('gapsBlock');
    if (gapsBlock) {
      const flagLabels = { yellow: 'CAUTION', red: 'RED FLAG', blue: 'BLUE FLAG', white: 'LAST LAP', debris: 'DEBRIS', checkered: 'FINISH', black: 'BLACK FLAG', green: 'GREEN', meatball: 'MEATBALL', orange: 'LAPPED CAR' };
      const flagContexts = { yellow: 'Full course caution — hold position', red: 'Session stopped — return to pits', blue: 'Faster car approaching — yield', white: 'Last lap — push to the line', debris: 'Debris on track — stay alert', checkered: 'Checkered flag — race complete', black: 'Penalty — report to pit lane', green: 'Green flag — racing resumes', meatball: 'Repair required — pit immediately', orange: 'Car ahead must yield — make the pass' };

      // Minimum hold durations per flag type (ms) — prevents flicker from rapid state changes
      const FLAG_HOLD_MS = { yellow: 8000, red: 10000, blue: 4000, white: 6000, debris: 5000, checkered: 10000, black: 8000, green: 5000, meatball: 10000, orange: 4000 };

      let showFlag = flagState;
      const now = Date.now();

      // When a new flag appears, set minimum hold time
      if (flagState !== 'none' && flagState !== _flagHoldState) {
        _flagHoldState = flagState;
        _flagHoldUntil = now + (FLAG_HOLD_MS[flagState] || 5000);
      }

      // Green flag: show briefly when transitioning from caution, then clear
      if (flagState === 'green' && _lastFlagState !== 'green' && _lastFlagState !== 'none') {
        if (_greenFlagTimeout) clearTimeout(_greenFlagTimeout);
        _greenFlagTimeout = setTimeout(() => {
          const gb = document.getElementById('gapsBlock');
          if (gb) gb.className = gb.className.replace(/\bflag-\S+/g, '').trim() + ' panel gaps-block';
          if (window.setFlagGLColors) window.setFlagGLColors(null);
          _greenFlagTimeout = null;
          _flagHoldState = 'none';
        }, FLAG_HOLD_MS.green);
      } else if (flagState === 'green' && !_greenFlagTimeout) {
        showFlag = 'none'; // green with no active timer = steady state, don't show
      } else if (flagState === 'none') {
        // Flag cleared — but hold the overlay if minimum duration hasn't elapsed
        if (now < _flagHoldUntil && _flagHoldState !== 'none') {
          showFlag = _flagHoldState; // keep showing previous flag
        } else {
          if (_greenFlagTimeout) { clearTimeout(_greenFlagTimeout); _greenFlagTimeout = null; }
          showFlag = 'none';
          _flagHoldState = 'none';
        }
      }

      // Remove all flag-* classes
      gapsBlock.className = gapsBlock.className.replace(/\bflag-\S+/g, '').trim();
      if (showFlag !== 'none') {
        gapsBlock.classList.add('flag-active', 'flag-' + showFlag);
        const lbl = flagLabels[showFlag] || showFlag.toUpperCase();
        const ctx = flagContexts[showFlag] || '';
        const fl1 = document.getElementById('flagLabel1');
        const fc1 = document.getElementById('flagCtx1');
        if (fl1) fl1.textContent = lbl;
        if (fc1) fc1.textContent = ctx;
        // Set WebGL flag icon colors
        if (window.setFlagGLColors) window.setFlagGLColors(showFlag);
      } else {
        if (window.setFlagGLColors) window.setFlagGLColors(null);
      }
      // ── Race Control banner — only for critical events ──
      // Minor flags (blue, white, green, debris) are handled by the flag module on the gaps block.
      // Race Control only fires for session-altering events: red, black, yellow (full course), checkered.
      const RC_FLAGS = { red: true, black: true, yellow: true, checkered: true, meatball: true };
      if (flagState !== _lastFlagState) {
        if (RC_FLAGS[flagState]) {
          showRaceControl(flagState);
        }
        // Only hide RC banner when flag hold has also expired — don't yank it early
        else if ((flagState === 'none' || !RC_FLAGS[flagState]) && now >= _flagHoldUntil) {
          hideRaceControl();
        }
      }

      // ── Leaderboard event animations for race start / finish ──
      if (flagState !== _lastFlagState && window.triggerLBEvent) {
        // Green flag transition from non-green = race start (or restart)
        if (flagState === 'green' && _lastFlagState !== 'green' && _lastFlagState !== 'none') {
          window.triggerLBEvent('green');
        }
        // Checkered flag = race finish
        if (flagState === 'checkered' && _lastFlagState !== 'checkered') {
          window.triggerLBEvent('finish');
        }
      }
      _lastFlagState = flagState;
    }

    // ─── Commentary ───
    const cmVis = +v('K10MediaBroadcaster.Plugin.CommentaryVisible') || 0;
    if (cmVis && !_commentaryWasVisible) {
      const hue = colorToHue(vs('K10MediaBroadcaster.Plugin.CommentarySentimentColor'));
      const severity = +v('K10MediaBroadcaster.Plugin.CommentarySeverity') || 0;
      showCommentary(hue, vs('K10MediaBroadcaster.Plugin.CommentaryTopicTitle'), vs('K10MediaBroadcaster.Plugin.CommentaryText'), vs('K10MediaBroadcaster.Plugin.CommentaryCategory'), vs('K10MediaBroadcaster.Plugin.CommentaryTopicId'), severity);
    } else if (!cmVis && _commentaryWasVisible) {
      hideCommentary();
    }
    _commentaryWasVisible = !!cmVis;

    // ─── Commentary visualization data feed ───
    if (cmVis && window.updateCommentaryVizData) {
      window.updateCommentaryVizData({
        brake: brk,
        throttle: thr,
        rpmRatio: rpmRatio,
        speed: speed,
        brakeBias: bb,
        tc: +(tc || 0),
        abs: +(abs || 0),
        fuelPct: fuelPct,
        lapDelta: +(v(dsPre + 'LapDelta') || 0),
        gapAhead: _demo ? +(v('K10MediaBroadcaster.Plugin.Demo.GapAhead') || 0) : +(v('IRacingExtraProperties.iRacing_Opponent_Ahead_Gap') || 0),
        latG: +(v(dsPre + 'LatG') || 0),
        longG: +(v(dsPre + 'LongG') || 0),
        steerTorque: +(v(dsPre + 'SteerTorque') || 0),
        position: pos,
        prevPosition: _vizSnapPrevPos || 0,
        startPosition: _startPosition || 0,
        totalCars: +(v(sessionPre + 'TotalCars')) || 0,
        incidents: +(v(dsPre + 'IncidentCount') || 0),
        lap: lap,
        sessionTime: vs('DataCorePlugin.GameData.RemainingTime') || '',
        trackTemp: +(v(dsPre + 'TrackTemp') || 0),
        tyreTemps: _demo
          ? [+v('K10MediaBroadcaster.Plugin.Demo.TyreTempFL'), +v('K10MediaBroadcaster.Plugin.Demo.TyreTempFR'), +v('K10MediaBroadcaster.Plugin.Demo.TyreTempRL'), +v('K10MediaBroadcaster.Plugin.Demo.TyreTempRR')]
          : [+v('DataCorePlugin.GameData.TyreTempFrontLeft'), +v('DataCorePlugin.GameData.TyreTempFrontRight'), +v('DataCorePlugin.GameData.TyreTempRearLeft'), +v('DataCorePlugin.GameData.TyreTempRearRight')],
        tyreWears: _demo
          ? [(+v('K10MediaBroadcaster.Plugin.Demo.TyreWearFL') || 1) * 100, (+v('K10MediaBroadcaster.Plugin.Demo.TyreWearFR') || 1) * 100, (+v('K10MediaBroadcaster.Plugin.Demo.TyreWearRL') || 1) * 100, (+v('K10MediaBroadcaster.Plugin.Demo.TyreWearRR') || 1) * 100]
          : [(p['DataCorePlugin.GameData.TyreWearFrontLeft'] != null ? +p['DataCorePlugin.GameData.TyreWearFrontLeft'] * 100 : 100), (p['DataCorePlugin.GameData.TyreWearFrontRight'] != null ? +p['DataCorePlugin.GameData.TyreWearFrontRight'] * 100 : 100), (p['DataCorePlugin.GameData.TyreWearRearLeft'] != null ? +p['DataCorePlugin.GameData.TyreWearRearLeft'] * 100 : 100), (p['DataCorePlugin.GameData.TyreWearRearRight'] != null ? +p['DataCorePlugin.GameData.TyreWearRearRight'] * 100 : 100)]
      });
    }

    // ─── Driver display name (for leaderboard) ───
    const dfn = vs('K10MediaBroadcaster.Plugin.DriverFirstName') || '';
    const dln = vs('K10MediaBroadcaster.Plugin.DriverLastName') || '';
    if (dfn || dln) {
      _driverDisplayName = (dfn && dln) ? dfn.charAt(0) + '. ' + dln : (dfn || dln);
    }

    // ─── Track map ───
    const mapReady = +v('K10MediaBroadcaster.Plugin.TrackMap.Ready') || 0;
    if (mapReady) {
      const mapPath = vs('K10MediaBroadcaster.Plugin.TrackMap.SvgPath') || '';
      const mapPX   = +v('K10MediaBroadcaster.Plugin.TrackMap.PlayerX') || 50;
      const mapPY   = +v('K10MediaBroadcaster.Plugin.TrackMap.PlayerY') || 50;
      const mapOpp  = vs('K10MediaBroadcaster.Plugin.TrackMap.Opponents') || '';
      updateTrackMap(mapPath, mapPX, mapPY, mapOpp);
    }

    // ─── Datastream ───
    try { updateDatastream(p, _demo); } catch(e) { console.error('[K10] Datastream error:', e); }

    // ─── Incidents ───
    try { updateIncidents(p, _demo); } catch(e) { console.error('[K10] Incidents error:', e); }

    // ─── Leaderboard ───
    try { updateLeaderboard(p); } catch(e) { console.error('[K10] Leaderboard error:', e); }

    // ─── Pit Limiter ───
    try { updatePitLimiter(p, _demo); } catch(e) { console.error('[K10] Pit limiter error:', e); }

    // ─── Race End Screen ───
    try {
      const isCheckered = flagState === 'checkered';
      if (isCheckered && !_prevCheckered) {
        showRaceEnd(p, _demo);
      } else if (!isCheckered && _prevCheckered && _raceEndVisible) {
        hideRaceEnd();
      }
      _prevCheckered = isCheckered;
    } catch(e) { console.error('[K10] Race end error:', e); }

    // ─── Grid / Formation ───
    try { updateGrid(p, _demo); } catch(e) { console.error('[K10] Grid error:', e); }

    // ─── Spotter ───
    try { updateSpotter(p, _demo); } catch(e) { console.error('[K10] Spotter error:', e); }

    // ─── Race Timeline ───
    try {
      const rtIncidents = +(v('K10MediaBroadcaster.Plugin.DS.IncidentCount')) || 0;
      const rtInPit = +(v('K10MediaBroadcaster.Plugin.DS.IsInPitLane')) > 0;
      updateRaceTimeline(pos, lap, flagState, rtIncidents, rtInPit);
    } catch(e) { console.error('[K10] Timeline error:', e); }

    // ─── Cycling timer ───
    // Suppress cycling while timer row is visible — keep position page showing
    const _timerShowing = timerRow && timerRow.classList.contains('timer-visible');
    if (_cycleFrameCount >= _cycleIntervalFrames) { _cycleFrameCount = 0; if (!_timerShowing) cycleRatingPos(); }

    // ─── FPS counter (game API framerate, not browser) ───
    setApiFps(+v('DataCorePlugin.GameRawData.Telemetry.FrameRate') || 0);
    updateFps();

    } catch (err) {
      console.error('[K10 poll] Error in poll frame #' + _pollFrame + ':', err);
    } finally {
      _pollActive = false;
    }
  }

  // ─── Start polling ───
  // Always poll the plugin's HTTP API (port 8889) for telemetry data.
  // This works in all contexts: SimHub DashTemplate overlay, standalone browser,
  // OBS Browser Source, or any web view. The plugin's HTTP server serves all
  // telemetry, demo, commentary, and track map data as a single JSON blob.
  // Load external assets before starting the poll loop
  Promise.all([loadCarLogos(), loadCountryFlags()]).then(() => {
    console.log('[K10 Media Broadcaster] Assets loaded, polling SimHub HTTP API at ' + SIMHUB_URL);

    // Initialize logo cycling (before we connect, the logos will cycle to be visible)
    _logoCycleTimer = setInterval(() => {
      if (!_hasEverConnected) cycleCarLogo();
    }, 3000);
    setCarLogo(carLogoOrder[0], _demoModels[carLogoOrder[0]]);

    // Settings and Discord state are loaded by connections.js on script load

    // Start polling
    setInterval(pollUpdate, POLL_MS);
  });

  // ═══════════════════════════════════════════════════════════════
