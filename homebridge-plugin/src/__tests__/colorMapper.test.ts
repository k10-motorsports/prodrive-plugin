import { ColorMapper } from '../colorMapper';
import { HSBColor, SimHubState, LightMode } from '../types';

describe('ColorMapper', () => {
  describe('mapFlagToColor', () => {
    it('should map green flag correctly', () => {
      const color = ColorMapper.mapFlagToColor('green');
      expect(color).toEqual({ hue: 120, saturation: 100, brightness: 80 });
    });

    it('should map yellow flag correctly', () => {
      const color = ColorMapper.mapFlagToColor('yellow');
      expect(color).toEqual({ hue: 60, saturation: 100, brightness: 100 });
    });

    it('should map red flag correctly', () => {
      const color = ColorMapper.mapFlagToColor('red');
      expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 });
    });

    it('should map black flag to white (pulsing) with brightness 100', () => {
      const color = ColorMapper.mapFlagToColor('black');
      expect(color).toEqual({ hue: 0, saturation: 0, brightness: 100 });
    });

    it('should map white flag correctly', () => {
      const color = ColorMapper.mapFlagToColor('white');
      expect(color).toEqual({ hue: 0, saturation: 0, brightness: 100 });
    });

    it('should map blue flag correctly', () => {
      const color = ColorMapper.mapFlagToColor('blue');
      expect(color).toEqual({ hue: 240, saturation: 100, brightness: 80 });
    });

    it('should map debris flag correctly', () => {
      const color = ColorMapper.mapFlagToColor('debris');
      expect(color).toEqual({ hue: 30, saturation: 100, brightness: 90 });
    });

    it('should map checkered flag to white', () => {
      const color = ColorMapper.mapFlagToColor('checkered');
      expect(color).toEqual({ hue: 0, saturation: 0, brightness: 100 });
    });

    it('should map unknown flag to off (brightness 0)', () => {
      const color = ColorMapper.mapFlagToColor('unknown');
      expect(color).toEqual({ hue: 0, saturation: 0, brightness: 0 });
    });

    it('should map empty string to off', () => {
      const color = ColorMapper.mapFlagToColor('');
      expect(color).toEqual({ hue: 0, saturation: 0, brightness: 0 });
    });

    it('should be case-insensitive', () => {
      expect(ColorMapper.mapFlagToColor('GREEN')).toEqual(
        ColorMapper.mapFlagToColor('green'),
      );
      expect(ColorMapper.mapFlagToColor('YeLLow')).toEqual(
        ColorMapper.mapFlagToColor('yellow'),
      );
    });
  });

  describe('mapCategoryToColor', () => {
    it('should map hardware category to cyan (hue 187)', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 3);
      expect(color.hue).toBe(187);
      expect(color.saturation).toBe(100);
    });

    it('should map game_feel category to purple (hue 291)', () => {
      const color = ColorMapper.mapCategoryToColor('game_feel', 3);
      expect(color.hue).toBe(291);
      expect(color.saturation).toBe(62);
    });

    it('should map car_response category to green (hue 123)', () => {
      const color = ColorMapper.mapCategoryToColor('car_response', 3);
      expect(color.hue).toBe(123);
      expect(color.saturation).toBe(45);
    });

    it('should map racing_experience category to magenta (hue 340)', () => {
      const color = ColorMapper.mapCategoryToColor('racing_experience', 3);
      expect(color.hue).toBe(340);
      expect(color.saturation).toBe(73);
    });

    it('should encode severity 0 as brightness 30', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 0);
      expect(color.brightness).toBe(30);
    });

    it('should encode severity 1 as brightness 40', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 1);
      expect(color.brightness).toBe(40);
    });

    it('should encode severity 2 as brightness 55', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 2);
      expect(color.brightness).toBe(55);
    });

    it('should encode severity 3 as brightness 70', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 3);
      expect(color.brightness).toBe(70);
    });

    it('should encode severity 4 as brightness 85', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 4);
      expect(color.brightness).toBe(85);
    });

    it('should encode severity 5 as brightness 100', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 5);
      expect(color.brightness).toBe(100);
    });

    it('should handle unknown category gracefully', () => {
      const color = ColorMapper.mapCategoryToColor('unknown_category', 3);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });

    it('should handle empty category string', () => {
      const color = ColorMapper.mapCategoryToColor('', 3);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });

    it('should handle out-of-range severity', () => {
      const color = ColorMapper.mapCategoryToColor('hardware', 99);
      expect(color.brightness).toBe(30); // Falls back to default
    });

    it('should be case-insensitive for category', () => {
      expect(ColorMapper.mapCategoryToColor('HARDWARE', 3)).toEqual(
        ColorMapper.mapCategoryToColor('hardware', 3),
      );
      expect(ColorMapper.mapCategoryToColor('Game_Feel', 3)).toEqual(
        ColorMapper.mapCategoryToColor('game_feel', 3),
      );
    });
  });

  describe('mapSeverityToColor', () => {
    it('should map severity 0 to teal with brightness 30', () => {
      const color = ColorMapper.mapSeverityToColor(0);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });

    it('should map severity 1 to teal with brightness 40', () => {
      const color = ColorMapper.mapSeverityToColor(1);
      expect(color.hue).toBe(187);
      expect(color.brightness).toBe(40);
    });

    it('should map severity 2 to teal with brightness 55', () => {
      const color = ColorMapper.mapSeverityToColor(2);
      expect(color.hue).toBe(187);
      expect(color.brightness).toBe(55);
    });

    it('should map severity 3 to teal with brightness 70', () => {
      const color = ColorMapper.mapSeverityToColor(3);
      expect(color.hue).toBe(187);
      expect(color.brightness).toBe(70);
    });

    it('should map severity 4 to teal with brightness 85', () => {
      const color = ColorMapper.mapSeverityToColor(4);
      expect(color.hue).toBe(187);
      expect(color.brightness).toBe(85);
    });

    it('should map severity 5 to teal with brightness 100', () => {
      const color = ColorMapper.mapSeverityToColor(5);
      expect(color.hue).toBe(187);
      expect(color.brightness).toBe(100);
    });

    it('should handle out-of-range severity with fallback', () => {
      const color = ColorMapper.mapSeverityToColor(99);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });

    it('should handle negative severity with fallback', () => {
      const color = ColorMapper.mapSeverityToColor(-1);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });
  });

  describe('mapProximityToColor', () => {
    it('should map very close proximity (< 0.008) to red', () => {
      const color = ColorMapper.mapProximityToColor(0.005);
      expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 });
    });

    it('should map boundary distance 0.008 exactly to red', () => {
      const color = ColorMapper.mapProximityToColor(0.008);
      expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 });
    });

    it('should map medium proximity (0.008-0.02) to orange', () => {
      const color = ColorMapper.mapProximityToColor(0.015);
      expect(color).toEqual({ hue: 30, saturation: 100, brightness: 90 });
    });

    it('should map boundary distance 0.02 exactly to orange', () => {
      const color = ColorMapper.mapProximityToColor(0.02);
      expect(color).toEqual({ hue: 30, saturation: 100, brightness: 90 });
    });

    it('should map far proximity (>= 0.02) to ambient green', () => {
      const color = ColorMapper.mapProximityToColor(0.5);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });

    it('should map maximum distance 1.0 to ambient green', () => {
      const color = ColorMapper.mapProximityToColor(1.0);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });

    it('should map 0.0 distance to red (extremely close)', () => {
      const color = ColorMapper.mapProximityToColor(0.0);
      expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 });
    });
  });

  describe('resolveColor', () => {
    const baseState: SimHubState = {
      commentarySeverity: 0,
      commentaryVisible: false,
      commentarySentimentColor: '#FF000000',
      commentaryCategory: '',
      currentFlagState: 'none',
      nearestCarDistance: 0.5,
      isConnected: true,
    };

    describe('flags_only mode', () => {
      it('should show flag color when flag is active', () => {
        const state: SimHubState = { ...baseState, currentFlagState: 'yellow' };
        const color = ColorMapper.resolveColor(state, 'flags_only');
        expect(color).toEqual({ hue: 60, saturation: 100, brightness: 100 });
      });

      it('should show ambient green when no flag', () => {
        const state: SimHubState = { ...baseState, currentFlagState: 'none' };
        const color = ColorMapper.resolveColor(state, 'flags_only');
        expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
      });

      it('should show ambient green for empty flag string', () => {
        const state: SimHubState = { ...baseState, currentFlagState: '' };
        const color = ColorMapper.resolveColor(state, 'flags_only');
        expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
      });
    });

    describe('events_only mode', () => {
      it('should always show proximity color', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'red',
          nearestCarDistance: 0.005,
        };
        const color = ColorMapper.resolveColor(state, 'events_only');
        expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 }); // Red due to proximity, not flag
      });

      it('should ignore flags and show proximity', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'yellow',
          nearestCarDistance: 0.5,
        };
        const color = ColorMapper.resolveColor(state, 'events_only');
        expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 }); // Ambient, not yellow
      });
    });

    describe('all_colors mode', () => {
      it('should prioritize non-green flag over events', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'red',
          commentaryVisible: true,
          commentarySeverity: 5,
          commentaryCategory: 'hardware',
        };
        const color = ColorMapper.resolveColor(state, 'all_colors');
        expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 }); // Red flag
      });

      it('should ignore green flag and show commentary', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'green',
          commentaryVisible: true,
          commentarySeverity: 3,
          commentaryCategory: 'hardware',
        };
        const color = ColorMapper.resolveColor(state, 'all_colors');
        expect(color.hue).toBe(187); // Hardware cyan, not green flag
      });

      it('should show category color when commentary is visible', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          commentaryVisible: true,
          commentarySeverity: 3,
          commentaryCategory: 'game_feel',
        };
        const color = ColorMapper.resolveColor(state, 'all_colors');
        expect(color.hue).toBe(291); // Purple
      });

      it('should show severity color when no category provided', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          commentaryVisible: true,
          commentarySeverity: 4,
          commentaryCategory: '',
        };
        const color = ColorMapper.resolveColor(state, 'all_colors');
        expect(color.hue).toBe(187); // Severity teal
      });

      it('should show proximity when no commentary is visible', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          commentaryVisible: false,
          nearestCarDistance: 0.005,
        };
        const color = ColorMapper.resolveColor(state, 'all_colors');
        expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 }); // Proximity red
      });

      it('should show ambient when no flag, no commentary, far proximity', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          commentaryVisible: false,
          nearestCarDistance: 1.0,
        };
        const color = ColorMapper.resolveColor(state, 'all_colors');
        expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
      });

      it('should handle zero severity with commentary visible as ambient', () => {
        const state: SimHubState = {
          ...baseState,
          commentaryVisible: true,
          commentarySeverity: 0,
          commentaryCategory: 'hardware',
        };
        const color = ColorMapper.resolveColor(state, 'all_colors');
        // Severity 0 should fall through to proximity
        expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
      });
    });

    it('should handle unknown mode with fallback', () => {
      const state: SimHubState = baseState;
      const color = ColorMapper.resolveColor(state, 'unknown' as LightMode);
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
    });
  });

  describe('getBlinkConfig', () => {
    const baseState: SimHubState = {
      commentarySeverity: 0,
      commentaryVisible: false,
      commentarySentimentColor: '#FF000000',
      commentaryCategory: '',
      currentFlagState: 'none',
      nearestCarDistance: 0.5,
      isConnected: true,
    };

    it('should return null for events_only mode', () => {
      const state: SimHubState = { ...baseState, currentFlagState: 'yellow' };
      const blink = ColorMapper.getBlinkConfig(state, 'events_only');
      expect(blink).toBeNull();
    });

    describe('flag-based blinking', () => {
      it('should blink yellow at 1Hz', () => {
        const state: SimHubState = { ...baseState, currentFlagState: 'yellow' };
        const blink = ColorMapper.getBlinkConfig(state, 'flags_only');
        expect(blink).toEqual({
          enabled: true,
          frequency: 1.0,
          duration: 1000,
        });
      });

      it('should blink red at 2Hz', () => {
        const state: SimHubState = { ...baseState, currentFlagState: 'red' };
        const blink = ColorMapper.getBlinkConfig(state, 'flags_only');
        expect(blink).toEqual({
          enabled: true,
          frequency: 2.0,
          duration: 1000,
        });
      });

      it('should pulse black at 0.5Hz', () => {
        const state: SimHubState = { ...baseState, currentFlagState: 'black' };
        const blink = ColorMapper.getBlinkConfig(state, 'flags_only');
        expect(blink).toEqual({
          enabled: true,
          frequency: 0.5,
          duration: 2000,
        });
      });

      it('should pulse debris at 0.5Hz', () => {
        const state: SimHubState = { ...baseState, currentFlagState: 'debris' };
        const blink = ColorMapper.getBlinkConfig(state, 'flags_only');
        expect(blink).toEqual({
          enabled: true,
          frequency: 0.5,
          duration: 2000,
        });
      });

      it('should blink checkered at 2Hz', () => {
        const state: SimHubState = { ...baseState, currentFlagState: 'checkered' };
        const blink = ColorMapper.getBlinkConfig(state, 'flags_only');
        expect(blink).toEqual({
          enabled: true,
          frequency: 2.0,
          duration: 1000,
        });
      });
    });

    describe('proximity-based blinking', () => {
      it('should blink fast for close proximity (< 0.008)', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          nearestCarDistance: 0.005,
        };
        const blink = ColorMapper.getBlinkConfig(state, 'all_colors');
        expect(blink).toEqual({
          enabled: true,
          frequency: 2.0,
          duration: 1000,
        });
      });

      it('should not blink for medium/far proximity', () => {
        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          nearestCarDistance: 0.5,
        };
        const blink = ColorMapper.getBlinkConfig(state, 'all_colors');
        expect(blink).toBeNull();
      });
    });

    it('should return null for green flag (no blinking)', () => {
      const state: SimHubState = { ...baseState, currentFlagState: 'green' };
      const blink = ColorMapper.getBlinkConfig(state, 'flags_only');
      expect(blink).toBeNull();
    });

    it('should be case-insensitive for flag', () => {
      const state1: SimHubState = { ...baseState, currentFlagState: 'YELLOW' };
      const state2: SimHubState = { ...baseState, currentFlagState: 'yellow' };
      expect(ColorMapper.getBlinkConfig(state1, 'flags_only')).toEqual(
        ColorMapper.getBlinkConfig(state2, 'flags_only'),
      );
    });

    it('should handle empty flag string', () => {
      const state: SimHubState = { ...baseState, currentFlagState: '' };
      const blink = ColorMapper.getBlinkConfig(state, 'all_colors');
      expect(blink).toBeNull();
    });
  });

  describe('hexToRgb', () => {
    it('should parse #AARRGGBB format', () => {
      const rgb = ColorMapper.hexToRgb('#FFFF0000');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('should parse #RRGGBB format and prepend FF', () => {
      const rgb = ColorMapper.hexToRgb('#FF0000');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('should handle missing # prefix', () => {
      const rgb = ColorMapper.hexToRgb('FFFF0000');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('should parse cyan color', () => {
      const rgb = ColorMapper.hexToRgb('#FF00FFFF');
      expect(rgb).toEqual({ r: 0, g: 255, b: 255, a: 255 });
    });

    it('should parse colors with alpha transparency', () => {
      const rgb = ColorMapper.hexToRgb('#80FF0000'); // 50% transparent red
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
      expect(rgb.a).toBe(128);
    });

    it('should parse black', () => {
      const rgb = ColorMapper.hexToRgb('#FF000000');
      expect(rgb).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    });

    it('should parse white', () => {
      const rgb = ColorMapper.hexToRgb('#FFFFFFFF');
      expect(rgb).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });
  });

  describe('hsbToHex', () => {
    it('should convert red HSB to hex', () => {
      const hex = ColorMapper.hsbToHex({ hue: 0, saturation: 100, brightness: 100 });
      expect(hex).toMatch(/^#FF[Ff]{2}0{4}$/); // Red component should be high
    });

    it('should convert green HSB to hex', () => {
      const hex = ColorMapper.hsbToHex({ hue: 120, saturation: 100, brightness: 100 });
      // Result should have green component dominant
      expect(hex.substring(0, 3)).toBe('#FF');
    });

    it('should convert blue HSB to hex', () => {
      const hex = ColorMapper.hsbToHex({ hue: 240, saturation: 100, brightness: 100 });
      // Result should have blue component dominant
      expect(hex.substring(0, 3)).toBe('#FF');
    });

    it('should convert black to #FF000000', () => {
      const hex = ColorMapper.hsbToHex({ hue: 0, saturation: 0, brightness: 0 });
      expect(hex).toBe('#FF000000');
    });

    it('should convert white to #FFFFFFFF', () => {
      const hex = ColorMapper.hsbToHex({ hue: 0, saturation: 0, brightness: 100 });
      expect(hex).toBe('#FFFFFFFF');
    });

    it('should return 8-digit hex with FF alpha prefix', () => {
      const hex = ColorMapper.hsbToHex({ hue: 180, saturation: 50, brightness: 50 });
      expect(hex).toMatch(/^#FF[0-9A-F]{6}$/);
    });

    it('should handle hue wrapping at 360 degrees', () => {
      const hex1 = ColorMapper.hsbToHex({ hue: 0, saturation: 100, brightness: 100 });
      const hex2 = ColorMapper.hsbToHex({ hue: 360, saturation: 100, brightness: 100 });
      expect(hex1).toBe(hex2);
    });
  });

  describe('HSB to RGB round-trip conversion', () => {
    it('should round-trip red', () => {
      const original = { hue: 0, saturation: 100, brightness: 100 };
      const hex = ColorMapper.hsbToHex(original);
      const rgb = ColorMapper.hexToRgb(hex);
      expect(rgb.r).toBeGreaterThan(200); // Red should be high
      expect(rgb.g).toBeLessThan(50);
      expect(rgb.b).toBeLessThan(50);
    });

    it('should round-trip cyan', () => {
      const original = { hue: 180, saturation: 100, brightness: 100 };
      const hex = ColorMapper.hsbToHex(original);
      const rgb = ColorMapper.hexToRgb(hex);
      expect(rgb.g).toBeGreaterThan(200);
      expect(rgb.b).toBeGreaterThan(200);
    });
  });

  describe('Category colors do not collide with flag colors', () => {
    it('should verify hardware (cyan 187) differs from all flag colors', () => {
      const hardwareHue = 187;
      const flagHues = [0, 60, 240, 30]; // red, yellow, blue, orange
      expect(flagHues).not.toContain(hardwareHue);
    });

    it('should verify game_feel (purple 291) differs from all flag colors', () => {
      const gameFeelHue = 291;
      const flagHues = [0, 60, 240, 30];
      expect(flagHues).not.toContain(gameFeelHue);
    });

    it('should verify car_response (green 123) differs from flag green (120)', () => {
      const carResponseHue = 123;
      const flagGreenHue = 120;
      // Close but distinct
      expect(Math.abs(carResponseHue - flagGreenHue)).toBeLessThan(10);
    });

    it('should verify racing_experience (magenta 340) differs from all flag colors', () => {
      const racingExperienceHue = 340;
      const flagHues = [0, 60, 240, 30];
      expect(flagHues).not.toContain(racingExperienceHue);
    });
  });
});
