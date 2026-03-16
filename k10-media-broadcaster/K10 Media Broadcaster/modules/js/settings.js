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

    // Bonkers pit limiter toggle
    document.body.classList.toggle('bonkers-off', _settings.showBonkers === false);

    // Layout
    applyLayout();

    // Secondary layout
    applySecLayout();
    applySecOffset();
    // Restore secondary layout UI
    const secLayoutSelect = document.getElementById('settingsSecLayout');
    if (secLayoutSelect) secLayoutSelect.value = _settings.secLayout || 'stack';
    const secOxSlider = document.getElementById('settingsSecOffsetX');
    if (secOxSlider) { secOxSlider.value = _settings.secOffsetX || 0; document.getElementById('secOffsetXVal').textContent = (_settings.secOffsetX || 0) + 'px'; }
    const secOySlider = document.getElementById('settingsSecOffsetY');
    if (secOySlider) { secOySlider.value = _settings.secOffsetY || 0; document.getElementById('secOffsetYVal').textContent = (_settings.secOffsetY || 0) + 'px'; }

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

  // ═══════════════════════════════════════════════════════════════
