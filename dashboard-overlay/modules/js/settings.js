// Settings system
  // _defaultSettings, _settings, _forceFlagState declared in config.js

  // Section class/id → element finder
  function _findSectionEls(sectionKey) {
    // Try as ID first, then as class
    let el = document.getElementById(sectionKey);
    if (el) return [el];
    return Array.from(document.querySelectorAll('.' + sectionKey));
  }

  function applySettings() {
    const toggles = document.querySelectorAll('.settings-toggle[data-key]');
    toggles.forEach(t => {
      const key = t.dataset.key;
      const on = _settings[key] !== false;
      t.classList.toggle('on', on);

      const els = _findSectionEls(t.dataset.section);
      els.forEach(el => el.classList.toggle('section-hidden', !on));
    });

    // Parent column collapse: hide wrappers when all children hidden
    _collapseParentColumns();

    // SimHub URL
    const urlInput = document.getElementById('settingsSimhubUrl');
    if (urlInput) urlInput.value = _settings.simhubUrl || 'http://localhost:8889/k10mediabroadcaster/';
    // Restore saved URL override so polling uses the persisted URL
    if (_settings.simhubUrl && _settings.simhubUrl !== SIMHUB_URL) {
      window._simhubUrlOverride = _settings.simhubUrl;
    }

    // Green screen toggle — reflect saved state
    const gsToggle = document.getElementById('greenScreenToggle');
    if (gsToggle) gsToggle.classList.toggle('on', _settings.greenScreen === true);
    // Body class for CSS targeting
    document.body.classList.toggle('green-screen-mode', _settings.greenScreen === true);

    // WebGL effects toggle
    const webglOn = _settings.showWebGL !== false;
    document.querySelectorAll('.gl-overlay').forEach(c => {
      c.style.display = webglOn ? '' : 'none';
    });

    // Ambient light mode — migrate legacy boolean to 3-way string
    if (typeof _settings.showAmbientLight === 'boolean') {
      _settings.ambientMode = _settings.showAmbientLight ? 'reflective' : 'off';
      delete _settings.showAmbientLight;
    }
    const ambMode = _settings.ambientMode || 'reflective';
    if (typeof applyAmbientMode === 'function') applyAmbientMode(ambMode);
    const ambSel = document.getElementById('settingsAmbientMode');
    if (ambSel) ambSel.value = ambMode;
    // Restore saved capture region and send to main process
    if (typeof window.restoreAmbientCapture === 'function') window.restoreAmbientCapture();

    // Bonkers pit limiter toggle
    document.body.classList.toggle('bonkers-off', _settings.showBonkers === false);

    // Layout — all behavior is deterministic from position choice
    applyLayout();

    // Zoom
    const zoomVal = _settings.zoom || 100;
    const zoomSlider = document.getElementById('settingsZoom');
    const zoomLabel = document.getElementById('zoomVal');
    if (zoomSlider) zoomSlider.value = zoomVal;
    if (zoomLabel) zoomLabel.textContent = zoomVal + '%';
    applyZoom(zoomVal);

    // Force flag
    _forceFlagState = _settings.forceFlag || '';
    const flagSelect = document.getElementById('settingsForceFlag');
    if (flagSelect) flagSelect.value = _forceFlagState;

    // Rally mode
    _rallyModeEnabled = _settings.rallyMode || false;
    _isRally = isRallyGame() || _rallyModeEnabled;

    // Sync layout rally toggle (will be updated again when Discord state loads)
    const layoutRallyToggle = document.getElementById('layoutRallyToggle');
    if (layoutRallyToggle) layoutRallyToggle.classList.toggle('on', _rallyModeEnabled);

    // Drive mode toggle sync
    const dmToggle = document.getElementById('driveModeToggle');
    if (dmToggle) dmToggle.classList.toggle('on', _settings.driveMode === true);
    if (_settings.driveMode && typeof setDriveMode === 'function') setDriveMode(true);

    // Leaderboard settings
    const lbFocusSelect = document.getElementById('settingsLbFocus');
    if (lbFocusSelect) lbFocusSelect.value = _settings.lbFocus || 'me';
    const lbMaxSelect = document.getElementById('settingsLbMaxRows');
    if (lbMaxSelect) lbMaxSelect.value = String(_settings.lbMaxRows || 5);
    const lbExpandToggle = document.getElementById('lbExpandToggle');
    if (lbExpandToggle) lbExpandToggle.classList.toggle('on', _settings.lbExpandToFill === true);

    // Datastream field toggles
    applyDsFieldToggles();
  }

  function _collapseParentColumns() {
    // Fuel + Tyres share fuel-tyres-col
    const ftCol = document.querySelector('.fuel-tyres-col');
    if (ftCol) {
      const fuelHidden = _settings.showFuel === false;
      const tyresHidden = _settings.showTyres === false;
      ftCol.classList.toggle('section-hidden', fuelHidden && tyresHidden);
    }
    // Controls + Pedals share controls-pedals-block
    const cpBlock = document.querySelector('.controls-pedals-block');
    if (cpBlock) {
      const ctrlHidden = _settings.showControls === false;
      const pedalsHidden = _settings.showPedals === false;
      cpBlock.classList.toggle('section-hidden', ctrlHidden && pedalsHidden);
    }
    // Logo column: hide if both logos hidden
    const logoCol = document.querySelector('.logo-col');
    if (logoCol) {
      const k10Hidden = _settings.showK10Logo === false;
      const carHidden = _settings.showCarLogo === false;
      logoCol.classList.toggle('section-hidden', k10Hidden && carHidden);
    }
  }

  function switchSettingsTab(tab) {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.toggle('active', c.id === 'settingsTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)));
    // Refresh connection status when switching to Connections tab
    if (tabName === 'connections') updateConnectionsTab();
  }

  // ── Leaderboard settings ──

  function updateLbFocus(value) {
    _settings.lbFocus = value;
    _lbLastJson = ''; // force re-render
    saveSettings();
  }

  function updateLbMaxRows(value) {
    _settings.lbMaxRows = Math.max(1, Math.min(40, +value || 5));
    _lbLastJson = '';
    saveSettings();
  }

  function toggleLbExpand(el) {
    const isOn = el.classList.contains('on');
    el.classList.toggle('on', !isOn);
    _settings.lbExpandToFill = !isOn;
    _lbLastJson = '';
    saveSettings();
  }

  // ── Datastream field toggles ──

  function toggleDsSetting(el) {
    const key = el.dataset.key;
    if (!key) return;
    const isOn = el.classList.contains('on');
    _settings[key] = !isOn;
    el.classList.toggle('on', !isOn);
    applyDsFieldToggles();
    saveSettings();
  }

  function applyDsFieldToggles() {
    document.querySelectorAll('[data-ds-field]').forEach(el => {
      const key = el.dataset.dsField;
      const show = _settings[key] !== false;
      el.style.display = show ? '' : 'none';
    });
  }

  // ═══════════════════════════════════════════════════════════════
