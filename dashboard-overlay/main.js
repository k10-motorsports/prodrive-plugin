// ═══════════════════════════════════════════════════════════════
// K10 Media Broadcaster — Electron Overlay
// Transparent, always-on-top, click-through overlay window
// that renders the HTML dashboard over the sim
// ═══════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell, desktopCapturer, systemPreferences } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const http   = require('http');
const https  = require('https');
const crypto = require('crypto');
const remoteServer = require('./remote-server');

// ── Crash log ───────────────────────────────────────────────
// Write a log file next to the app so crash info is visible
const LOG_PATH = path.join(__dirname, 'k10-debug.log');
function logToFile(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch (e) { /* non-critical */ }
  console.log(msg);
}

// Catch crashes that would silently kill the process
process.on('uncaughtException', (err) => {
  logToFile(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
});

// ── App name ──────────────────────────────────────────────────
app.setName('K10 Media Broadcaster');

// ── GPU / sandbox flags ─────────────────────────────────────
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

if (process.env.K10_FORCE_SOFTWARE === '1') {
  app.disableHardwareAcceleration();
}

// ── Settings helpers ─────────────────────────────────────────
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'overlay-settings.json');
}

function loadSettingsSync() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveSettingsSync(settings) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

// ── iRating / Safety Rating persistence ──────────────────────
function getRatingPath() {
  return path.join(app.getPath('userData'), 'irating-history.json');
}

function loadRatingData() {
  try {
    return JSON.parse(fs.readFileSync(getRatingPath(), 'utf8'));
  } catch (e) {
    return { iRating: 0, safetyRating: 0, history: [] };
  }
}

function saveRatingData(data) {
  fs.writeFileSync(getRatingPath(), JSON.stringify(data, null, 2));
}

// ── Driver profile / car history persistence ─────────────────
function getProfilePath() {
  return path.join(app.getPath('userData'), 'driver-profile.json');
}

function loadProfileData() {
  try {
    return JSON.parse(fs.readFileSync(getProfilePath(), 'utf8'));
  } catch (e) {
    return { carSessions: {} };
  }
}

function saveProfileData(data) {
  fs.writeFileSync(getProfilePath(), JSON.stringify(data, null, 2));
}

// ── Window bounds persistence (green-screen mode only) ───────
function getBoundsPath() {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function loadBounds() {
  try {
    return JSON.parse(fs.readFileSync(getBoundsPath(), 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveBounds(bounds) {
  try {
    fs.writeFileSync(getBoundsPath(), JSON.stringify(bounds));
  } catch (e) { /* non-critical */ }
}

// (Local asset server removed — no longer needed. Dashboard is a single inlined HTML file.)

// ── State ────────────────────────────────────────────────────
let overlayWindow = null;
let settingsMode = false;
let greenScreenMode = false;
// Single dashboard: vanilla TypeScript build (Vite-bundled, single-file HTML)
const DASHBOARD_FILE = 'dashboard.html';

function getDashboardFile() {
  return DASHBOARD_FILE;
}

async function createOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.bounds;

  // Check if green screen mode is enabled in saved settings
  const settings = loadSettingsSync();
  greenScreenMode = settings.greenScreen === true;

  logToFile(`[K10] Dashboard: ${getDashboardFile()}`);

  const mode = greenScreenMode ? 'green-screen' : 'transparent';
  logToFile(`[K10] Window mode: ${mode}`);
  logToFile(`[K10] Primary display: ${screenW}x${screenH} at (${primaryDisplay.bounds.x}, ${primaryDisplay.bounds.y})`);

  /** Load the dashboard into the overlay window via file:// (all assets inlined). */
  function loadDashboard() {
    logToFile('[K10] Loading dashboard via file://');
    overlayWindow.loadFile(path.join(__dirname, getDashboardFile()));
  }

  if (greenScreenMode) {
    // ── Green-screen mode ──
    const saved = loadBounds();
    const defaultW = Math.round(screenW * 0.6);
    const defaultH = Math.round(screenH * 0.5);
    const defaultX = Math.round((screenW - defaultW) / 2);
    const defaultY = Math.round((screenH - defaultH) / 2);

    overlayWindow = new BrowserWindow({
      width:  saved?.width  || defaultW,
      height: saved?.height || defaultH,
      x:      saved?.x      ?? defaultX,
      y:      saved?.y      ?? defaultY,
      icon: path.join(__dirname, 'images', 'branding', 'icon.png'),
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      movable: true,
      hasShadow: false,
      focusable: true,
      transparent: false,
      backgroundColor: '#00FF00',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Persist bounds on move/resize
    overlayWindow.on('moved',   () => saveBounds(overlayWindow.getBounds()));
    overlayWindow.on('resized', () => saveBounds(overlayWindow.getBounds()));

    // Green screen windows are always interactive (no click-through)
    loadDashboard();
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');

    // Inject opaque-mode class after page loads
    overlayWindow.webContents.on('did-finish-load', () => {
      overlayWindow.webContents.executeJavaScript(`
        document.body.classList.add('opaque-mode');
      `);
    });

  } else {
    // ── Transparent overlay mode ──
    overlayWindow = new BrowserWindow({
      width:  screenW,
      height: screenH,
      x:      primaryDisplay.bounds.x,
      y:      primaryDisplay.bounds.y,
      icon: path.join(__dirname, 'images', 'branding', 'icon.png'),
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
      minimizable: false,
      maximizable: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    loadDashboard();
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');

    // Auto-start ambient capture once the page has loaded.
    // The renderer SHOULD request this via IPC, but as a fallback
    // we start it here after a short delay to ensure the page is ready.
    overlayWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        if (!_ambientTimer) {
          logToFile('[K10] Auto-starting ambient capture (fallback — renderer did not request it)');
          startAmbientCapture();
        }
      }, 3000);
    });
  }

  overlayWindow.on('closed', () => { overlayWindow = null; });

  // ── Windows: periodically re-assert always-on-top ──────────
  // DirectX fullscreen exclusive mode can steal z-order even from
  // screen-saver level windows. Re-assert every 5 seconds.
  if (process.platform === 'win32') {
    setInterval(() => {
      if (overlayWindow && !overlayWindow.isDestroyed() && !settingsMode) {
        overlayWindow.setAlwaysOnTop(false);
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    }, 5000);
  }

  // ── Crash recovery ──────────────────────────────────────────
  overlayWindow.webContents.on('render-process-gone', (_event, details) => {
    logToFile(`[K10] Renderer crashed: ${details.reason}`);
    if (details.reason === 'crashed' || details.reason === 'killed') {
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          loadDashboard();
        }
      }, 2000);
    }
  });

  overlayWindow.webContents.on('unresponsive', () => {
    logToFile('[K10] Renderer unresponsive — reloading');
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      loadDashboard();
    }
  });

  // ── GPU process crash handler ───────────────────────────────
  app.on('child-process-gone', (_event, details) => {
    logToFile(`[K10] Child process gone: type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`);
    if (details.type === 'GPU' && overlayWindow && !overlayWindow.isDestroyed()) {
      logToFile('[K10] GPU process crashed — reloading dashboard');
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          loadDashboard();
        }
      }, 2000);
    }
  });
}

// ── Remote Dashboard Server ──────────────────────────────────
// Auto-start the LAN server if enabled in settings
async function maybeStartRemoteServer() {
  const settings = loadSettingsSync();
  if (settings.remoteServer !== true) return;
  try {
    const simhubUrl = settings.simhubUrl
      ? settings.simhubUrl.replace(/\/k10mediabroadcaster\/?$/, '')
      : 'http://localhost:8889';
    const info = await remoteServer.start({
      port: settings.remoteServerPort || remoteServer.DEFAULT_PORT,
      appDir: __dirname,
      simhubUrl: simhubUrl,
      log: logToFile,
    });
    logToFile(`[K10] Remote dashboard: ${info.url} (iPad/tablet access)`);
  } catch (err) {
    logToFile(`[K10] Remote server failed to start: ${err.message}`);
  }
}

// ── Settings mode ────────────────────────────────────────────
function enterSettingsMode() {
  if (!overlayWindow) return;
  settingsMode = true;
  if (!greenScreenMode) {
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.setFocusable(true);
  }
  overlayWindow.focus();
  overlayWindow.webContents.send('settings-mode', true);
  console.log('[K10] Settings mode ON');
}

function exitSettingsMode() {
  if (!overlayWindow) return;
  settingsMode = false;
  if (!greenScreenMode) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.setFocusable(false);
  }
  if (greenScreenMode) {
    saveBounds(overlayWindow.getBounds());
  }
  overlayWindow.webContents.send('settings-mode', false);
  console.log('[K10] Settings mode OFF');
}

logToFile('[K10] App starting...');

app.whenReady().then(() => {
  logToFile(`[K10] Platform: ${os.platform()} ${os.arch()} | Electron ${process.versions.electron}`);
  logToFile('[K10] Hotkeys: Ctrl+Shift+S/H/G/R/D/M/Q');
  try {
    createOverlay();
    logToFile('[K10] Overlay window created OK');
    maybeStartRemoteServer();
  } catch (err) {
    logToFile(`[K10] FATAL: createOverlay() threw: ${err.stack || err.message}`);
    app.quit();
    return;
  }

  // ── GLOBAL HOTKEYS ──

  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) overlayWindow.hide();
      else overlayWindow.show();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (!overlayWindow) return;
    if (settingsMode) exitSettingsMode();
    else enterSettingsMode();
  });

  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (!overlayWindow) return;
    const { width: sw, height: sh } = screen.getPrimaryDisplay().bounds;
    if (greenScreenMode) {
      // Reset to centered 60% × 50% window
      const w = Math.round(sw * 0.6);
      const h = Math.round(sh * 0.5);
      overlayWindow.setBounds({ x: Math.round((sw - w) / 2), y: Math.round((sh - h) / 2), width: w, height: h });
      saveBounds(overlayWindow.getBounds());
    } else {
      overlayWindow.setBounds({ x: 0, y: 0, width: sw, height: sh });
    }
    console.log('[K10] Window position/size reset');
  });

  globalShortcut.register('CommandOrControl+Shift+G', () => {
    // Toggle green-screen mode and restart
    const settings = loadSettingsSync();
    settings.greenScreen = !settings.greenScreen;
    saveSettingsSync(settings);
    const mode = settings.greenScreen ? 'green-screen' : 'transparent';
    console.log(`[K10] Toggling to ${mode} mode — restarting...`);
    app.relaunch();
    app.exit(0);
  });

  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });

  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (overlayWindow) overlayWindow.webContents.send('restart-demo');
  });

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (overlayWindow) overlayWindow.webContents.send('reset-trackmap');
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (overlayWindow) overlayWindow.webContents.send('toggle-rating-editor');
  });

  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (overlayWindow) overlayWindow.webContents.send('toggle-driver-profile');
  });

  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (overlayWindow) overlayWindow.webContents.send('toggle-drive-mode');
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});

// ── IPC: Interactive mode (for connection banner / settings) ──
ipcMain.handle('request-interactive', async () => {
  if (!overlayWindow || greenScreenMode) return;
  settingsMode = true;
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.setFocusable(true);
  overlayWindow.focus();
  console.log('[K10] Interactive mode ON — window accepts input');
});

ipcMain.handle('release-interactive', async () => {
  if (!overlayWindow || greenScreenMode) return;
  settingsMode = false;
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setFocusable(false);
  console.log('[K10] Interactive mode OFF — click-through restored');
});

// ── IPC: Driver profile / car history persistence ──
ipcMain.handle('get-profile-data', async () => {
  return loadProfileData();
});

ipcMain.handle('save-profile-data', async (event, data) => {
  saveProfileData(data);
});

// ── IPC: iRating / Safety Rating persistence ──
ipcMain.handle('get-rating-data', async () => {
  return loadRatingData();
});

ipcMain.handle('save-rating-data', async (event, data) => {
  saveRatingData(data);
});

// ── IPC: Settings persistence ──
ipcMain.handle('get-settings', async () => {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
  } catch (e) {
    return null;
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  saveSettingsSync(settings);
  return true;
});

// ── IPC: Green screen mode query ──
ipcMain.handle('get-green-screen-mode', async () => {
  return greenScreenMode;
});

// ── IPC: Dashboard mode query (legacy, returns 'build') ──
ipcMain.handle('get-dashboard-mode', async () => {
  return 'build';
});

// ── IPC: Restart app (used after toggling green screen mode) ──
ipcMain.handle('restart-app', async () => {
  app.relaunch();
  app.exit(0);
});

// ── IPC: Open external URL in user's default browser ──
ipcMain.handle('open-external', async (event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

// ═══════════════════════════════════════════════════════════════
// DISCORD OAUTH2 INTEGRATION
// Opens the user's browser for Discord authorization, listens
// on a local callback server, exchanges the code for a token,
// then fetches and persists the Discord user profile.
// ═══════════════════════════════════════════════════════════════

const DISCORD_CLIENT_ID     = '1483105220023160882';
const DISCORD_REDIRECT_PORT = 18492;
const DISCORD_REDIRECT_URI  = `http://localhost:${DISCORD_REDIRECT_PORT}/callback`;
const DISCORD_SCOPES        = 'identify guilds.join';
const DISCORD_GUILD_ID      = '1310050023326121994';  // K10 Media Broadcaster server
const DISCORD_GUILD_INVITE  = 'https://discord.gg/k10mediabroadcaster';

let _discordCallbackServer = null;
let _discordCodeVerifier   = null;  // PKCE code_verifier for current auth flow

// PKCE helpers — generate verifier + S256 challenge (no client secret needed)
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function getDiscordPath() {
  return path.join(app.getPath('userData'), 'discord-user.json');
}

function loadDiscordUser() {
  try {
    return JSON.parse(fs.readFileSync(getDiscordPath(), 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveDiscordUser(user) {
  fs.writeFileSync(getDiscordPath(), JSON.stringify(user, null, 2));
}

function clearDiscordUser() {
  try { fs.unlinkSync(getDiscordPath()); } catch (e) { /* ok */ }
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = typeof body === 'string' ? body : new URLSearchParams(body).toString();
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData);
    req.end();
  });
}

async function exchangeCodeForToken(code) {
  if (!_discordCodeVerifier) throw new Error('Missing PKCE code verifier');

  const tokenData = await httpsPost('https://discord.com/api/oauth2/token', {
    client_id: DISCORD_CLIENT_ID,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: DISCORD_REDIRECT_URI,
    code_verifier: _discordCodeVerifier,
  });

  _discordCodeVerifier = null;  // single-use
  if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
  return tokenData;
}

async function fetchDiscordProfile(accessToken) {
  const user = await httpsGet('https://discord.com/api/users/@me', {
    Authorization: `Bearer ${accessToken}`,
  });
  if (user.id) return user;
  throw new Error('Failed to fetch Discord profile');
}

function startCallbackServer() {
  return new Promise((resolve, reject) => {
    if (_discordCallbackServer) {
      try { _discordCallbackServer.close(); } catch (e) { /* ok */ }
    }

    _discordCallbackServer = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${DISCORD_REDIRECT_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="background:#1a1a2e;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#f44336">Connection Cancelled</h2><p>You can close this tab and return to the overlay.</p></div></body></html>');
          resolve({ error });
          setTimeout(() => { try { _discordCallbackServer.close(); } catch (e) {} _discordCallbackServer = null; }, 1000);
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="background:#1a1a2e;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:#4caf50">Connected!</h2><p>You can close this tab and return to the K10 Media Broadcaster overlay.</p></div></body></html>');
          resolve({ code });
          setTimeout(() => { try { _discordCallbackServer.close(); } catch (e) {} _discordCallbackServer = null; }, 1000);
          return;
        }

        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing code parameter');
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    _discordCallbackServer.listen(DISCORD_REDIRECT_PORT, '127.0.0.1', () => {
      console.log(`[K10] Discord callback server listening on port ${DISCORD_REDIRECT_PORT}`);
    });

    _discordCallbackServer.on('error', (err) => {
      console.error('[K10] Discord callback server error:', err);
      reject(err);
    });

    // Timeout: close server after 5 minutes if no callback received
    setTimeout(() => {
      if (_discordCallbackServer) {
        try { _discordCallbackServer.close(); } catch (e) {}
        _discordCallbackServer = null;
        resolve({ error: 'timeout' });
      }
    }, 300000);
  });
}

// ── IPC: Discord OAuth2 ──
ipcMain.handle('discord-connect', async () => {
  try {
    // Generate PKCE verifier + challenge (no client secret needed)
    _discordCodeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(_discordCodeVerifier);

    // Start listening for the callback BEFORE opening the browser
    const callbackPromise = startCallbackServer();

    // Open Discord OAuth2 authorization URL in user's default browser (with PKCE)
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(DISCORD_SCOPES)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    // Temporarily lower z-level so the browser window is visible above the overlay
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(false);
    }

    await shell.openExternal(authUrl);
    console.log('[K10] Discord OAuth2: opened browser for authorization (PKCE)');

    // Wait for the callback
    const result = await callbackPromise;

    // Restore z-level
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    if (result.error) {
      return { success: false, error: result.error };
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(result.code);

    // Fetch user profile
    const profile = await fetchDiscordProfile(tokenData.access_token);

    // Build user data to persist
    const userData = {
      id: profile.id,
      username: profile.username,
      globalName: profile.global_name || profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      connectedAt: new Date().toISOString(),
    };

    saveDiscordUser(userData);
    console.log(`[K10] Discord connected: ${userData.globalName} (${userData.id})`);

    return {
      success: true,
      user: {
        id: userData.id,
        username: userData.username,
        globalName: userData.globalName,
        avatar: userData.avatar,
      },
    };
  } catch (err) {
    console.error('[K10] Discord connect error:', err);
    // Restore z-level if it was lowered
    if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.isAlwaysOnTop()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('discord-disconnect', async () => {
  clearDiscordUser();
  console.log('[K10] Discord disconnected');
  return { success: true };
});

ipcMain.handle('get-discord-user', async () => {
  const user = loadDiscordUser();
  if (!user) return null;
  // Return only safe fields (no tokens)
  return {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    avatar: user.avatar,
    connectedAt: user.connectedAt,
  };
});

// ── IPC: Remote Dashboard Server ──
ipcMain.handle('get-remote-server-info', async () => {
  return remoteServer.getInfo();
});

ipcMain.handle('start-remote-server', async (event, opts = {}) => {
  try {
    const settings = loadSettingsSync();
    const simhubUrl = (settings.simhubUrl || 'http://localhost:8889/k10mediabroadcaster/')
      .replace(/\/k10mediabroadcaster\/?$/, '');
    const info = await remoteServer.start({
      port: opts.port || settings.remoteServerPort || remoteServer.DEFAULT_PORT,
      appDir: __dirname,
      simhubUrl: simhubUrl,
      log: logToFile,
    });
    // Persist the enabled state
    settings.remoteServer = true;
    if (opts.port) settings.remoteServerPort = opts.port;
    saveSettingsSync(settings);
    return { success: true, ...info };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-remote-server', async () => {
  await remoteServer.stop();
  const settings = loadSettingsSync();
  settings.remoteServer = false;
  saveSettingsSync(settings);
  return { success: true };
});

// ═══════════════════════════════════════════════════════════════
// AMBIENT LIGHT — Screen Color Capture
//
// Two modes:
//   COLOR ONLY (default)  — 24×24 thumbnail at ~8fps, averages
//       the user's capture rect (or center 60%) for ambient RGB.
//   PREVIEW (settings open) — 320×180 thumbnail at ~15fps, sends
//       a JPEG data-URL to the renderer for the settings preview
//       canvas, PLUS the averaged color from the capture rect.
//
// The capture rect is stored in _ambientCaptureRect as viewport
// ratios { x, y, w, h } (0-1).  Updated via IPC from renderer.
// ═══════════════════════════════════════════════════════════════

let _ambientTimer = null;
let _ambientEnabled = false;
let _ambientPreviewMode = false;   // true when settings panel is open
let _ambientCaptureRect = null;    // { x, y, w, h } ratios or null

// Restore saved capture rect from settings so it persists across restarts
try {
  const saved = loadSettingsSync();
  if (saved && saved.ambientCaptureRect) {
    _ambientCaptureRect = saved.ambientCaptureRect;
    logToFile(`[K10] Restored ambient capture rect from settings: ${JSON.stringify(_ambientCaptureRect)}`);
  }
} catch (e) { /* non-critical */ }

// Compute average color from a bitmap region.
// Returns null if no capture rect is set — we only sample a user-defined region.
function averageColorFromBitmap(bitmap, size, rect) {
  if (!rect) return null;  // No region selected — don't sample anything

  const w = size.width, h = size.height;
  const x0 = Math.max(0, Math.floor(rect.x * w));
  const y0 = Math.max(0, Math.floor(rect.y * h));
  const x1 = Math.min(w, Math.ceil((rect.x + rect.w) * w));
  const y1 = Math.min(h, Math.ceil((rect.y + rect.h) * h));

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  // Electron toBitmap() returns BGRA on ALL platforms
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const offset = (y * w + x) * 4;
      bSum += bitmap[offset];
      gSum += bitmap[offset + 1];
      rSum += bitmap[offset + 2];
      count++;
    }
  }

  if (count === 0) return null;
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count)
  };
}

let _ambientFrameCount = 0;

async function captureAmbientFrame() {
  try {
    // Use larger thumbnail when preview is active for a usable image
    const thumbSize = _ambientPreviewMode
      ? { width: 320, height: 180 }
      : { width: 48, height: 48 };

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbSize
    });

    if (!sources || sources.length === 0) {
      if (_ambientFrameCount % 50 === 0) logToFile('[K10] Ambient: no screen sources returned!');
      _ambientFrameCount++;
      return null;
    }

    const primary = sources[0];
    const thumbnail = primary.thumbnail;
    const size = thumbnail.getSize();

    if (size.width === 0 || size.height === 0) {
      if (_ambientFrameCount % 50 === 0) logToFile('[K10] Ambient: thumbnail size is 0x0');
      _ambientFrameCount++;
      return null;
    }

    // Average color from bitmap (uses capture rect if set)
    const bitmap = thumbnail.toBitmap();
    const color = averageColorFromBitmap(bitmap, size, _ambientCaptureRect);

    // Log first few frames + every 50th so we can see the data
    if (_ambientFrameCount < 5 || _ambientFrameCount % 50 === 0) {
      logToFile(`[K10] Ambient frame #${_ambientFrameCount}: size=${size.width}x${size.height} color=${JSON.stringify(color)} rect=${JSON.stringify(_ambientCaptureRect)} bitmapLen=${bitmap.length}`);
    }
    _ambientFrameCount++;

    // Preview JPEG (only when settings are open)
    let previewDataUrl = null;
    if (_ambientPreviewMode) {
      previewDataUrl = thumbnail.toDataURL();
    }

    return { color, previewDataUrl };
  } catch (e) {
    logToFile(`[K10] Ambient capture error: ${e.message}`);
  }
  return null;
}

function startAmbientCapture() {
  if (_ambientTimer) return;
  _ambientEnabled = true;
  logToFile(`[K10] Ambient light capture started (preview=${_ambientPreviewMode})`);

  const tick = async () => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !_ambientEnabled) return;
    const result = await captureAmbientFrame();
    if (result) {
      if (result.color) {
        overlayWindow.webContents.send('ambient-color', result.color);
      }
      if (result.previewDataUrl) {
        overlayWindow.webContents.send('ambient-preview-frame', result.previewDataUrl);
      }
    }
  };

  // ~30fps for responsive color changes (was 8fps/15fps)
  const interval = 33;
  _ambientTimer = setInterval(tick, interval);
  // Fire immediately so the first frame appears without delay
  tick();
}

function stopAmbientCapture() {
  _ambientEnabled = false;
  if (_ambientTimer) {
    clearInterval(_ambientTimer);
    _ambientTimer = null;
    logToFile('[K10] Ambient light capture stopped');
  }
}

// Restart capture with updated interval when preview mode changes
function restartAmbientCapture() {
  if (!_ambientEnabled) return;
  stopAmbientCapture();
  _ambientEnabled = true;
  startAmbientCapture();
}

// IPC: renderer can toggle ambient capture on/off
ipcMain.handle('ambient-start', async () => {
  logToFile('[K10] IPC ambient-start received — starting capture');
  startAmbientCapture();
});
ipcMain.handle('ambient-stop',  async () => {
  logToFile('[K10] IPC ambient-stop received');
  stopAmbientCapture();
});

// IPC: renderer tells us when settings panel opens/closes
ipcMain.handle('ambient-preview-start', async () => {
  _ambientPreviewMode = true;
  restartAmbientCapture();
});
ipcMain.handle('ambient-preview-stop', async () => {
  _ambientPreviewMode = false;
  restartAmbientCapture();
});

// IPC: renderer sends updated capture rect
ipcMain.handle('ambient-set-rect', async (_event, rect) => {
  _ambientCaptureRect = rect;
  logToFile(`[K10] Ambient capture rect updated: ${JSON.stringify(rect)}`);

  // Persist to settings so it survives app restarts
  try {
    const settings = loadSettingsSync();
    settings.ambientCaptureRect = rect;
    saveSettingsSync(settings);
    logToFile('[K10] Ambient capture rect saved to settings');
  } catch (e) {
    logToFile(`[K10] Failed to save capture rect: ${e.message}`);
  }

  // If capture isn't running yet, start it now — user clearly wants it
  if (!_ambientTimer) {
    logToFile('[K10] Capture not running — auto-starting from set-rect');
    startAmbientCapture();
  }
});

// IPC: check and request screen recording permission
// macOS requires explicit user permission for screen capture.
// Windows doesn't need special permissions.
ipcMain.handle('ambient-request-permission', async () => {
  if (process.platform === 'darwin') {
    // Check current screen capture permission status
    const status = systemPreferences.getMediaAccessStatus('screen');
    logToFile(`[K10] Screen recording permission status: ${status}`);

    if (status === 'granted') {
      return { granted: true, platform: 'darwin' };
    }

    // On macOS, we can't programmatically request screen recording permission.
    // The best we can do is:
    // 1) Attempt a capture (which triggers the OS permission prompt on first use)
    // 2) If denied, open System Preferences to the right pane
    try {
      // Trigger the OS permission dialog by attempting a capture
      await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
      // Re-check after the attempt
      const newStatus = systemPreferences.getMediaAccessStatus('screen');
      if (newStatus === 'granted') {
        return { granted: true, platform: 'darwin' };
      }
    } catch (e) {
      logToFile(`[K10] Screen capture permission attempt failed: ${e && e.stack || e}`);
    }

    // Still not granted — open System Preferences to the Screen Recording pane
    logToFile('[K10] Opening System Preferences > Privacy > Screen Recording');
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    return { granted: false, platform: 'darwin', openedSettings: true };

  } else if (process.platform === 'win32') {
    // Windows doesn't require special permissions for desktopCapturer
    return { granted: true, platform: 'win32' };

  } else {
    // Linux — typically no permission needed
    return { granted: true, platform: 'linux' };
  }
});
