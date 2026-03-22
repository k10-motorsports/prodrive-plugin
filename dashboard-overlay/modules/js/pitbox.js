// ═══════════════════════════════════════════════════════════════
//  PIT BOX — Read-only display of iRacing pit stop selections
//  and current in-car adjustment values
// ═══════════════════════════════════════════════════════════════
//
//  Two sections displayed side-by-side:
//    • Pit Stop — fuel, tires, fast repair, tearoff
//    • Car Setup — BB, TC, ABS, ARB, engine, fuel mix, wings
//      (rows auto-hide based on car-specific availability)
//
//  All data is read-only from iRacing telemetry — no commands are sent.
//  Values flash on change, matching the existing ctrl-changed pattern.
// ═══════════════════════════════════════════════════════════════

(function initPitBox() {
  'use strict';

  // ── DOM cache (populated on first update) ──
  let _els = null;
  let _lastIsIRacing = null;

  // ── Previous values for change detection ──
  const _prev = {};
  let _initialized = false; // suppress flash on first frame

  function cacheElements() {
    const $ = (id) => document.getElementById(id);
    _els = {
      panel:       $('pitBoxPanel'),
      noData:      $('pbNoData'),
      content:     $('pbContent'),
      // Fuel
      fuelVal:     $('pbFuelVal'),
      fuelRow:     $('pbFuelVal')?.parentElement,
      // Tires
      tireLF:      $('pbTireLF'),
      tireRF:      $('pbTireRF'),
      tireLR:      $('pbTireLR'),
      tireRR:      $('pbTireRR'),
      pressLF:     $('pbPressLF'),
      pressRF:     $('pbPressRF'),
      pressLR:     $('pbPressLR'),
      pressRR:     $('pbPressRR'),
      // Services
      fastRepair:  $('pbFastRepair'),
      windshield:  $('pbWindshield'),
      // Car adjustments
      adjBB:       $('pbAdjBB'),
      adjTC:       $('pbAdjTC'),
      adjABS:      $('pbAdjABS'),
      adjARBF:     $('pbAdjARBF'),
      adjARBR:     $('pbAdjARBR'),
      adjEng:      $('pbAdjEng'),
      adjFuel:     $('pbAdjFuel'),
      adjWJL:      $('pbAdjWJL'),
      adjWJR:      $('pbAdjWJR'),
      adjWingF:    $('pbAdjWingF'),
      adjWingR:    $('pbAdjWingR'),
      // Car adjustment rows (for hide/show)
      rowTC:       $('pbRowTC'),
      rowABS:      $('pbRowABS'),
      rowARBF:     $('pbRowARBF'),
      rowARBR:     $('pbRowARBR'),
      rowEng:      $('pbRowEng'),
      rowFuel:     $('pbRowFuel'),
      rowWJL:      $('pbRowWJL'),
      rowWJR:      $('pbRowWJR'),
      rowWingF:    $('pbRowWingF'),
      rowWingR:    $('pbRowWingR'),
    };
  }

  // ── Tab switching removed — sections are now always visible side-by-side ──

  // ── Flash animation (matches flashElement pattern from webgl-helpers.js) ──
  function flash(el) {
    if (!el || !_initialized) return;
    el.classList.remove('pb-flash');
    void el.offsetWidth; // force reflow
    el.classList.add('pb-flash');
    setTimeout(() => el.classList.remove('pb-flash'), 1400);
  }

  // Check if a value changed and flash its element
  function checkAndFlash(key, newVal, el) {
    if (_prev[key] !== undefined && _prev[key] !== newVal) {
      flash(el);
    }
    _prev[key] = newVal;
  }

  // ── Show/hide a row based on car capability ──
  function setRowVisible(rowEl, visible) {
    if (!rowEl) return;
    rowEl.classList.toggle('hidden', !visible);
  }

  // ── Update pit box from polled data ──
  window.updatePitBox = function(d) {
    if (!_els) cacheElements();
    if (!_els || !_els.panel) return;

    // Only show for iRacing
    const isIRacing = typeof _isIRacing !== 'undefined' ? _isIRacing : false;
    if (isIRacing !== _lastIsIRacing) {
      _lastIsIRacing = isIRacing;
      if (_els.noData) _els.noData.style.display = isIRacing ? 'none' : '';
      if (_els.content) _els.content.style.display = isIRacing ? '' : 'none';
    }
    if (!isIRacing) return;

    const pb = key => d['K10MediaBroadcaster.Plugin.PitBox.' + key];
    const dc = key => d['DataCorePlugin.GameRawData.Telemetry.' + key];

    // ── Fuel ──
    const fuelReq = pb('FuelRequested');
    const fuelDisplay = pb('FuelDisplay') || '—';
    if (_els.fuelVal) {
      _els.fuelVal.textContent = fuelReq ? fuelDisplay : 'OFF';
      _els.fuelVal.className = 'pb-value ' + (fuelReq ? 'active' : 'inactive');
      checkAndFlash('fuel', fuelDisplay + '|' + fuelReq, _els.fuelRow || _els.fuelVal);
    }

    // ── Tires ──
    updateTire('LF', _els.tireLF, _els.pressLF, pb('TireLF'), pb('PressureLF'));
    updateTire('RF', _els.tireRF, _els.pressRF, pb('TireRF'), pb('PressureRF'));
    updateTire('LR', _els.tireLR, _els.pressLR, pb('TireLR'), pb('PressureLR'));
    updateTire('RR', _els.tireRR, _els.pressRR, pb('TireRR'), pb('PressureRR'));

    // ── Services ──
    updateToggle('fastRepair', _els.fastRepair, pb('FastRepairRequested'));
    updateToggle('windshield', _els.windshield, pb('WindshieldRequested'));

    // ── Car-specific row visibility ──
    // BB is always shown (every car has brake bias)
    setRowVisible(_els.rowTC,    pb('HasTC'));
    setRowVisible(_els.rowABS,   pb('HasABS'));
    setRowVisible(_els.rowARBF,  pb('HasARBFront'));
    setRowVisible(_els.rowARBR,  pb('HasARBRear'));
    setRowVisible(_els.rowEng,   pb('HasEnginePower'));
    setRowVisible(_els.rowFuel,  pb('HasFuelMixture'));
    setRowVisible(_els.rowWJL,   pb('HasWeightJackerL'));
    setRowVisible(_els.rowWJR,   pb('HasWeightJackerR'));
    setRowVisible(_els.rowWingF, pb('HasWingFront'));
    setRowVisible(_els.rowWingR, pb('HasWingRear'));

    // ── Car adjustments ──
    updateAdj('bb',    _els.adjBB,    dc('dcBrakeBias'),         '%', 1);
    updateAdj('tc',    _els.adjTC,    dc('dcTractionControl'),   '',  0);
    updateAdj('abs',   _els.adjABS,   dc('dcABS'),               '',  0);
    updateAdj('arbf',  _els.adjARBF,  dc('dcAntiRollFront'),     '',  0);
    updateAdj('arbr',  _els.adjARBR,  dc('dcAntiRollRear'),      '',  0);
    updateAdj('eng',   _els.adjEng,   dc('dcEnginePower'),       '',  0);
    updateAdj('fmix',  _els.adjFuel,  dc('dcFuelMixture'),       '',  0);
    updateAdj('wjl',   _els.adjWJL,   dc('dcWeightJackerLeft'),  '',  0);
    updateAdj('wjr',   _els.adjWJR,   dc('dcWeightJackerRight'), '',  0);
    updateAdj('wingf', _els.adjWingF, dc('dcWingFront'),         '',  0);
    updateAdj('wingr', _els.adjWingR, dc('dcWingRear'),          '',  0);

    // After first full frame, enable flash detection
    if (!_initialized) _initialized = true;
  };

  function updateTire(pos, statusEl, pressEl, isChanging, pressStr) {
    if (statusEl) {
      statusEl.textContent = isChanging ? 'CHANGE' : 'KEEP';
      statusEl.className = 'pb-tire-status ' + (isChanging ? 'changing' : 'keeping');
    }
    if (pressEl) {
      const p = pressStr || '—';
      pressEl.textContent = isChanging ? p + ' psi' : '—';
      pressEl.style.opacity = isChanging ? '1' : '0.3';
    }
    // Flash the tire cell on change
    const key = 'tire' + pos;
    const val = (isChanging ? 1 : 0) + '|' + pressStr;
    checkAndFlash(key, val, statusEl?.parentElement);
  }

  function updateToggle(key, el, isOn) {
    if (!el) return;
    el.textContent = isOn ? 'YES' : 'NO';
    el.className = 'pb-value ' + (isOn ? 'on' : 'off');
    checkAndFlash(key, isOn ? 1 : 0, el.parentElement);
  }

  function updateAdj(key, el, val, suffix, decimals) {
    if (!el) return;
    const v = parseFloat(val) || 0;
    if (v === 0) {
      el.textContent = '—';
      el.className = 'pb-adj-val zero';
    } else {
      el.textContent = v.toFixed(decimals) + suffix;
      el.className = 'pb-adj-val';
    }
    checkAndFlash('adj_' + key, v.toFixed(decimals), el.parentElement);
  }

})();
