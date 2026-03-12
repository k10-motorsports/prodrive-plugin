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
  merossIp?: string;         // Optional: Meross device IP for direct local control
  merossPort?: number;       // Optional: Meross device port (default: 80)
  merossKey?: string;        // Optional: Meross device auth key (default: "")
  hapIp?: string;            // Optional: VOCOlinc/HAP device IP for direct local control
  hapPort?: number;          // Optional: HAP device port (default: 80)
  hapPin?: string;           // Optional: HomeKit PIN for initial pairing (e.g. "123-45-678")
  hapDeviceId?: string;      // Optional: HAP device ID/MAC (used as pairing identity)
}

export interface PluginConfig {
  simhubUrl: string;
  pollIntervalMs: number;
  mode: LightMode;
  enableBlink: boolean;
  ambientColor: AmbientColor;
  lights: LightConfig[];
  enableFlagSensors: boolean;  // Register OccupancySensor accessories per flag for HomeKit automations
}

export interface PlatformAccessoryContext {
  lightConfig: LightConfig;
}
