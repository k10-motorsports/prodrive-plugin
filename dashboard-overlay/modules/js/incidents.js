// Incidents module renderer

  // ═══════════════════════════════════════════════════════════════
  //  INCIDENTS MODULE RENDERER
  // ═══════════════════════════════════════════════════════════════
  function updateIncidents(p, isDemo) {
    const panel = document.getElementById('incidentsPanel');
    if (!panel || panel.classList.contains('section-hidden')) return;
    const pre = isDemo ? 'K10MediaBroadcaster.Plugin.Demo.DS.' : 'K10MediaBroadcaster.Plugin.DS.';
    const incidentCount = +(p[pre + 'IncidentCount']) || 0;

    const countEl = document.getElementById('incCount');
    if (!countEl) return;
    countEl.textContent = incidentCount;

    // Flash on increment
    if (_dsPrevIncidents >= 0 && incidentCount > _dsPrevIncidents) {
      countEl.classList.remove('inc-flash');
      void countEl.offsetWidth;
      countEl.classList.add('inc-flash');
    }
    _dsPrevIncidents = incidentCount;

    // Progressive color level: 0=green, 5=red
    // 0x=0, 1-2x=1, 3-4x=2, 5-6x=3, 7-9x=4, 10+=5
    let level;
    if (incidentCount === 0) level = 0;
    else if (incidentCount <= 2) level = 1;
    else if (incidentCount <= 4) level = 2;
    else if (incidentCount <= 6) level = 3;
    else if (incidentCount <= 9) level = 4;
    else level = 5;

    for (let i = 0; i <= 5; i++) panel.classList.toggle('inc-level-' + i, i === level);

    // Threshold counters — remaining incidents to penalty / DQ
    // Read from the iRacing SDK via the plugin (parsed from session YAML WeekendOptions).
    // Falls back to config defaults if the plugin hasn't provided values yet.
    // In non-race sessions, set thresholds to Infinity so they never trigger.
    let penLimit, dqLimit;

    // Check if we're in a non-race session (practice, qualifying, etc.)
    const isNonRaceSession = !p['K10MediaBroadcaster.Plugin.DS.IsRaceSession'];
    if (isNonRaceSession) {
      penLimit = Infinity;
      dqLimit = Infinity;
    } else {
      // Read real limits from the iRacing SDK (0 = not available yet)
      const sdkPen = +(p[pre + 'IncidentLimitPenalty']) || 0;
      const sdkDQ  = +(p[pre + 'IncidentLimitDQ']) || 0;
      penLimit = sdkPen > 0 ? sdkPen : ((typeof _settings !== 'undefined' && _settings.incPenalty) || 17);
      dqLimit  = sdkDQ  > 0 ? sdkDQ  : ((typeof _settings !== 'undefined' && _settings.incDQ)      || 25);
    }
    const toPen = Math.max(0, penLimit - incidentCount);
    const toDQ  = Math.max(0, dqLimit - incidentCount);

    const penEl = document.getElementById('incToPen');
    const dqEl  = document.getElementById('incToDQ');
    if (penEl) {
      // Display ∞ when penLimit is Infinity, otherwise show number or PENALTY
      if (penLimit === Infinity) {
        penEl.textContent = '\u221E';
      } else {
        penEl.textContent = toPen > 0 ? toPen : 'PENALTY';
      }
      penEl.className = 'inc-thresh-val' + (toPen === 0 && penLimit !== Infinity ? ' thresh-hit' : toPen <= 3 && penLimit !== Infinity ? ' thresh-crit' : toPen <= 6 && penLimit !== Infinity ? ' thresh-near' : '');
    }
    if (dqEl) {
      // Display ∞ when dqLimit is Infinity, otherwise show number or DQ
      if (dqLimit === Infinity) {
        dqEl.textContent = '\u221E';
      } else {
        dqEl.textContent = toDQ > 0 ? toDQ : 'DQ';
      }
      dqEl.className = 'inc-thresh-val' + (toDQ === 0 && dqLimit !== Infinity ? ' thresh-hit' : toDQ <= 3 && dqLimit !== Infinity ? ' thresh-crit' : toDQ <= 6 && dqLimit !== Infinity ? ' thresh-near' : '');
    }

    // ── Progress bar: accrued fill + penalty / DQ markers ──
    const barFill = document.getElementById('incBarFill');
    const markerPen = document.getElementById('incMarkerPen');
    const markerDQ = document.getElementById('incMarkerDQ');
    if (barFill && markerPen && markerDQ) {
      // When dqLimit is Infinity (non-race sessions), set fill to 0% and hide markers
      if (dqLimit === Infinity) {
        barFill.style.width = '0%';
        markerPen.style.display = 'none';
        markerDQ.style.display = 'none';
      } else {
        // Bar represents 0 → dqLimit, fill shows accrued
        const fillPct = Math.min(100, (incidentCount / dqLimit) * 100);
        barFill.style.width = fillPct + '%';

        // Penalty marker position along the bar
        const penPct = Math.min(100, (penLimit / dqLimit) * 100);
        markerPen.style.left = penPct + '%';
        markerPen.style.display = 'block';
        // DQ marker is always at the end
        markerDQ.style.left = '100%';
        markerDQ.style.display = 'block';

        // Hide penalty marker if already past it
        markerPen.style.opacity = incidentCount >= penLimit ? '0.3' : '0.7';
      }
    }

    // ── WebGL fire effect at thresholds ──
    if (window.setIncidentsGL) {
      if (toDQ === 0) {
        window.setIncidentsGL('dq');
      } else if (toPen === 0) {
        window.setIncidentsGL('penalty');
      } else {
        window.setIncidentsGL('');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
