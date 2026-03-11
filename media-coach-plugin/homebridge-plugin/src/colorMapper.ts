import { HSBColor, SimHubState, LightMode, BlinkConfig } from './types';

/**
 * Maps SimHub telemetry state to HomeKit light colors
 * Implements flag, severity, and proximity-based color logic
 */
export class ColorMapper {
  /**
   * Maps iRacing flag state to HSB color
   */
  static mapFlagToColor(flag: string): HSBColor {
    switch (flag.toLowerCase()) {
      case 'green':
        return { hue: 120, saturation: 100, brightness: 80 };
      case 'yellow':
        return { hue: 60, saturation: 100, brightness: 100 };
      case 'red':
        return { hue: 0, saturation: 100, brightness: 100 };
      case 'black':
        // Pulsing white (blink logic handles the pulse) — not off, since
        // lights-off is indistinguishable from disconnected/no signal
        return { hue: 0, saturation: 0, brightness: 100 };
      case 'white':
        return { hue: 0, saturation: 0, brightness: 100 };
      case 'blue':
        return { hue: 240, saturation: 100, brightness: 80 };
      case 'debris':
        return { hue: 30, saturation: 100, brightness: 90 };
      case 'checkered':
        // Alternating handled by blink logic; base color is white
        return { hue: 0, saturation: 0, brightness: 100 };
      default:
        return { hue: 0, saturation: 0, brightness: 0 }; // Off/ambient
    }
  }

  /**
   * Maps event category to HSB color for lights.
   * Uses the same hue families as the dashboard overlay, but at full brightness
   * since lights don't have an alpha channel — severity is encoded as brightness.
   * Colors deliberately avoid flag colors (red, yellow, blue, orange, black).
   */
  static mapCategoryToColor(category: string, severity: number): HSBColor {
    // Severity → brightness: higher severity = brighter light
    const brightnessMap: Record<number, number> = {
      0: 30, 1: 40, 2: 55, 3: 70, 4: 85, 5: 100,
    };
    const brightness = brightnessMap[severity] ?? 30;

    switch (category?.toLowerCase()) {
      case 'hardware':
        // Cyan — matches dashboard #00ACC1
        return { hue: 187, saturation: 100, brightness };
      case 'game_feel':
        // Purple — matches dashboard #AB47BC
        return { hue: 291, saturation: 62, brightness };
      case 'car_response':
        // Green — matches dashboard #66BB6A
        return { hue: 123, saturation: 45, brightness };
      case 'racing_experience':
        // Magenta/Pink — matches dashboard #EC407A
        return { hue: 340, saturation: 73, brightness };
      default:
        return { hue: 120, saturation: 50, brightness: 30 };
    }
  }

  /**
   * Maps event severity (0-5) to HSB color.
   * Legacy method — used when category is not available.
   * Colors avoid flag collision: uses category-neutral teal/white scale.
   */
  static mapSeverityToColor(severity: number): HSBColor {
    switch (severity) {
      case 0:
        return { hue: 120, saturation: 50, brightness: 30 };
      case 1:
        return { hue: 187, saturation: 30, brightness: 40 };
      case 2:
        return { hue: 187, saturation: 50, brightness: 55 };
      case 3:
        return { hue: 187, saturation: 70, brightness: 70 };
      case 4:
        return { hue: 187, saturation: 85, brightness: 85 };
      case 5:
        return { hue: 187, saturation: 100, brightness: 100 };
      default:
        return { hue: 120, saturation: 50, brightness: 30 };
    }
  }

  /**
   * Maps opponent proximity (as track distance fraction) to HSB color
   * distance: 0.0 = very close, 1.0 = far away
   */
  static mapProximityToColor(distance: number): HSBColor {
    if (distance < 0.008) {
      // Very close (< 0.8% track) - red danger
      return { hue: 0, saturation: 100, brightness: 100 };
    } else if (distance < 0.02) {
      // Medium (< 2% track) - orange alert
      return { hue: 30, saturation: 100, brightness: 90 };
    } else {
      // Clear - ambient green
      return { hue: 120, saturation: 50, brightness: 30 };
    }
  }

  /**
   * Resolves final color based on mode priority
   * Flags take priority over events, events over severity, severity over ambient
   */
  static resolveColor(state: SimHubState, mode: LightMode): HSBColor {
    switch (mode) {
      case 'flags_only':
        // Only show flag state
        if (state.currentFlagState && state.currentFlagState !== 'none') {
          return this.mapFlagToColor(state.currentFlagState);
        }
        return { hue: 120, saturation: 50, brightness: 30 };

      case 'events_only':
        // Proximity and track state only
        return this.mapProximityToColor(state.nearestCarDistance);

      case 'all_colors':
        // Priority: flag > event category+severity > proximity > ambient
        // Flag colors are preserved as-is (red, yellow, blue, etc.)
        if (state.currentFlagState && state.currentFlagState !== 'none' && state.currentFlagState !== 'green') {
          return this.mapFlagToColor(state.currentFlagState);
        }

        // If commentary is visible, use category color with severity brightness
        if (state.commentaryVisible && state.commentarySeverity > 0) {
          if (state.commentaryCategory) {
            return this.mapCategoryToColor(state.commentaryCategory, state.commentarySeverity);
          }
          return this.mapSeverityToColor(state.commentarySeverity);
        }

        // Fall back to proximity
        return this.mapProximityToColor(state.nearestCarDistance);

      default:
        return { hue: 120, saturation: 50, brightness: 30 };
    }
  }

  /**
   * Determines if current state should blink and at what frequency
   * Returns blink config or null if no blinking should occur
   */
  static getBlinkConfig(state: SimHubState, mode: LightMode): BlinkConfig | null {
    // Blinking disabled if not in all_colors mode, or flag doesn't support it
    if (mode === 'events_only') {
      return null;
    }

    const flag = state.currentFlagState?.toLowerCase() || '';

    // Flag-based blinking
    if (flag === 'yellow') {
      return {
        enabled: true,
        frequency: 1.0, // 1 Hz - slow blink
        duration: 1000,
      };
    }

    if (flag === 'red') {
      return {
        enabled: true,
        frequency: 2.0, // 2 Hz - fast blink
        duration: 1000,
      };
    }

    if (flag === 'black') {
      return {
        enabled: true,
        frequency: 0.5, // 0.5 Hz - slow pulse
        duration: 2000,
      };
    }

    if (flag === 'debris') {
      return {
        enabled: true,
        frequency: 0.5, // 0.5 Hz - slow pulse
        duration: 2000,
      };
    }

    if (flag === 'checkered') {
      return {
        enabled: true,
        frequency: 2.0, // 2 Hz - alternating black/white
        duration: 1000,
      };
    }

    // Proximity-based blinking (close racing)
    if (state.nearestCarDistance < 0.008) {
      return {
        enabled: true,
        frequency: 2.0, // 2 Hz - fast blink for "car left/right" urgency
        duration: 1000,
      };
    }

    // No blinking
    return null;
  }

  /**
   * Extracts RGB components from #AARRGGBB hex color string
   * Useful for dashboard displays
   */
  static hexToRgb(
    hex: string,
  ): { r: number; g: number; b: number; a: number } {
    // Remove # and parse
    const normalized = hex.replace('#', '').padStart(8, 'F');
    const a = parseInt(normalized.substring(0, 2), 16);
    const r = parseInt(normalized.substring(2, 4), 16);
    const g = parseInt(normalized.substring(4, 6), 16);
    const b = parseInt(normalized.substring(6, 8), 16);

    return { r, g, b, a };
  }

  /**
   * Converts HSB to RGB, then to #AARRGGBB hex
   */
  static hsbToHex(color: HSBColor): string {
    const { r, g, b } = this.hsbToRgb(color);
    const hex = `#FF${this.padHex(r)}${this.padHex(g)}${this.padHex(b)}`;
    return hex;
  }

  /**
   * Converts HSB to RGB
   */
  private static hsbToRgb(color: HSBColor): { r: number; g: number; b: number } {
    const h = color.hue % 360;
    const s = color.saturation / 100;
    const b = color.brightness / 100;

    const c = b * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = b - c;

    let r = 0,
      g = 0,
      b_out = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
    } else if (h >= 120 && h < 180) {
      g = c;
      b_out = x;
    } else if (h >= 180 && h < 240) {
      g = x;
      b_out = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      b_out = c;
    } else if (h >= 300 && h < 360) {
      r = c;
      b_out = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b_out + m) * 255),
    };
  }

  /**
   * Pads single hex digit with zero
   */
  private static padHex(value: number): string {
    return value.toString(16).toUpperCase().padStart(2, '0');
  }
}
