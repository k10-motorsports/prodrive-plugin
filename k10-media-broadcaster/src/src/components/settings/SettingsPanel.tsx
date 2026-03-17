import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@hooks/useSettings';
import type { LayoutPosition, SecondaryLayout, DiscordUser } from '../../types/settings';
import styles from './SettingsPanel.module.css';

type TabType = 'sections' | 'layout' | 'connections' | 'keys' | 'system';

const DISCORD_GUILD_INVITE = 'https://discord.gg/k10mediabroadcaster';

const DISCORD_ICON_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>';

/**
 * SettingsPanel: Overlay settings UI
 * Opens/closes with Ctrl+Shift+S keyboard shortcut
 */
export function SettingsPanel() {
  const { settings, updateSetting } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('sections');
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [discordError, setDiscordError] = useState('');

  // Load Discord user state on mount
  useEffect(() => {
    const k10 = (window as any).k10;
    (async () => {
      // Try Electron IPC first
      if (k10?.getDiscordUser) {
        try {
          const user = await k10.getDiscordUser();
          if (user?.id) { setDiscordUser(user); return; }
        } catch { /* ok */ }
      }
      // Fallback: check settings stored in localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('k10-settings') || '{}');
        if (saved.discordUser?.id) setDiscordUser(saved.discordUser);
      } catch { /* ok */ }
    })();
  }, []);

  const connectDiscord = useCallback(async () => {
    if (discordConnecting) return;
    const k10 = (window as any).k10;
    if (!k10?.discordConnect) {
      openDiscordInvite();
      return;
    }
    setDiscordConnecting(true);
    setDiscordError('');
    try {
      const result = await k10.discordConnect();
      if (result?.success && result.user) {
        setDiscordUser(result.user);
        // Persist to settings
        try {
          const saved = JSON.parse(localStorage.getItem('k10-settings') || '{}');
          saved.discordUser = result.user;
          localStorage.setItem('k10-settings', JSON.stringify(saved));
        } catch { /* ok */ }
      } else {
        setDiscordError(result?.error || 'Connection failed');
        setTimeout(() => setDiscordError(''), 3000);
      }
    } catch (err) {
      console.error('[K10] Discord connect error:', err);
      setDiscordError('Connection failed');
      setTimeout(() => setDiscordError(''), 3000);
    } finally {
      setDiscordConnecting(false);
    }
  }, [discordConnecting]);

  const disconnectDiscord = useCallback(async () => {
    const k10 = (window as any).k10;
    if (k10?.discordDisconnect) {
      await k10.discordDisconnect();
    }
    setDiscordUser(null);
    try {
      const saved = JSON.parse(localStorage.getItem('k10-settings') || '{}');
      delete saved.discordUser;
      localStorage.setItem('k10-settings', JSON.stringify(saved));
    } catch { /* ok */ }
  }, []);

  // Listen for Electron IPC settings-mode event (main process catches the global hotkey)
  useEffect(() => {
    const k10 = (window as any).k10;
    if (k10?.onSettingsMode) {
      k10.onSettingsMode((active: boolean) => {
        setIsOpen(active);
      });
    }
  }, []);

  // Fallback: keyboard shortcut Ctrl/Cmd+Shift+S (works when window is focused/interactive)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openDiscordInvite = () => {
    const k10 = (window as any).k10;
    if (k10?.openExternal) {
      k10.openExternal(DISCORD_GUILD_INVITE);
    } else {
      window.open(DISCORD_GUILD_INVITE, '_blank');
    }
  };

  const handleClose = () => setIsOpen(false);

  const handleToggle = (key: keyof typeof settings) => {
    if (typeof settings[key] === 'boolean') {
      updateSetting(key as any, !settings[key]);
    }
  };

  const handleSelectChange = (key: keyof typeof settings, value: any) => {
    updateSetting(key as any, value);
  };

  const handleRangeChange = (key: keyof typeof settings, value: number) => {
    updateSetting(key as any, value);
  };

  const handleTextInputChange = (key: keyof typeof settings, value: string) => {
    updateSetting(key as any, value);
  };

  // Layout position options
  const layoutPositions: LayoutPosition[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'];

  // Flag options for forcing
  const flagOptions = ['', 'yellow', 'red', 'blue', 'white', 'black', 'chequered', 'orange'];

  // Secondary layout options
  const secLayoutOptions: SecondaryLayout[] = ['stack', 'compact', 'minimal'];

  // Check if current position is center (for conditional flow direction)
  const isCenterPosition = settings.layoutPosition === 'top-center' || settings.layoutPosition === 'bottom-center';

  return (
    <div
      className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
      role="dialog"
      aria-label="Settings Panel"
      aria-hidden={!isOpen}
    >
      <div className={styles.panel}>
        <div className={styles.title}>Settings</div>
        <div className={styles.subtitle}>K10 Media Broadcaster</div>

        {/* Tabs */}
        <div className={styles.tabs} role="tablist">
          <button
            className={`${styles.tab} ${activeTab === 'sections' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('sections')}
            role="tab"
            aria-selected={activeTab === 'sections'}
            aria-controls="sections-panel"
          >
            Sections
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'layout' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('layout')}
            role="tab"
            aria-selected={activeTab === 'layout'}
            aria-controls="layout-panel"
          >
            Layout
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'connections' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('connections')}
            role="tab"
            aria-selected={activeTab === 'connections'}
            aria-controls="connections-panel"
          >
            Connections
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'keys' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('keys')}
            role="tab"
            aria-selected={activeTab === 'keys'}
            aria-controls="keys-panel"
          >
            Keys
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'system' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('system')}
            role="tab"
            aria-selected={activeTab === 'system'}
            aria-controls="system-panel"
          >
            System
          </button>
        </div>

        {/* Sections Tab */}
        <div
          id="sections-panel"
          className={`${styles.tabContent} ${activeTab === 'sections' ? styles.tabContentActive : ''}`}
          role="tabpanel"
        >
          <div className={styles.groupLabel}>Display</div>
          {[
            { key: 'showFuel' as const, label: 'Fuel' },
            { key: 'showTyres' as const, label: 'Tyres' },
            { key: 'showControls' as const, label: 'Controls' },
            { key: 'showPedals' as const, label: 'Pedals' },
            { key: 'showMaps' as const, label: 'Track Maps' },
            { key: 'showPosition' as const, label: 'Position' },
            { key: 'showTacho' as const, label: 'Tachometer' },
            { key: 'showCommentary' as const, label: 'Commentary' },
            { key: 'showLeaderboard' as const, label: 'Leaderboard' },
            { key: 'showDatastream' as const, label: 'Datastream' },
            { key: 'showIncidents' as const, label: 'Incidents' },
            { key: 'showWebGL' as const, label: 'WebGL' },
            { key: 'showK10Logo' as const, label: 'K10 Logo' },
            { key: 'showCarLogo' as const, label: 'Car Logo' },
          ].map(({ key, label }) => (
            <div key={key} className={styles.row}>
              <span className={styles.label}>{label}</span>
              <button
                className={`${styles.toggle} ${settings[key] ? styles.toggleOn : ''}`}
                onClick={() => handleToggle(key)}
                role="switch"
                aria-checked={settings[key] as boolean}
                aria-label={`Toggle ${label}`}
              />
            </div>
          ))}

          <div className={styles.groupLabel}>Effects</div>
          <div className={styles.row}>
            <span className={styles.label}>Spotter</span>
            <button
              className={`${styles.toggle} ${settings.showSpotter ? styles.toggleOn : ''}`}
              onClick={() => handleToggle('showSpotter')}
              role="switch"
              aria-checked={settings.showSpotter}
              aria-label="Toggle Spotter"
            />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Pit Limiter Animation</span>
            <button
              className={`${styles.toggle} ${settings.showBonkers ? styles.toggleOn : ''}`}
              onClick={() => handleToggle('showBonkers')}
              role="switch"
              aria-checked={settings.showBonkers}
              aria-label="Toggle Pit Limiter Animation"
            />
          </div>
        </div>

        {/* Layout Tab */}
        <div
          id="layout-panel"
          className={`${styles.tabContent} ${activeTab === 'layout' ? styles.tabContentActive : ''}`}
          role="tabpanel"
        >
          <div className={styles.groupLabel}>Position</div>
          <div className={styles.row}>
            <span className={styles.label}>Dashboard Position</span>
            <select
              className={styles.select}
              value={settings.layoutPosition}
              onChange={(e) => handleSelectChange('layoutPosition', e.target.value)}
              aria-label="Dashboard Position"
            >
              {layoutPositions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {isCenterPosition && (
            <>
              <div className={styles.groupLabel}>Flow Direction</div>
              <div className={styles.row}>
                <span className={styles.label}>Text Flow</span>
                <select
                  className={styles.select}
                  value={settings.layoutFlow}
                  onChange={(e) => handleSelectChange('layoutFlow', e.target.value)}
                  aria-label="Text Flow Direction"
                >
                  <option value="ltr">Left to Right</option>
                  <option value="rtl">Right to Left</option>
                </select>
              </div>
            </>
          )}

          <div className={styles.groupLabel}>Appearance</div>
          <div className={styles.row}>
            <span className={styles.label}>Vertical Swap</span>
            <button
              className={`${styles.toggle} ${settings.verticalSwap ? styles.toggleOn : ''}`}
              onClick={() => handleToggle('verticalSwap')}
              role="switch"
              aria-checked={settings.verticalSwap}
              aria-label="Toggle Vertical Swap"
            />
          </div>

          <div className={styles.groupLabel}>Mode</div>
          <div className={styles.row}>
            <span className={styles.label}>Rally Mode</span>
            <button
              className={`${styles.toggle} ${settings.rallyMode ? styles.toggleOn : ''}`}
              onClick={() => handleToggle('rallyMode')}
              role="switch"
              aria-checked={settings.rallyMode}
              aria-label="Toggle Rally Mode"
            />
          </div>

          <div className={styles.groupLabel}>Secondary Layout</div>
          <div className={styles.row}>
            <span className={styles.label}>Mode</span>
            <select
              className={styles.select}
              value={settings.secLayout}
              onChange={(e) => handleSelectChange('secLayout', e.target.value)}
              aria-label="Secondary Layout Mode"
            >
              {secLayoutOptions.map((layout) => (
                <option key={layout} value={layout}>
                  {layout.charAt(0).toUpperCase() + layout.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.groupLabel}>Offset</div>
          <div className={styles.row}>
            <span className={styles.label}>Offset X</span>
            <div className={styles.rangeRow}>
              <input
                type="range"
                className={styles.range}
                min="-200"
                max="200"
                value={settings.secOffsetX}
                onChange={(e) => handleRangeChange('secOffsetX', parseInt(e.target.value, 10))}
                aria-label="Offset X"
              />
              <span className={styles.rangeVal}>{settings.secOffsetX}</span>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Offset Y</span>
            <div className={styles.rangeRow}>
              <input
                type="range"
                className={styles.range}
                min="-200"
                max="200"
                value={settings.secOffsetY}
                onChange={(e) => handleRangeChange('secOffsetY', parseInt(e.target.value, 10))}
                aria-label="Offset Y"
              />
              <span className={styles.rangeVal}>{settings.secOffsetY}</span>
            </div>
          </div>

          <div className={styles.groupLabel}>Zoom</div>
          <div className={styles.row}>
            <span className={styles.label}>Zoom Level</span>
            <div className={styles.rangeRow}>
              <input
                type="range"
                className={styles.range}
                min="100"
                max="200"
                value={settings.zoom}
                onChange={(e) => handleRangeChange('zoom', parseInt(e.target.value, 10))}
                aria-label="Zoom Level"
              />
              <span className={styles.rangeVal}>{settings.zoom}%</span>
            </div>
          </div>
        </div>

        {/* Connections Tab */}
        <div
          id="connections-panel"
          className={`${styles.tabContent} ${activeTab === 'connections' ? styles.tabContentActive : ''}`}
          role="tabpanel"
        >
          <div className={styles.groupLabel}>SimHub Plugin</div>
          <div className={styles.row} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            <span className={styles.label}>SimHub URL</span>
            <input
              type="text"
              className={styles.input}
              value={settings.simhubUrl}
              onChange={(e) => handleTextInputChange('simhubUrl', e.target.value)}
              placeholder="http://localhost:8889/k10mediabroadcaster/"
              aria-label="SimHub URL"
            />
          </div>

          <div className={styles.groupLabel}>Discord</div>
          <div className="conn-card">
            <div className="conn-card-header">
              <div className="conn-card-icon discord">
                <span dangerouslySetInnerHTML={{ __html: DISCORD_ICON_SVG }} style={{ color: '#5865F2', width: 18, height: 18, display: 'flex' }} />
              </div>
              <div>
                <div className="conn-card-title">Discord</div>
                <div className="conn-card-subtitle">Connect to the K10 community server</div>
              </div>
            </div>

            {/* Not connected state */}
            {!discordUser && (
              <div>
                <div className="conn-card-status">
                  <div className={`conn-dot ${discordError ? 'red' : 'red'}`} />
                  <div className="conn-status-text">
                    {discordError
                      ? <><strong style={{ color: 'hsl(0,75%,60%)' }}>Failed</strong> — {discordError}</>
                      : 'Not connected'
                    }
                  </div>
                </div>
                <div className="conn-card-detail">
                  Connect your Discord account to join the K10 Media Broadcaster community and unlock future features for authenticated users.
                </div>
                <div className="conn-card-actions">
                  <button
                    className="conn-btn discord-btn"
                    onClick={connectDiscord}
                    disabled={discordConnecting}
                  >
                    {discordConnecting ? 'Connecting...' : (
                      <><span dangerouslySetInnerHTML={{ __html: DISCORD_ICON_SVG }} style={{ width: 12, height: 12, display: 'inline-flex', verticalAlign: '-1px', marginRight: 4 }} /> Connect Discord</>
                    )}
                  </button>
                  <button className="conn-btn invite-btn" onClick={openDiscordInvite}>
                    Join Server
                  </button>
                </div>
              </div>
            )}

            {/* Connected state */}
            {discordUser && (
              <div>
                <div className="conn-card-status">
                  <div className="conn-dot green" />
                  <div className="conn-status-text"><strong>Connected</strong></div>
                </div>
                <div className="conn-user-info">
                  <div className="conn-user-avatar">
                    {discordUser.avatar && (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`}
                        alt={discordUser.globalName || discordUser.username}
                      />
                    )}
                  </div>
                  <div>
                    <div className="conn-user-name">{discordUser.globalName || discordUser.username}</div>
                    <div className="conn-user-id">{discordUser.id}</div>
                  </div>
                </div>
                <div className="conn-card-actions">
                  <button className="conn-btn invite-btn" onClick={openDiscordInvite}>
                    Join Server
                  </button>
                  <button className="conn-btn disconnect-btn" onClick={disconnectDiscord}>
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Keys Tab */}
        <div
          id="keys-panel"
          className={`${styles.tabContent} ${activeTab === 'keys' ? styles.tabContentActive : ''}`}
          role="tabpanel"
        >
          <div className={styles.groupLabel}>Window</div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd></span>
            <span className={styles.keyDesc}>Open / Close Settings</span>
          </div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd></span>
            <span className={styles.keyDesc}>Show / Hide Overlay</span>
          </div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd></span>
            <span className={styles.keyDesc}>Reset Window Position</span>
          </div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd></span>
            <span className={styles.keyDesc}>Toggle Green Screen</span>
          </div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd></span>
            <span className={styles.keyDesc}>Quit Application</span>
          </div>

          <div className={styles.groupLabel}>Dashboard</div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd></span>
            <span className={styles.keyDesc}>Reset Track Map</span>
          </div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></span>
            <span className={styles.keyDesc}>Restart Demo</span>
          </div>
          <div className={styles.keyRow}>
            <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd></span>
            <span className={styles.keyDesc}>Toggle React / Original Dashboard</span>
          </div>
        </div>

        {/* System Tab */}
        <div
          id="system-panel"
          className={`${styles.tabContent} ${activeTab === 'system' ? styles.tabContentActive : ''}`}
          role="tabpanel"
        >
          <div className={styles.groupLabel}>Testing</div>
          <div className={styles.row}>
            <span className={styles.label}>Force Flag</span>
            <select
              className={styles.select}
              value={settings.forceFlag}
              onChange={(e) => handleSelectChange('forceFlag', e.target.value)}
              aria-label="Force Flag"
            >
              {flagOptions.map((flag) => (
                <option key={flag} value={flag}>
                  {flag || 'None'}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.groupLabel}>Effects</div>
          <div className={styles.row}>
            <span className={styles.label}>Green Screen</span>
            <button
              className={`${styles.toggle} ${settings.greenScreen ? styles.toggleOn : ''}`}
              onClick={() => handleToggle('greenScreen')}
              role="switch"
              aria-checked={settings.greenScreen}
              aria-label="Toggle Green Screen"
            />
          </div>
        </div>

        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close Settings">
          Close Settings
        </button>

        <div className={styles.hotkeys}>
          Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> to toggle settings
        </div>
      </div>
    </div>
  );
}
