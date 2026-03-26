// ═══════════════════════════════════════════════════════════════
//  DRIVE HUD — Driver-focused full-screen mode
//  Shows: track map + sectors, lap delta, position, spotter, incidents
//  Ctrl+Shift+F to toggle. Auto-activates on remote server connections.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  let _active = false;
  let _dhHeadingSmooth = 0; // LERP-smoothed heading (degrees) to reduce judder

  function toggleDriveMode() {
    _active = !_active;
    _applyDriveMode();
    _settings.driveMode = _active;
    saveSettings();
  }
  window.toggleDriveMode = toggleDriveMode;

  function setDriveMode(on) {
    _active = !!on;
    _applyDriveMode();
  }
  window.setDriveMode = setDriveMode;

  function _applyDriveMode() {
    var hud = document.getElementById('driveHud');
    document.body.classList.toggle('drive-mode-active', _active);
    if (hud) hud.style.display = _active ? 'grid' : 'none';
    // Restore transparent background when exiting
    if (!_active) document.body.style.background = '';
  }

  // ── Update drive HUD data (called from poll engine each frame) ──
  function updateDriveHud(p, isDemo) {
    if (!_active) return;

    const dsPre = isDemo ? 'K10Motorsports.Plugin.Demo.DS.' : 'K10Motorsports.Plugin.DS.';
    const v = function(k) { return p[k] != null ? p[k] : 0; };

    // Position
    const pos = isDemo
      ? (+v('K10Motorsports.Plugin.Demo.Position') || 0)
      : (+v('DataCorePlugin.GameData.Position') || 0);
    const posEl = document.getElementById('dhPosition');
    if (posEl) posEl.textContent = pos > 0 ? 'P' + pos : 'P—';

    // Lap delta
    const lapDelta = +(p[dsPre + 'LapDelta']) || 0;
    const deltaEl = document.getElementById('dhLapDelta');
    if (deltaEl) {
      deltaEl.textContent = lapDelta === 0 ? '+0.000' : (lapDelta >= 0 ? '+' : '') + lapDelta.toFixed(3);
      deltaEl.classList.remove('dh-faster', 'dh-slower', 'dh-neutral');
      if (lapDelta < -0.05) deltaEl.classList.add('dh-faster');
      else if (lapDelta > 0.05) deltaEl.classList.add('dh-slower');
      else deltaEl.classList.add('dh-neutral');
    }

    // Last / Current lap number
    var bestLap = isDemo ? (+v('K10Motorsports.Plugin.Demo.BestLapTime') || 0) : (+v('DataCorePlugin.GameData.BestLapTime') || 0);
    var lastLap = isDemo ? (+v('K10Motorsports.Plugin.Demo.LastLapTime') || 0) : (+v('DataCorePlugin.GameData.LastLapTime') || 0);
    var curLap = isDemo ? (+v('K10Motorsports.Plugin.Demo.CurrentLap') || 0) : (+v('DataCorePlugin.GameData.CurrentLap') || 0);
    var lastEl = document.getElementById('dhLastLap');
    var lapEl = document.getElementById('dhCurrentLap');
    if (lastEl) lastEl.textContent = lastLap > 0 ? _fmtLapTime(lastLap) : '—';
    if (lapEl) lapEl.textContent = curLap > 0 ? curLap : '—';

    // Live lap time + delta to best (absolutely positioned, centered)
    var liveCurrentTime = isDemo
      ? (+(p['K10Motorsports.Plugin.Demo.CurrentLapTime']) || 0)
      : (+(p['DataCorePlugin.GameData.CurrentLapTime']) || 0);
    var liveTimeEl = document.getElementById('dhLiveTime');
    var liveDeltaEl = document.getElementById('dhLiveDelta');
    if (liveTimeEl) {
      liveTimeEl.textContent = liveCurrentTime > 0.5 ? _fmtLapTime(liveCurrentTime) : '—';
    }
    if (liveDeltaEl && liveCurrentTime > 0.5) {
      // Use the real-time delta from the big display (same source, already computed)
      if (liveCurrentTime > 5 && Math.abs(lapDelta) < 300) {
        var sign = lapDelta >= 0 ? '+' : '';
        liveDeltaEl.textContent = sign + lapDelta.toFixed(3);
        liveDeltaEl.className = 'dh-live-delta';
        if (lapDelta <= -0.5) liveDeltaEl.classList.add('dh-delta-pb');
        else if (lapDelta < 0) liveDeltaEl.classList.add('dh-delta-faster');
        else if (lapDelta < 1.0) liveDeltaEl.classList.add('dh-delta-slower');
        else liveDeltaEl.classList.add('dh-delta-much-slower');
      } else {
        liveDeltaEl.textContent = '';
      }
    } else if (liveDeltaEl) {
      liveDeltaEl.textContent = '';
    }

    // Sectors (from plugin — N-sector support)
    var curSector = +(p[dsPre + 'CurrentSector']) || 1;
    var sectorCount = +(p[dsPre + 'SectorCount']) || 3;
    var splitsStr = p[dsPre + 'SectorSplits'] || '';
    var splits, deltas, states;
    if (splitsStr) {
      splits = splitsStr.split(',').map(Number);
      deltas = (p[dsPre + 'SectorDeltas'] || '').split(',').map(Number);
      states = (p[dsPre + 'SectorStates'] || '').split(',').map(Number);
    } else {
      splits = [+(p[dsPre + 'SectorSplitS1']) || 0, +(p[dsPre + 'SectorSplitS2']) || 0, +(p[dsPre + 'SectorSplitS3']) || 0];
      deltas = [+(p[dsPre + 'SectorDeltaS1']) || 0, +(p[dsPre + 'SectorDeltaS2']) || 0, +(p[dsPre + 'SectorDeltaS3']) || 0];
      states = [+(p[dsPre + 'SectorStateS1']) || 0, +(p[dsPre + 'SectorStateS2']) || 0, +(p[dsPre + 'SectorStateS3']) || 0];
    }
    var stateClass = ['', 'dh-s-pb', 'dh-s-faster', 'dh-s-slower'];
    var currentLapTime = isDemo
      ? (+(p['K10Motorsports.Plugin.Demo.CurrentLapTime']) || 0)
      : (+(p['DataCorePlugin.GameData.CurrentLapTime']) || 0);

    // Dynamically create/update drive HUD sector cells
    var dhSectorsEl = document.querySelector('.dh-sectors');
    if (dhSectorsEl) {
      var existingCells = dhSectorsEl.querySelectorAll('.dh-sector');
      if (existingCells.length !== sectorCount) {
        dhSectorsEl.innerHTML = '';
        for (var ci = 1; ci <= sectorCount; ci++) {
          var cell = document.createElement('div');
          cell.className = 'dh-sector';
          cell.id = 'dhS' + ci;
          cell.innerHTML = '<div class="dh-sec-label">S' + ci + '</div>' +
            '<div class="dh-sec-time" id="dhS' + ci + 'Time">—</div>' +
            '<div class="dh-sec-delta" id="dhS' + ci + 'Delta"></div>';
          dhSectorsEl.appendChild(cell);
        }
      }
    }

    for (var si = 1; si <= sectorCount; si++) {
      var cell = document.getElementById('dhS' + si);
      var timeEl = document.getElementById('dhS' + si + 'Time');
      var sDeltaEl = document.getElementById('dhS' + si + 'Delta');
      if (!cell || !timeEl) continue;

      cell.classList.remove('dh-s-pb', 'dh-s-faster', 'dh-s-slower', 'dh-s-invalid', 'dh-s-active');

      // If lap is invalid (incident occurred), mark all sectors red
      if (_lapInvalid) cell.classList.add('dh-s-invalid');

      if (si === curSector) {
        cell.classList.add('dh-s-active');
        var entryTime = 0;
        for (var k = 0; k < si - 1; k++) entryTime += splits[k] || 0;
        var elapsed = currentLapTime > entryTime ? currentLapTime - entryTime : currentLapTime;
        var em = Math.floor(elapsed / 60);
        var es = elapsed % 60;
        timeEl.textContent = elapsed > 0 ? ((em > 0 ? em + ':' : '') + (em > 0 && es < 10 ? '0' : '') + es.toFixed(1)) : '—';
        if (sDeltaEl) {
          if (lapDelta !== 0) {
            sDeltaEl.textContent = (lapDelta >= 0 ? '+' : '') + lapDelta.toFixed(2);
            cell.classList.add(lapDelta < 0 ? 'dh-s-faster' : 'dh-s-slower');
          } else { sDeltaEl.textContent = ''; }
        }
      } else if (splits[si - 1] > 0) {
        var split = splits[si - 1];
        var m = Math.floor(split / 60);
        var s = split % 60;
        timeEl.textContent = (m > 0 ? m + ':' : '') + (m > 0 && s < 10 ? '0' : '') + s.toFixed(1);
        if (stateClass[states[si - 1]]) cell.classList.add(stateClass[states[si - 1]]);
        if (sDeltaEl) {
          var d = deltas[si - 1];
          if (states[si - 1] === 1) sDeltaEl.textContent = 'PB';
          else if (d !== 0) sDeltaEl.textContent = (d >= 0 ? '+' : '') + d.toFixed(2);
          else sDeltaEl.textContent = '';
        }
      } else {
        timeEl.textContent = '—';
        if (sDeltaEl) sDeltaEl.textContent = '';
      }
    }

    // Incidents
    var incCount = +(p[dsPre + 'IncidentCount']) || 0;
    var incEl = document.getElementById('dhIncCount');
    if (incEl) incEl.innerHTML = incCount + '<span class="dh-inc-x">x</span>';
    var penEl = document.getElementById('dhIncToPen');
    var dqEl = document.getElementById('dhIncToDQ');
    var isNonRace = !!(+(p[dsPre + 'IsNonRaceSession']) || 0);
    var sdkPen = isNonRace ? 0 : (+(p[dsPre + 'IncidentLimitPenalty']) || 0);
    var sdkDQ  = isNonRace ? 0 : (+(p[dsPre + 'IncidentLimitDQ']) || 0);
    var dhThresh = document.querySelector('.dh-inc-thresholds');
    if (sdkPen > 0 && sdkDQ > 0) {
      // Both penalty and DQ
      if (penEl) penEl.textContent = Math.max(0, sdkPen - incCount);
      if (dqEl) dqEl.textContent = Math.max(0, sdkDQ - incCount);
      if (dhThresh) dhThresh.style.display = '';
      if (penEl) penEl.nextSibling.textContent = ' to pen ';
    } else if (sdkDQ > 0) {
      // DQ only — hide penalty, show DQ
      if (penEl) { penEl.textContent = ''; penEl.nextSibling.textContent = ''; }
      if (dqEl) dqEl.textContent = Math.max(0, sdkDQ - incCount);
      if (dhThresh) dhThresh.style.display = '';
    } else {
      // No limits (practice, test, etc.) — hide thresholds row
      if (dhThresh) dhThresh.style.display = 'none';
    }

    // Track map — local zoom view centered on player + opponents
    var mapReady = +v('K10Motorsports.Plugin.TrackMap.Ready') || 0;
    if (mapReady) {
      var svgPath = (p['K10Motorsports.Plugin.TrackMap.SvgPath'] || '');
      var dhTrack = document.getElementById('dhMapTrack');
      if (dhTrack && svgPath && dhTrack.getAttribute('d') !== svgPath) {
        dhTrack.setAttribute('d', svgPath);
        if (typeof _splitPathIntoSectors === 'function') {
          var boundaryPcts = Array.isArray(window._sectorBoundaries) ? window._sectorBoundaries : null;
          var sPaths = _splitPathIntoSectors(svgPath, boundaryPcts);
          // Dynamically create/update sector paths inside the rotate group
          var dhRotateGrp = document.getElementById('dhMapRotateGroup');
          if (dhRotateGrp) {
            dhRotateGrp.querySelectorAll('.map-sector').forEach(function(el) { el.remove(); });
            var dhOpp = document.getElementById('dhMapOpponents');
            for (var i = 0; i < sPaths.length; i++) {
              var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              path.classList.add('map-sector');
              path.id = 'dhSector' + (i + 1);
              path.setAttribute('d', sPaths[i]);
              if (dhOpp) dhRotateGrp.insertBefore(path, dhOpp);
              else dhRotateGrp.appendChild(path);
            }
          }
        }
      }

      var px = Math.max(0, Math.min(100, +v('K10Motorsports.Plugin.TrackMap.PlayerX') || 50));
      var py = Math.max(0, Math.min(100, +v('K10Motorsports.Plugin.TrackMap.PlayerY') || 50));

      // Update player dot
      var dhPlayer = document.getElementById('dhMapPlayer');
      if (dhPlayer) {
        dhPlayer.setAttribute('cx', px.toFixed(1));
        dhPlayer.setAttribute('cy', py.toFixed(1));
      }

      // Zoom viewBox: always centered on player, no edge clamping
      // Use a wider view (±22 units) and rotate so driving direction is up
      var dhSvg = document.getElementById('dhMapSvg');
      if (dhSvg) {
        var zr = 22; // wider zoom — less claustrophobic
        // Center on player without clamping — no premature cropping
        var vx = px - zr;
        var vy = py - zr;
        dhSvg.setAttribute('viewBox', vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' + (zr * 2) + ' ' + (zr * 2));

        // Rotate map so driving direction always points up.
        // Apply LERP smoothing to eliminate heading judder, with correct
        // wrap-around handling at the 0°/360° boundary.
        var rawHeading = +(p['K10Motorsports.Plugin.TrackMap.PlayerHeading']) || 0;
        var diff = rawHeading - _dhHeadingSmooth;
        // Normalise diff to [-180, 180] to pick the shortest rotation arc
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        _dhHeadingSmooth += diff * 0.18; // LERP factor — tweak for more/less lag
        _dhHeadingSmooth = ((_dhHeadingSmooth % 360) + 360) % 360;

        // Rotate the inner group around the player's SVG coordinate, NOT the
        // SVG element itself (element rotation caused rectangular crop artefacts).
        var dhRotateGroup = document.getElementById('dhMapRotateGroup');
        if (dhRotateGroup) {
          var rotDeg = (-_dhHeadingSmooth).toFixed(2);
          dhRotateGroup.setAttribute('transform',
            'rotate(' + rotDeg + ',' + px.toFixed(1) + ',' + py.toFixed(1) + ')');
        }
        // Player dot stays outside the rotate group, so no counter-rotation needed
        dhSvg.style.transform = '';
        dhSvg.style.transformOrigin = '';
      }

      // Opponents
      var opponentStr = p['K10Motorsports.Plugin.TrackMap.Opponents'] || '';
      var dhOppG = document.getElementById('dhMapOpponents');
      if (dhOppG) {
        var parts = opponentStr ? opponentStr.split(';').filter(function(s) { return s.length > 0; }) : [];
        var count = Math.min(parts.length, 63);

        // Ensure enough circle elements
        while (dhOppG.children.length < count) {
          var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.classList.add('map-opponent');
          c.setAttribute('r', '1.5');
          dhOppG.appendChild(c);
        }
        while (dhOppG.children.length > count) {
          dhOppG.removeChild(dhOppG.lastChild);
        }

        for (var oi = 0; oi < count; oi++) {
          var seg = parts[oi].split(',');
          if (seg.length < 2) continue;
          var ox = Math.max(0, Math.min(100, +seg[0]));
          var oy = Math.max(0, Math.min(100, +seg[1]));
          var inPit = seg[2] === '1';
          dhOppG.children[oi].setAttribute('cx', String(ox));
          dhOppG.children[oi].setAttribute('cy', String(oy));
          dhOppG.children[oi].style.display = inPit ? 'none' : '';
          // Highlight nearby opponents
          var dx = px - ox, dy = py - oy;
          var close = (dx * dx + dy * dy) < 64;
          dhOppG.children[oi].classList.toggle('close', close);
        }
      }

      // Sector colors
      if (window._sectorData) {
        var sd = window._sectorData;
        var sColors = ['transparent', 'hsl(280,60%,55%)', 'hsl(130,60%,50%)', 'hsl(0,65%,50%)'];
        for (var j = 1; j <= sd.sectorCount; j++) {
          var sEl = document.getElementById('dhSector' + j);
          if (!sEl) continue;
          sEl.setAttribute('stroke', j === sd.curSector ? 'hsla(0,0%,100%,0.25)' : (sColors[sd.states[j-1]] || 'transparent'));
        }
      }
    }

    // Track name
    var nameEl = document.getElementById('dhMapName');
    var trackName = p['DataCorePlugin.GameData.TrackName'] || '';
    if (nameEl && trackName) nameEl.textContent = trackName;
  }
  window.updateDriveHud = updateDriveHud;

  // ── Make _splitPathIntoSectors available globally ──
  // (it's defined in webgl-helpers.js, exposed here for drive hud)

  // ── Init ──
  function initDriveHud() {
    // Listen for Ctrl+Shift+F via Electron
    if (window.k10 && window.k10.onToggleDriveMode) {
      window.k10.onToggleDriveMode(toggleDriveMode);
    }

    // Auto-activate on remote server connections
    if (window._k10RemoteMode) {
      setDriveMode(true);
    }

    // Restore persisted state
    if (_settings.driveMode) {
      setDriveMode(true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDriveHud);
  } else {
    initDriveHud();
  }
})();
