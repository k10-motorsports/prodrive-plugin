// ═══════════════════════════════════════════════════════════════
// K10 Media Broadcaster — Preload Script
// Exposes safe IPC bridge to the HTML dashboard
// ═══════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('k10', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  onSettingsMode: (callback) => {
    ipcRenderer.on('settings-mode', (event, active) => callback(active));
  },
  // Request/release interactive mode (makes window focusable + clickable)
  requestInteractive: () => ipcRenderer.invoke('request-interactive'),
  releaseInteractive: () => ipcRenderer.invoke('release-interactive'),
  // Green screen mode
  getGreenScreenMode: () => ipcRenderer.invoke('get-green-screen-mode'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  // Dashboard mode (legacy, returns 'build')
  getDashboardMode: () => ipcRenderer.invoke('get-dashboard-mode'),
  // Open URL in user's default browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Global hotkey listeners (forwarded from main process)
  onRestartDemo: (callback) => {
    ipcRenderer.on('restart-demo', () => callback());
  },
  onResetTrackmap: (callback) => {
    ipcRenderer.on('reset-trackmap', () => callback());
  },
  // iRating / Safety Rating
  getRatingData: () => ipcRenderer.invoke('get-rating-data'),
  saveRatingData: (data) => ipcRenderer.invoke('save-rating-data', data),
  onToggleRatingEditor: (callback) => {
    ipcRenderer.on('toggle-rating-editor', () => callback());
  },
  // Driver profile
  getProfileData: () => ipcRenderer.invoke('get-profile-data'),
  saveProfileData: (data) => ipcRenderer.invoke('save-profile-data', data),
  onToggleDriverProfile: (callback) => {
    ipcRenderer.on('toggle-driver-profile', () => callback());
  },
  onToggleDriveMode: (callback) => {
    ipcRenderer.on('toggle-drive-mode', () => callback());
  },
  // Discord OAuth2
  discordConnect: () => ipcRenderer.invoke('discord-connect'),
  discordDisconnect: () => ipcRenderer.invoke('discord-disconnect'),
  getDiscordUser: () => ipcRenderer.invoke('get-discord-user'),
  // Remote dashboard server (iPad/tablet access)
  getRemoteServerInfo: () => ipcRenderer.invoke('get-remote-server-info'),
  startRemoteServer: (opts) => ipcRenderer.invoke('start-remote-server', opts),
  stopRemoteServer: () => ipcRenderer.invoke('stop-remote-server'),
  // Ambient light screen capture
  ambientStart: () => ipcRenderer.invoke('ambient-start'),
  ambientStop:  () => ipcRenderer.invoke('ambient-stop'),
  ambientRequestPermission: () => ipcRenderer.invoke('ambient-request-permission'),
  ambientPreviewStart: () => ipcRenderer.invoke('ambient-preview-start'),
  ambientPreviewStop:  () => ipcRenderer.invoke('ambient-preview-stop'),
  ambientSetRect: (rect) => ipcRenderer.invoke('ambient-set-rect', rect),
  onAmbientColor: (callback) => {
    ipcRenderer.on('ambient-color', (_event, color) => callback(color));
  },
  onAmbientPreviewFrame: (callback) => {
    ipcRenderer.on('ambient-preview-frame', (_event, dataUrl) => callback(dataUrl));
  },
});
