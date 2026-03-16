// Connections tab

  // ═══════════════════════════════════════════════════════════════
  //  CONNECTIONS TAB — SimHub & Discord status
  // ═══════════════════════════════════════════════════════════════

  const DISCORD_GUILD_INVITE = 'https://discord.gg/k10mediabroadcaster';
  // _discordUser declared in config.js
  let _discordConnecting = false;

  function updateConnectionsTab() {
    updateSimhubConnectionCard();
    updateDiscordConnectionCard();
  }

  // ── SimHub connection card ──
  function updateSimhubConnectionCard() {
    const dot = document.getElementById('connSimhubDot');
    const text = document.getElementById('connSimhubText');
    const urlEl = document.getElementById('connSimhubUrl');
    const urlInput = document.getElementById('settingsSimhubUrl');
    const currentUrl = window._simhubUrlOverride || SIMHUB_URL;

    if (urlEl) urlEl.textContent = currentUrl;
    if (urlInput) urlInput.value = currentUrl;

    // Derive state from the existing connection status
    const connEl = document.getElementById('connStatus');
    const state = connEl ? (connEl.classList.contains('connected') ? 'connected' :
                            connEl.classList.contains('disconnected') ? 'disconnected' : 'connecting') : 'connecting';

    if (dot) {
      dot.className = 'conn-dot ' + (state === 'connected' ? 'green' : state === 'disconnected' ? 'red' : 'orange');
    }
    if (text) {
      if (state === 'connected') text.innerHTML = '<strong>Connected</strong> — receiving telemetry';
      else if (state === 'disconnected') text.innerHTML = '<strong>Disconnected</strong> — check SimHub is running';
      else text.innerHTML = 'Connecting...';
    }
  }

  // ── Discord connection card ──
  function updateDiscordConnectionCard() {
    const notConn = document.getElementById('discordNotConnected');
    const conn = document.getElementById('discordConnected');
    if (!notConn || !conn) return;

    if (_discordUser) {
      notConn.style.display = 'none';
      conn.style.display = '';
      const nameEl = document.getElementById('discordDisplayName');
      const idEl = document.getElementById('discordUserId');
      const avatarEl = document.getElementById('discordAvatar');
      if (nameEl) nameEl.textContent = _discordUser.globalName || _discordUser.username;
      if (idEl) idEl.textContent = _discordUser.id;
      if (avatarEl && _discordUser.avatar) {
        avatarEl.src = `https://cdn.discordapp.com/avatars/${_discordUser.id}/${_discordUser.avatar}.png?size=64`;
        avatarEl.alt = _discordUser.globalName || _discordUser.username;
      }
    } else {
      notConn.style.display = '';
      conn.style.display = 'none';
    }

    // Show game features card when Discord is connected
    const gameCard = document.getElementById('gameFeatureCard');
    if (gameCard) gameCard.style.display = _discordUser ? '' : 'none';

    // Update layout section rally toggle
    updateLayoutRallyToggle();
    syncRallyToggles();
  }

  async function connectDiscord() {
    if (_discordConnecting) return;
    if (!window.k10 || !window.k10.discordConnect) {
      // Fallback: open invite link directly in browser
      openDiscordInvite();
      return;
    }

    _discordConnecting = true;
    const btn = document.getElementById('discordConnectBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }

    try {
      const result = await window.k10.discordConnect();
      if (result && result.success && result.user) {
        _discordUser = result.user;
        _settings.discordUser = result.user;
        saveSettings();
        updateDiscordConnectionCard();
      } else {
        const errMsg = result?.error || 'Connection failed';
        console.warn('[K10] Discord connect failed:', errMsg);
        const text = document.getElementById('connDiscordText');
        if (text) text.innerHTML = '<strong style="color:hsl(0,75%,60%)">Failed</strong> — ' + errMsg;
        // Reset after 3s
        setTimeout(() => {
          if (text) text.innerHTML = 'Not connected';
        }, 3000);
      }
    } catch (err) {
      console.error('[K10] Discord connect error:', err);
    } finally {
      _discordConnecting = false;
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;vertical-align:-1px;margin-right:4px"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg> Connect Discord'; }
    }
  }

  async function disconnectDiscord() {
    if (window.k10 && window.k10.discordDisconnect) {
      await window.k10.discordDisconnect();
    }
    _discordUser = null;
    delete _settings.discordUser;
    saveSettings();
    updateDiscordConnectionCard();
  }

  function openDiscordInvite() {
    if (window.k10 && window.k10.openExternal) {
      window.k10.openExternal(DISCORD_GUILD_INVITE);
    } else {
      window.open(DISCORD_GUILD_INVITE, '_blank');
    }
  }

  function toggleRallyMode(el) {
    const isOn = el.classList.contains('on');
    el.classList.toggle('on', !isOn);
    _rallyModeEnabled = !isOn;
    _settings.rallyMode = _rallyModeEnabled;
    _isRally = isRallyGame() || _rallyModeEnabled;
    applyGameMode();
    saveSettings();
    // Sync the layout section toggle
    syncRallyToggles();
  }

  function toggleLayoutRally(el) {
    // Ignore clicks when disabled (no Discord connection)
    if (el.classList.contains('disabled')) return;
    const isOn = el.classList.contains('on');
    el.classList.toggle('on', !isOn);
    _rallyModeEnabled = !isOn;
    _settings.rallyMode = _rallyModeEnabled;
    _isRally = isRallyGame() || _rallyModeEnabled;
    applyGameMode();
    saveSettings();
    // Sync the connections tab toggle
    syncRallyToggles();
  }

  /** Keep both rally toggles (layout + connections) in sync */
  function syncRallyToggles() {
    const layoutToggle = document.getElementById('layoutRallyToggle');
    const connToggle = document.querySelector('.settings-toggle[data-key="rallyMode"]:not(#layoutRallyToggle)');
    if (layoutToggle) layoutToggle.classList.toggle('on', _rallyModeEnabled);
    if (connToggle) connToggle.classList.toggle('on', _rallyModeEnabled);
  }

  /** Enable/disable the layout rally toggle based on Discord state */
  function updateLayoutRallyToggle() {
    const el = document.getElementById('layoutRallyToggle');
    const hint = document.getElementById('layoutRallyHint');
    if (!el) return;
    if (_discordUser) {
      el.classList.remove('disabled');
      if (hint) hint.style.display = 'none';
    } else {
      el.classList.add('disabled');
      el.classList.remove('on');
      if (hint) hint.style.display = '';
      // Force rally off when Discord disconnects
      _rallyModeEnabled = false;
      _settings.rallyMode = false;
      _isRally = isRallyGame();
    }
  }

  // Load Discord user on startup
  async function initDiscordState() {
    // Try loading from Electron's persisted file first
    if (window.k10 && window.k10.getDiscordUser) {
      try {
        const user = await window.k10.getDiscordUser();
        if (user && user.id) {
          _discordUser = user;
          updateDiscordConnectionCard();
          return;
        }
      } catch (e) { /* ok */ }
    }
    // Fallback: check settings
    if (_settings.discordUser && _settings.discordUser.id) {
      _discordUser = _settings.discordUser;
      updateDiscordConnectionCard();
    }
  }

  function toggleSetting(el) {
    const key = el.dataset.key;
    const isOn = el.classList.contains('on');
    _settings[key] = !isOn;
    el.classList.toggle('on', !isOn);

    const els = _findSectionEls(el.dataset.section);
    els.forEach(e => e.classList.toggle('section-hidden', isOn));

    _collapseParentColumns();

    saveSettings();
  }

  function toggleWebGL(el) {
    const isOn = el.classList.contains('on');
    const newVal = !isOn;
    el.classList.toggle('on', newVal);
    _settings.showWebGL = newVal;
    // Show/hide all WebGL overlay canvases
    document.querySelectorAll('.gl-overlay').forEach(c => {
      c.style.display = newVal ? '' : 'none';
    });
    saveSettings();
  }

  function toggleBonkers(el) {
    const isOn = el.classList.contains('on');
    const newVal = !isOn;
    el.classList.toggle('on', newVal);
    _settings.showBonkers = newVal;
    document.body.classList.toggle('bonkers-off', !newVal);
    saveSettings();
  }

  function updateSimhubUrl(url) {
    _settings.simhubUrl = url;
    // Update the polling constant (for standalone mode)
    if (typeof SIMHUB_URL !== 'undefined') {
      // Can't reassign const, but we can update the fetch function
      window._simhubUrlOverride = url;
    }
    saveSettings();
  }

  // ─── Green screen mode ───
  async function toggleGreenScreen(el) {
    const isOn = el.classList.contains('on');
    const newValue = !isOn;
    el.classList.toggle('on', newValue);
    _settings.greenScreen = newValue;
    document.getElementById('greenScreenHint').style.display = 'block';
    await saveSettings();
    // Electron's transparent property can't change at runtime — restart required
    if (window.k10 && window.k10.restartApp) {
      const hint = document.getElementById('greenScreenHint');
      hint.textContent = newValue
        ? 'Restarting into green-screen mode…'
        : 'Restarting into transparent overlay mode…';
      setTimeout(() => window.k10.restartApp(), 400);
    }
  }

  // ─── Layout management ───

  const _layoutPositionMap = {
    'top-right': 'layout-tr', 'top-left': 'layout-tl',
    'bottom-right': 'layout-br', 'bottom-left': 'layout-bl',
    'top-center': 'layout-tc', 'bottom-center': 'layout-bc'
  };

  function _resolveFlow(pos, explicitFlow) {
    // For corner positions, flow is determined by which side
    if (pos.includes('right')) return 'rtl';
    if (pos.includes('left')) return 'ltr';
    // For center positions, user picks
    return explicitFlow || 'ltr';
  }

  function applyLayout() {
    const dash = document.getElementById('dashboard');
    const pos = _settings.layoutPosition || 'top-right';
    const flow = _resolveFlow(pos, _settings.layoutFlow);
    const vswap = _settings.verticalSwap || false;

    // Clear all layout classes
    Object.values(_layoutPositionMap).forEach(c => dash.classList.remove(c));
    dash.classList.remove('flow-ltr', 'flow-rtl', 'vswap');

    // Apply position
    const layoutClass = _layoutPositionMap[pos] || 'layout-tr';
    dash.classList.add(layoutClass);

    // Apply flow
    dash.classList.add('flow-' + flow);

    // Apply vertical swap
    if (vswap) dash.classList.add('vswap');

    // Sync settings UI controls
    const posSelect = document.getElementById('settingsPosition');
    if (posSelect) posSelect.value = pos;

    const flowSelect = document.getElementById('settingsFlow');
    if (flowSelect) flowSelect.value = _settings.layoutFlow || 'ltr';

    const flowRow = document.getElementById('flowDirectionRow');
    if (flowRow) flowRow.style.display = pos.includes('center') ? '' : 'none';

    const vswapToggle = document.getElementById('vswapToggle');
    if (vswapToggle) vswapToggle.classList.toggle('on', vswap);

    // Secondary panels: oppose or same edge as dashboard (vertical + horizontal independently)
    const secVOppose = _settings.secVOppose !== false; // default true
    const secHOppose = _settings.secHOppose !== false; // default true
    const dashIsBottom = pos.includes('bottom');
    const dashIsRight = pos.includes('right');
    const dashIsLeft = pos.includes('left');
    const dashIsCenter = pos.includes('center');
    const secVert = secVOppose ? (dashIsBottom ? 'top' : 'bottom') : (dashIsBottom ? 'bottom' : 'top');

    // Horizontal: oppose flips side, same keeps it
    let secHoriz;
    if (dashIsCenter) secHoriz = 'center';
    else if (secHOppose) secHoriz = dashIsRight ? 'left' : 'right';
    else secHoriz = dashIsRight ? 'right' : 'left';

    // DS/Inc horizontal class names differ for center layout
    let dsHoriz = secHoriz, incHoriz = secHoriz;
    if (dashIsCenter) { dsHoriz = 'center-left'; incHoriz = 'center-left'; }

    // Sync toggle UIs
    const secVToggle = document.getElementById('secVOpposeToggle');
    if (secVToggle) secVToggle.classList.toggle('on', secVOppose);
    const secHToggle = document.getElementById('secHOpposeToggle');
    if (secHToggle) secHToggle.classList.toggle('on', secHOppose);

    // When on the same side as the dashboard (not opposed), we need to push
    // the secondary panels vertically past the dashboard so they don't overlap.
    // dash-h (200) + timer row (~30px) + gap (10px) = ~240px clearance
    const sameSideVOffset = (!secHOppose && !dashIsCenter) ? 250 : 0;

    // Position leaderboard
    const lb = document.getElementById('leaderboardPanel');
    if (lb) {
      lb.classList.remove('lb-top', 'lb-bottom', 'lb-left', 'lb-right', 'lb-center');
      lb.classList.add('lb-' + secVert);
      lb.classList.add('lb-' + secHoriz);
      // Apply same-side vertical offset
      if (sameSideVOffset && secVert === 'top') lb.style.marginTop = sameSideVOffset + 'px';
      else if (sameSideVOffset && secVert === 'bottom') lb.style.marginBottom = sameSideVOffset + 'px';
      else { lb.style.marginTop = ''; lb.style.marginBottom = ''; }
    }

    // Position datastream adjacent to leaderboard
    const ds = document.getElementById('datastreamPanel');
    if (ds) {
      ds.classList.remove('ds-top', 'ds-bottom', 'ds-left', 'ds-right', 'ds-center-left', 'ds-center-right');
      ds.classList.add('ds-' + secVert);
      ds.classList.add('ds-' + dsHoriz);
      if (sameSideVOffset && secVert === 'top') ds.style.marginTop = sameSideVOffset + 'px';
      else if (sameSideVOffset && secVert === 'bottom') ds.style.marginBottom = sameSideVOffset + 'px';
      else { ds.style.marginTop = ''; ds.style.marginBottom = ''; }
    }

    // Position incidents module adjacent to datastream
    const inc = document.getElementById('incidentsPanel');
    if (inc) {
      inc.classList.remove('inc-top', 'inc-bottom', 'inc-left', 'inc-right', 'inc-center-left', 'inc-center-right');
      inc.classList.add('inc-' + secVert);
      inc.classList.add('inc-' + incHoriz);
      if (sameSideVOffset && secVert === 'top') inc.style.marginTop = sameSideVOffset + 'px';
      else if (sameSideVOffset && secVert === 'bottom') inc.style.marginBottom = sameSideVOffset + 'px';
      else { inc.style.marginTop = ''; inc.style.marginBottom = ''; }
    }

    // Position spotter on the opposite vertical edge from leaderboard
    // so it sits between the dashboard and the leaderboard:
    //   • Dashboard top → LB bottom → spotter top (above LB)
    //   • Dashboard bottom → LB top → spotter bottom (below LB)
    const sp = document.getElementById('spotterPanel');
    if (sp) {
      sp.classList.remove('sp-top', 'sp-bottom', 'sp-left', 'sp-right');
      // Same horizontal side as leaderboard
      sp.classList.add('sp-' + (dashIsCenter ? 'left' : secHoriz));
      // Opposite vertical edge from leaderboard
      const spVert = secVert === 'bottom' ? 'top' : 'bottom';
      sp.classList.add('sp-' + spVert);
      sp.style.marginTop = '';
      sp.style.marginBottom = '';
    }
  }

  function updateLayoutPosition(value) {
    _settings.layoutPosition = value;
    applyLayout();
    saveSettings();
  }

  function updateLayoutFlow(value) {
    _settings.layoutFlow = value;
    applyLayout();
    saveSettings();
  }

  function toggleVerticalSwap(el) {
    _settings.verticalSwap = !_settings.verticalSwap;
    el.classList.toggle('on', _settings.verticalSwap);
    applyLayout();
    saveSettings();
  }

  function toggleSecVOppose(el) {
    _settings.secVOppose = !_settings.secVOppose;
    el.classList.toggle('on', _settings.secVOppose);
    applyLayout();
    saveSettings();
  }

  function toggleSecHOppose(el) {
    _settings.secHOppose = !_settings.secHOppose;
    el.classList.toggle('on', _settings.secHOppose);
    applyLayout();
    saveSettings();
  }

  function updateSecLayout(value) {
    _settings.secLayout = value;
    applySecLayout();
    saveSettings();
  }

  function updateSecOffset(axis, val) {
    val = Math.max(-200, Math.min(200, +val));
    if (axis === 'x') {
      _settings.secOffsetX = val;
      document.getElementById('secOffsetXVal').textContent = val + 'px';
    } else {
      _settings.secOffsetY = val;
      document.getElementById('secOffsetYVal').textContent = val + 'px';
    }
    applySecOffset();
    saveSettings();
  }

  function applySecLayout() {
    const mode = _settings.secLayout || 'stack';
    document.body.classList.remove('sec-stack', 'sec-row', 'sec-compact', 'sec-minimal');
    document.body.classList.add('sec-' + mode);
  }

  function applySecOffset() {
    const ox = (_settings.secOffsetX || 0) + 'px';
    const oy = (_settings.secOffsetY || 0) + 'px';
    const panels = document.querySelectorAll('.leaderboard-panel, .datastream-panel, .incidents-panel, .spotter-panel');
    panels.forEach(p => {
      p.style.setProperty('--sec-offset-x', ox);
      p.style.setProperty('--sec-offset-y', oy);
    });
    if (_settings.secOffsetX || _settings.secOffsetY) {
      document.body.setAttribute('data-sec-offset', '1');
    } else {
      document.body.removeAttribute('data-sec-offset');
    }
  }

  function previewZoom(val) {
    // Live preview: apply zoom to all modules while dragging, but NOT the settings panel
    val = Math.max(100, Math.min(200, +val));
    document.getElementById('zoomVal').textContent = val + '%';
    applyZoom(val, true);  // skipSettings = true
  }
  function updateZoom(val) {
    val = Math.max(100, Math.min(200, +val));
    _settings.zoom = val;
    document.getElementById('zoomVal').textContent = val + '%';
    applyZoom(val, false);  // apply to everything including settings
    saveSettings();
  }
  function applyZoom(val, skipSettings) {
    const scale = (val || 100) / 100;
    document.documentElement.style.setProperty('--dash-zoom', scale);
    document.getElementById('dashboard').style.zoom = scale;
    const lb = document.getElementById('leaderboardPanel');
    if (lb) lb.style.zoom = scale;
    const ds = document.getElementById('datastreamPanel');
    if (ds) ds.style.zoom = scale;
    const inc = document.getElementById('incidentsPanel');
    if (inc) inc.style.zoom = scale;
    const rc = document.getElementById('rcBanner');
    if (rc) rc.style.zoom = scale;
    const sp = document.getElementById('spotterPanel');
    if (sp) sp.style.zoom = scale;
    // Scale the settings panel itself on release (not during drag)
    if (!skipSettings) {
      const settingsOverlay = document.getElementById('settingsOverlay');
      if (settingsOverlay) settingsOverlay.style.zoom = scale;
    }
  }

  function updateForceFlag(val) {
    _forceFlagState = val;
    _settings.forceFlag = val;
    saveSettings();
  }

  function toggleSettings() {
    const overlay = document.getElementById('settingsOverlay');
    const isOpen = overlay.classList.contains('open');
    if (isOpen) {
      // Closing — also exit settings mode via Electron
      overlay.classList.remove('open');
      document.body.classList.remove('settings-active');
      document.body.classList.remove('settings-drag');
      if (window.k10?.releaseInteractive) window.k10.releaseInteractive();
    } else {
      // Opening — also enter settings mode
      overlay.classList.add('open');
      document.body.classList.add('settings-active');
      if (window.k10?.requestInteractive) window.k10.requestInteractive();
    }
  }

  // ─── Persistence ───
  async function loadSettings() {
    let saved = null;
    // Try Electron IPC first
    if (window.k10 && window.k10.getSettings) {
      saved = await window.k10.getSettings();
    }
    // Fallback to localStorage
    if (!saved) {
      try { saved = JSON.parse(localStorage.getItem('k10-broadcast-settings')); } catch(e) {}
    }
    if (saved) _settings = Object.assign({}, _defaultSettings, saved);
    applySettings();
  }

  async function saveSettings() {
    // Try Electron IPC first
    if (window.k10 && window.k10.saveSettings) {
      await window.k10.saveSettings(_settings);
    }
    // Also save to localStorage
    try { localStorage.setItem('k10-broadcast-settings', JSON.stringify(_settings)); } catch(e) {}
  }

  // ─── Electron settings mode listener ───
  // Ctrl+Shift+S directly opens/closes the settings modal.
  // Closing the modal also exits settings mode.
  if (window.k10 && window.k10.onSettingsMode) {
    window.k10.onSettingsMode((active) => {
      const overlay = document.getElementById('settingsOverlay');
      if (active) {
        // Open the settings modal
        overlay.classList.add('open');
        document.body.classList.add('settings-active');
      } else {
        // Close the settings modal
        overlay.classList.remove('open');
        document.body.classList.remove('settings-active');
      }
    });
  }

  // Load settings on startup
  loadSettings();
  initDiscordState();

  // ═══════════════════════════════════════════════════════════════
