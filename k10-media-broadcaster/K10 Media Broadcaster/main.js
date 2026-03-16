// ═══════════════════════════════════════════════════════════════
// K10 Media Broadcaster — Electron Overlay
// Transparent, always-on-top, click-through overlay window
// that renders the HTML dashboard over the sim
// ═══════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const http   = require('http');
const https  = require('https');
const crypto = require('crypto');

// ── App name ──────────────────────────────────────────────────
app.setName('K10 Media Broadcaster');

// ── GPU / sandbox flags ─────────────────────────────────────
app.commandLine.appendSwitch('disable-gpu-sandbox');

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

// ── State ────────────────────────────────────────────────────
let overlayWindow = null;
let settingsMode = false;
let greenScreenMode = false;

function createOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.bounds;

  // Check if green screen mode is enabled in saved settings
  const settings = loadSettingsSync();
  greenScreenMode = settings.greenScreen === true;

  const mode = greenScreenMode ? 'green-screen' : 'transparent';
  console.log(`[K10] Window mode: ${mode}`);

  if (greenScreenMode) {
    // ── Green-screen mode ──
    // Non-transparent, resizable window with chroma-key green background.
    // Window bounds are persisted so the user can size it for their OBS source.
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
    overlayWindow.loadFile(path.join(__dirname, 'dashboard.html'));
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');

    // Inject opaque-mode class after page loads
    overlayWindow.webContents.on('did-finish-load', () => {
      overlayWindow.webContents.executeJavaScript(`
        document.body.classList.add('opaque-mode');
      `);
    });

  } else {
    // ── Transparent overlay mode ──
    // Fullscreen, click-through, fully transparent.
    overlayWindow = new BrowserWindow({
      width:  screenW,
      height: screenH,
      x:      0,
      y:      0,
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
    overlayWindow.loadFile(path.join(__dirname, 'dashboard.html'));
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  overlayWindow.on('closed', () => { overlayWindow = null; });

  // ── Crash recovery ──────────────────────────────────────────
  overlayWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[K10] Renderer crashed:', details.reason);
    if (details.reason === 'crashed' || details.reason === 'killed') {
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.loadFile(path.join(__dirname, 'dashboard.html'));
        }
      }, 2000);
    }
  });

  overlayWindow.webContents.on('unresponsive', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.loadFile(path.join(__dirname, 'dashboard.html'));
    }
  });
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

app.whenReady().then(() => {
  console.log(`[K10] Platform: ${os.platform()} ${os.arch()} | Electron ${process.versions.electron}`);
  console.log('[K10] Hotkeys:');
  console.log('[K10]   Ctrl+Shift+S = settings mode (interact with overlay)');
  console.log('[K10]   Ctrl+Shift+G = toggle green-screen mode (restarts app)');
  console.log('[K10]   Ctrl+Shift+H = hide/show overlay');
  console.log('[K10]   Ctrl+Shift+R = reset window position/size');
  console.log('[K10]   Ctrl+Shift+Q = quit');
  createOverlay();

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
