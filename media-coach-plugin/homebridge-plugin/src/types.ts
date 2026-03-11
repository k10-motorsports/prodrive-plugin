/**
 * Shared type definitions for the Media Coach Homebridge plugin
 */

export type LightMode = 'flags_only' | 'events_only' | 'all_colors';

export interface HSBColor {
  hue: number;      // 0-360 degrees
  saturation: number; // 0-100 percentage
  brightness: number; // 0-100 percentage
}

export interface SimHubState {
  commentarySeverity: number;     // 0-5
  commentaryVisible: boolean;      // whether a prompt is currently shown
  commentarySentimentColor: string; // #AARRGGBB hex color (category hue + severity alpha)
  commentaryCategory: string;      // 'hardware', 'game_feel', 'car_response', 'racing_experience'
  currentFlagState: string;        // 'green', 'yellow', 'red', 'black', 'white', 'blue', 'debris', 'none'
  nearestCarDistance: number;      // 0.0-1.0 fraction of track
  isConnected: boolean;            // whether SimHub is reachable
}

export interface BlinkConfig {
  enabled: boolean;
  frequency: number;  // Hz (1.0 = 1 blink per second)
  duration: number;   // milliseconds
}

export interface AmbientColor {
  hue: number;
  saturation: number;
  brightness: number;
}

export interface LightConfig {
  name: string;
  uniqueId: string;
  mode?: LightMode;          // Per-light mode override (falls back to global mode)
  enableBlink?: boolean;     // Per-light blink override (falls back to global enableBlink)
}

export interface PluginConfig {
  simhubUrl: string;
  pollIntervalMs: number;
  mode: LightMode;
  enableBlink: boolean;
  ambientColor: AmbientColor;
  lights: LightConfig[];
}

export interface PlatformAccessoryContext {
  lightConfig: LightConfig;
}
