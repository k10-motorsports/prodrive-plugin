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

    // Remote dashboard — visible when Discord connected
    updateRemoteDashVisibility();

    // iRacing tab — enabled when Discord connected
    if (typeof updateIRacingTabState === 'function') updateIRacingTabState();
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

  // ── Remote Dashboard (LAN streaming via remote-server.js) ──

  async function toggleRemoteDash(el) {
    if (!window.k10) return;
    const isOn = el.classList.contains('on');
    const newVal = !isOn;
    el.classList.toggle('on', newVal);

    if (newVal) {
      const result = await window.k10.startRemoteServer();
      if (result && result.success) {
        _showRemoteDashDocs(result);
      } else {
        el.classList.remove('on');
        console.error('[K10] Remote server start failed:', result?.error);
      }
    } else {
      await window.k10.stopRemoteServer();
      document.getElementById('remoteDashDocs').style.display = 'none';
    }
  }

  function _showRemoteDashDocs(info) {
    const docs = document.getElementById('remoteDashDocs');
    const urlEl = document.getElementById('remoteServerUrl');
    if (!docs) return;
    docs.style.display = '';
    if (urlEl && info.url) urlEl.textContent = info.url;
    if (info.url) _renderQR('remoteServerQR', info.url);
  }

  function updateRemoteDashVisibility() {
    const section = document.getElementById('remoteDashSection');
    if (!section) return;
    if (window._k10RemoteMode) { section.style.display = 'none'; return; }
    section.style.display = _discordUser ? '' : 'none';
  }

  async function initRemoteDashState() {
    if (window._k10RemoteMode) return;
    updateRemoteDashVisibility();
    if (!window.k10 || !window.k10.getRemoteServerInfo) return;
    try {
      const info = await window.k10.getRemoteServerInfo();
      if (info && info.running) {
        const toggle = document.getElementById('remoteDashToggle');
        if (toggle) toggle.classList.add('on');
        _showRemoteDashDocs(info);
      }
    } catch (e) { /* ok */ }
    updateRemoteDashVisibility();
  }

  // QR code rendering — uses the local qr-code.js module (no external API)
  function _renderQR(canvasId, text) {
    if (window.renderQRCode) window.renderQRCode(canvasId, text);
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

    // Re-run layout so dynamically positioned panels (pitbox) reflow
    applyLayout();

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

  function updateAmbientMode(mode) {
    _settings.ambientMode = mode;
    // Migrate legacy boolean → new mode
    delete _settings.showAmbientLight;
    applyAmbientMode(mode);
    saveSettings();
  }

  function applyAmbientMode(mode) {
    const body = document.body;
    body.classList.remove('ambient-off', 'ambient-matte');
    if (mode === 'off') {
      body.classList.add('ambient-off');
      if (typeof window.stopAmbientLight === 'function') window.stopAmbientLight();
    } else {
      if (mode === 'matte') body.classList.add('ambient-matte');
      if (typeof window.startAmbientLight === 'function') window.startAmbientLight();
    }
    // Expose mode for WebGL shader: 0=off, 1=matte, 2=reflective
    window._ambientModeInt = mode === 'off' ? 0 : mode === 'matte' ? 1 : 2;
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

  // ─── Game Logo toggle ───
  function toggleGameLogo(el) {
    const isOn = el.classList.contains('on');
    _settings.showGameLogo = !isOn;
    el.classList.toggle('on', !isOn);
    saveSettings();
    // Immediately update the logo visibility
    if (window.updateGameLogo) window.updateGameLogo(window._currentGameId || 'iracing', !isOn);
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

  /* ── Layout Position Map ──
     5 positions: 4 user-selectable corners + 1 programmatic (absolute-center).
     All behavior is deterministic from the position:
       Right → RTL flow        Left → LTR flow
       Bottom → column-reverse + vswap (automatic)
       Absolute-center → pre-race/podium, ~500px from top */
  const _layoutPositionMap = {
    'top-right': 'layout-tr', 'top-left': 'layout-tl',
    'bottom-right': 'layout-br', 'bottom-left': 'layout-bl',
    'absolute-center': 'layout-ac'
  };
  const _allLayoutClasses = Object.values(_layoutPositionMap);

  function applyLayout() {
    const dash = document.getElementById('dashboard');
    const pos = _settings.layoutPosition || 'top-right';

    // ── 1. Dashboard position ──
    _allLayoutClasses.forEach(c => dash.classList.remove(c));
    dash.classList.add(_layoutPositionMap[pos] || 'layout-tr');

    // Derived properties — deterministic from corner choice
    const isBottom = pos.includes('bottom');
    const isRight  = pos.includes('right');
    const isLeft   = pos.includes('left');
    const isCenter = (pos === 'absolute-center');

    // ── 2. Commentary: diagonally opposite corner ──
    const cmtCol = document.getElementById('commentaryCol');
    if (cmtCol) {
      cmtCol.classList.remove('cmt-tl', 'cmt-tr', 'cmt-bl', 'cmt-br');
      if (!isCenter) {
        const cmtV = isBottom ? 't' : 'b';
        const cmtH = isRight  ? 'l' : 'r';
        cmtCol.classList.add('cmt-' + cmtV + cmtH);
      } else {
        // Absolute-center: commentary goes bottom-left
        cmtCol.classList.add('cmt-bl');
      }
    }

    // ── 3. Sync settings dropdown ──
    const posSelect = document.getElementById('settingsPosition');
    if (posSelect && posSelect.value !== pos) posSelect.value = pos;

    // ── 4. Secondary panels (leaderboard, datastream, pitbox) ──
    // Opposite vertical edge, same horizontal edge as main HUD.
    // Two rows: main HUD + incidents on one edge, sec panels + commentary on the other.
    const secVert  = isCenter ? 'bottom' : (isBottom ? 'top'    : 'bottom');
    const secHoriz = isCenter ? 'right'  : (isRight  ? 'right'  : 'left');

    const sec = document.getElementById('secContainer');
    if (sec) {
      sec.classList.remove('sec-top', 'sec-bottom', 'sec-left', 'sec-right');
      sec.classList.add('sec-' + secVert);
      sec.classList.add('sec-' + secHoriz);
      sec.style.marginTop = '';
      sec.style.marginBottom = '';
    }

    // Individual panel class bookkeeping (for CSS styling hooks)
    const lb = document.getElementById('leaderboardPanel');
    if (lb) {
      lb.classList.remove('lb-top', 'lb-bottom', 'lb-left', 'lb-right');
      lb.classList.add('lb-' + secVert, 'lb-' + secHoriz);
    }
    const ds = document.getElementById('datastreamPanel');
    if (ds) {
      ds.classList.remove('ds-top', 'ds-bottom', 'ds-left', 'ds-right');
      ds.classList.add('ds-' + secVert, 'ds-' + secHoriz);
    }
    const pb = document.getElementById('pitBoxPanel');
    if (pb) {
      pb.classList.remove('pb-top', 'pb-bottom', 'pb-left', 'pb-right');
      pb.classList.add('pb-' + secVert, 'pb-' + secHoriz);
    }

    // ── 5. Incidents: same vertical edge as sec-container, always opposite
    //       horizontal edge from it (diagonal from main HUD) ──
    const incVert  = secVert;
    const incHoriz = secHoriz === 'right' ? 'left' : 'right';

    const inc = document.getElementById('incidentsPanel');
    if (inc) {
      inc.classList.remove('inc-top', 'inc-bottom', 'inc-left', 'inc-right');
      inc.classList.add('inc-' + incVert);
      inc.classList.add('inc-' + incHoriz);
      // Explicit inline resets — CEF/Electron can hold stale values after
      // class removal; force every position property so nothing lingers.
      inc.style.top    = incVert  === 'top'   ? '' : 'auto';
      inc.style.bottom = incVert  === 'bottom'? '' : 'auto';
      inc.style.left   = incHoriz === 'left'  ? '' : 'auto';
      inc.style.right  = incHoriz === 'right' ? '' : 'auto';
      inc.style.marginTop = '';
      inc.style.marginBottom = '';
      console.log('[layout] incidents → ' + incVert + '-' + incHoriz +
        ' (sec=' + secVert + '-' + secHoriz + ', pos=' + pos + ')');
    }

    // ── 6. Spotter: co-located with race control at top center ──
    // Positioning is handled entirely by CSS (top: 8px, left: 50%, transform).
    // No layout-dependent positioning needed.
  }

  function updateLayoutPosition(value) {
    _settings.layoutPosition = value;
    applyLayout();
    saveSettings();
  }

  // Layout helper functions removed — all behavior is now deterministic
  // from the 4-corner position choice. No flow/vswap/oppose/offset toggles needed.

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

    // Scale --edge so zoomed fixed elements keep consistent visual margins.
    // At zoom 1.65, a 10px edge in CSS gives only ~6px visual gap.
    // Compensate: --edge-z = base-edge / zoom (so CSS 6px * 1.65 zoom = 10px visual).
    const baseEdge = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--edge')) || 10;
    document.documentElement.style.setProperty('--edge-z', (baseEdge / scale) + 'px');

    // Zoomed fixed elements: dashboard, incidents, spotter, commentary, race control
    document.getElementById('dashboard').style.zoom = scale;
    const inc = document.getElementById('incidentsPanel');
    if (inc) inc.style.zoom = scale;
    const sp = document.getElementById('spotterPanel');
    if (sp) sp.style.zoom = scale;
    const cmtCol = document.getElementById('commentaryCol');
    if (cmtCol) cmtCol.style.zoom = scale;
    const rc = document.getElementById('rcBanner');
    if (rc) rc.style.zoom = scale;

    // Secondary container: zoom the container, not individual panels.
    // Container is position:fixed — its --edge offset needs compensating too.
    const sec = document.getElementById('secContainer');
    if (sec) sec.style.zoom = scale;

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
      // Stop ambient preview when settings close
      if (typeof window.stopAmbientPreview === 'function') window.stopAmbientPreview();
    } else {
      // Opening — also enter settings mode
      overlay.classList.add('open');
      document.body.classList.add('settings-active');
      if (window.k10?.requestInteractive) window.k10.requestInteractive();
      // Start ambient preview when settings open
      if (typeof window.startAmbientPreview === 'function') window.startAmbientPreview();
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
  initRemoteDashState();

  // ═══════════════════════════════════════════════════════════════
