/**
 * Overlay settings and configuration types.
 * These settings persist to localStorage (browser) or Electron IPC (overlay app).
 */

/**
 * Discord user data returned from Electron IPC OAuth2 flow.
 */
export interface DiscordUser {
  id: string;
  username: string;
  globalName?: string;
  avatar?: string;
}

/**
 * Layout position in the viewport.
 */
export type LayoutPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

/**
 * Secondary layout mode (how secondary sections are arranged).
 */
export type SecondaryLayout = 'stack' | 'compact' | 'minimal';

/**
 * Text layout flow direction.
 */
export type LayoutFlow = 'ltr' | 'rtl';

/**
 * Complete overlay settings matching the dashboard's _settings object.
 */
export interface OverlaySettings {
  // ═══ Visibility toggles for major sections ═══
  showFuel: boolean;
  showTyres: boolean;
  showControls: boolean;
  showPedals: boolean;
  showMaps: boolean;
  showPosition: boolean;
  showTacho: boolean;
  showCommentary: boolean;
  showK10Logo: boolean;
  showCarLogo: boolean;
  showLeaderboard: boolean;
  showDatastream: boolean;
  showIncidents: boolean;
  showWebGL: boolean;
  showSpotter: boolean;
  showBonkers: boolean;

  // ═══ Connection ═══
  simhubUrl: string;

  // ═══ Layout ═══
  layoutPosition: LayoutPosition;
  layoutFlow: LayoutFlow;
  verticalSwap: boolean;

  // ═══ Effects ═══
  greenScreen: boolean;
  rallyMode: boolean;

  // ═══ Zoom & Scale ═══
  zoom: number;

  // ═══ Incident Thresholds (component-facing aliases) ═══
  incidentPenaltyLimit: number;
  incidentDQLimit: number;

  // ═══ Demo / Testing ═══
  forceFlag: string;

  // ═══ Incident Thresholds ═══
  incPenalty: number;
  incDQ: number;

  // ═══ Secondary Layout ═══
  secLayout: SecondaryLayout;
  secOffsetX: number;
  secOffsetY: number;
}

/**
 * Default settings matching the dashboard's _defaultSettings.
 */
export const DEFAULT_SETTINGS: OverlaySettings = {
  showFuel: true,
  showTyres: true,
  showControls: true,
  showPedals: true,
  showMaps: true,
  showPosition: true,
  showTacho: true,
  showCommentary: true,
  showK10Logo: true,
  showCarLogo: true,
  showLeaderboard: true,
  showDatastream: true,
  showIncidents: true,
  showWebGL: true,
  showSpotter: true,
  showBonkers: true,

  simhubUrl: 'http://localhost:8889/k10mediabroadcaster/',

  layoutPosition: 'top-right',
  layoutFlow: 'ltr',
  verticalSwap: false,

  greenScreen: false,
  rallyMode: false,

  zoom: 165,

  forceFlag: '',

  incPenalty: 17,
  incDQ: 25,
  incidentPenaltyLimit: 17,
  incidentDQLimit: 25,

  secLayout: 'stack',
  secOffsetX: 0,
  secOffsetY: 0,
};

/**
 * Type guard to validate that an object matches OverlaySettings shape.
 */
export function isValidSettings(obj: unknown): obj is OverlaySettings {
  if (typeof obj !== 'object' || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.showFuel === 'boolean' &&
    typeof s.showTyres === 'boolean' &&
    typeof s.layoutPosition === 'string' &&
    typeof s.zoom === 'number'
  );
}

/**
 * Merge partial settings with defaults, ensuring all required keys exist.
 */
export function mergeSettings(partial: Partial<OverlaySettings>): OverlaySettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
  };
}
