// ═══════════════════════════════════════════════════════════════
//  DRIVE HUD — Driver-focused full-screen mode
//  Shows: track map + sectors, lap delta, position, spotter, incidents
//  Ctrl+Shift+F to toggle. Auto-activates on remote server connections.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  let _active = false;

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

    const dsPre = isDemo ? 'K10MediaBroadcaster.Plugin.Demo.DS.' : 'K10MediaBroadcaster.Plugin.DS.';
    const v = function(k) { return p[k] != null ? p[k] : 0; };

    // Position
    const pos = isDemo
      ? (+v('K10MediaBroadcaster.Plugin.Demo.Position') || 0)
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

    // Best / Last / Current lap
    var bestLap = isDemo ? (+v('K10MediaBroadcaster.Plugin.Demo.BestLapTime') || 0) : (+v('DataCorePlugin.GameData.BestLapTime') || 0);
    var lastLap = isDemo ? (+v('K10MediaBroadcaster.Plugin.Demo.LastLapTime') || 0) : (+v('DataCorePlugin.GameData.LastLapTime') || 0);
    var curLap = isDemo ? (+v('K10MediaBroadcaster.Plugin.Demo.CurrentLap') || 0) : (+v('DataCorePlugin.GameData.CurrentLap') || 0);
    var bestEl = document.getElementById('dhBestLap');
    var lastEl = document.getElementById('dhLastLap');
    var lapEl = document.getElementById('dhCurrentLap');
    if (bestEl) bestEl.textContent = bestLap > 0 ? _fmtLapTime(bestLap) : '—';
    if (lastEl) lastEl.textContent = lastLap > 0 ? _fmtLapTime(lastLap) : '—';
    if (lapEl) lapEl.textContent = curLap > 0 ? curLap : '—';

    // Sectors (from plugin)
    var curSector = +(p[dsPre + 'CurrentSector']) || 1;
    var splits = [+(p[dsPre + 'SectorSplitS1']) || 0, +(p[dsPre + 'SectorSplitS2']) || 0, +(p[dsPre + 'SectorSplitS3']) || 0];
    var deltas = [+(p[dsPre + 'SectorDeltaS1']) || 0, +(p[dsPre + 'SectorDeltaS2']) || 0, +(p[dsPre + 'SectorDeltaS3']) || 0];
    var states = [+(p[dsPre + 'SectorStateS1']) || 0, +(p[dsPre + 'SectorStateS2']) || 0, +(p[dsPre + 'SectorStateS3']) || 0];
    var stateClass = ['', 'dh-s-pb', 'dh-s-faster', 'dh-s-slower'];
    var currentLapTime = isDemo
      ? (+(p['K10MediaBroadcaster.Plugin.Demo.CurrentLapTime']) || 0)
      : (+(p['DataCorePlugin.GameData.CurrentLapTime']) || 0);

    for (var si = 1; si <= 3; si++) {
      var cell = document.getElementById('dhS' + si);
      var timeEl = document.getElementById('dhS' + si + 'Time');
      var sDeltaEl = document.getElementById('dhS' + si + 'Delta');
      if (!cell || !timeEl) continue;

      cell.classList.remove('dh-s-pb', 'dh-s-faster', 'dh-s-slower', 'dh-s-active');

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
    var sdkPen = +(p[dsPre + 'IncidentLimitPenalty']) || 0;
    var sdkDQ  = +(p[dsPre + 'IncidentLimitDQ']) || 0;
    var penLimit = sdkPen > 0 ? sdkPen : ((typeof _settings !== 'undefined' && _settings.incPenalty) || 17);
    var dqLimit  = sdkDQ  > 0 ? sdkDQ  : ((typeof _settings !== 'undefined' && _settings.incDQ)      || 25);
    if (penEl) penEl.textContent = Math.max(0, penLimit - incCount);
    if (dqEl) dqEl.textContent = Math.max(0, dqLimit - incCount);

    // Track map — local zoom view centered on player + opponents
    var mapReady = +v('K10MediaBroadcaster.Plugin.TrackMap.Ready') || 0;
    if (mapReady) {
      var svgPath = (p['K10MediaBroadcaster.Plugin.TrackMap.SvgPath'] || '');
      var dhTrack = document.getElementById('dhMapTrack');
      if (dhTrack && svgPath && dhTrack.getAttribute('d') !== svgPath) {
        dhTrack.setAttribute('d', svgPath);
        if (typeof _splitPathIntoSectors === 'function') {
          var sPaths = _splitPathIntoSectors(svgPath);
          for (var i = 1; i <= 3; i++) {
            var el = document.getElementById('dhSector' + i);
            if (el) el.setAttribute('d', sPaths[i - 1]);
          }
        }
      }

      var px = Math.max(0, Math.min(100, +v('K10MediaBroadcaster.Plugin.TrackMap.PlayerX') || 50));
      var py = Math.max(0, Math.min(100, +v('K10MediaBroadcaster.Plugin.TrackMap.PlayerY') || 50));

      // Update player dot
      var dhPlayer = document.getElementById('dhMapPlayer');
      if (dhPlayer) {
        dhPlayer.setAttribute('cx', px.toFixed(1));
        dhPlayer.setAttribute('cy', py.toFixed(1));
      }

      // Zoom viewBox: track the player with a ±15 unit window
      var dhSvg = document.getElementById('dhMapSvg');
      if (dhSvg) {
        var zr = 15;
        var vx = Math.max(0, Math.min(100 - zr * 2, px - zr));
        var vy = Math.max(0, Math.min(100 - zr * 2, py - zr));
        dhSvg.setAttribute('viewBox', vx.toFixed(1) + ' ' + vy.toFixed(1) + ' ' + (zr * 2) + ' ' + (zr * 2));
      }

      // Opponents
      var opponentStr = p['K10MediaBroadcaster.Plugin.TrackMap.Opponents'] || '';
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
        for (var j = 1; j <= 3; j++) {
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
