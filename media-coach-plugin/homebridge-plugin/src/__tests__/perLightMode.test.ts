import { ColorMapper } from '../colorMapper';
import { SimHubState, LightConfig, LightMode } from '../types';

/**
 * Tests for per-light mode override logic
 * Validates that individual lights can override global mode settings
 */
describe('Per-Light Mode Overrides', () => {
  const baseState: SimHubState = {
    commentarySeverity: 0,
    commentaryVisible: false,
    commentarySentimentColor: '#FF000000',
    commentaryCategory: '',
    currentFlagState: 'yellow',
    nearestCarDistance: 0.015,
    isConnected: true,
  };

  describe('Mode resolution', () => {
    it('should use light mode when override is provided', () => {
      const globalMode: LightMode = 'all_colors';
      const lightMode: LightMode = 'flags_only';

      const resolvedMode = lightMode || globalMode;
      expect(resolvedMode).toBe('flags_only');
    });

    it('should fall back to global mode when override is undefined', () => {
      const globalMode: LightMode = 'all_colors';
      const lightMode: LightMode | undefined = undefined;

      const resolvedMode = lightMode || globalMode;
      expect(resolvedMode).toBe('all_colors');
    });

    it('should respect explicit events_only override', () => {
      const globalMode: LightMode = 'all_colors';
      const lightMode: LightMode | undefined = 'events_only';

      const resolvedMode = lightMode || globalMode;
      expect(resolvedMode).toBe('events_only');
    });
  });

  describe('Mode-specific behavior with overrides', () => {
    describe('Light with flags_only override in all_colors global', () => {
      it('should show yellow flag when flag is active', () => {
        const globalMode: LightMode = 'all_colors';
        const lightMode: LightMode = 'flags_only';
        const resolvedMode = lightMode || globalMode;

        const state: SimHubState = { ...baseState, currentFlagState: 'yellow' };
        const color = ColorMapper.resolveColor(state, resolvedMode);

        expect(color).toEqual({ hue: 60, saturation: 100, brightness: 100 });
      });

      it('should ignore commentary when in flags_only mode', () => {
        const globalMode: LightMode = 'all_colors';
        const lightMode: LightMode = 'flags_only';
        const resolvedMode = lightMode || globalMode;

        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          commentaryVisible: true,
          commentarySeverity: 5,
          commentaryCategory: 'hardware',
        };

        const color = ColorMapper.resolveColor(state, resolvedMode);

        // Should show ambient, not category color
        expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
      });
    });

    describe('Light with events_only override in all_colors global', () => {
      it('should ignore flags and show proximity', () => {
        const globalMode: LightMode = 'all_colors';
        const lightMode: LightMode = 'events_only';
        const resolvedMode = lightMode || globalMode;

        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'red',
          nearestCarDistance: 0.5,
        };

        const color = ColorMapper.resolveColor(state, resolvedMode);

        // Should show ambient green (far proximity), not red flag
        expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 });
      });

      it('should show red when cars are close', () => {
        const globalMode: LightMode = 'all_colors';
        const lightMode: LightMode = 'events_only';
        const resolvedMode = lightMode || globalMode;

        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'green',
          nearestCarDistance: 0.005,
        };

        const color = ColorMapper.resolveColor(state, resolvedMode);

        // Should show proximity red
        expect(color).toEqual({ hue: 0, saturation: 100, brightness: 100 });
      });
    });

    describe('Light with no override inherits global mode', () => {
      it('should use global all_colors when no override set', () => {
        const globalMode: LightMode = 'all_colors';
        const lightMode: LightMode | undefined = undefined;
        const resolvedMode = lightMode || globalMode;

        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'none',
          commentaryVisible: true,
          commentarySeverity: 3,
          commentaryCategory: 'hardware',
        };

        const color = ColorMapper.resolveColor(state, resolvedMode);

        // Should show category color due to all_colors mode
        expect(color.hue).toBe(187); // Cyan
      });

      it('should use global flags_only when no override set', () => {
        const globalMode: LightMode = 'flags_only';
        const lightMode: LightMode | undefined = undefined;
        const resolvedMode = lightMode || globalMode;

        const state: SimHubState = {
          ...baseState,
          currentFlagState: 'yellow',
          commentaryVisible: true,
          commentarySeverity: 5,
        };

        const color = ColorMapper.resolveColor(state, resolvedMode);

        // Should show flag
        expect(color).toEqual({ hue: 60, saturation: 100, brightness: 100 });
      });
    });
  });

  describe('Blink override logic', () => {
    it('should determine blink based on light setting', () => {
      const globalBlink = false;
      const lightBlink = true;
      const resolvedBlink =
        lightBlink !== undefined ? lightBlink : globalBlink;

      expect(resolvedBlink).toBe(true);
    });

    it('should fall back to global blink when undefined', () => {
      const globalBlink = true;
      const lightBlink = undefined;
      const resolvedBlink =
        lightBlink !== undefined ? lightBlink : globalBlink;

      expect(resolvedBlink).toBe(true);
    });

    it('should disable blink when light override is false', () => {
      const globalBlink = true;
      const lightBlink = false;
      const resolvedBlink =
        lightBlink !== undefined ? lightBlink : globalBlink;

      expect(resolvedBlink).toBe(false);
    });

    it('should enable blink when light override is true', () => {
      const globalBlink = false;
      const lightBlink = true;
      const resolvedBlink =
        lightBlink !== undefined ? lightBlink : globalBlink;

      expect(resolvedBlink).toBe(true);
    });
  });

  describe('Multiple lights with different overrides', () => {
    it('should apply different modes to different lights', () => {
      const state: SimHubState = {
        ...baseState,
        currentFlagState: 'red',
        commentaryVisible: true,
        commentarySeverity: 4,
        commentaryCategory: 'hardware',
        nearestCarDistance: 0.005,
      };

      // Light 1: flags_only
      const light1Mode: LightMode = 'flags_only';
      const light1Color = ColorMapper.resolveColor(state, light1Mode);
      expect(light1Color).toEqual({ hue: 0, saturation: 100, brightness: 100 }); // Red flag

      // Light 2: events_only
      const light2Mode: LightMode = 'events_only';
      const light2Color = ColorMapper.resolveColor(state, light2Mode);
      expect(light2Color).toEqual({ hue: 0, saturation: 100, brightness: 100 }); // Proximity red

      // Light 3: all_colors
      const light3Mode: LightMode = 'all_colors';
      const light3Color = ColorMapper.resolveColor(state, light3Mode);
      expect(light3Color).toEqual({ hue: 0, saturation: 100, brightness: 100 }); // Red flag

      // All should show red but for different reasons
      expect(light1Color).toEqual(light2Color);
      expect(light1Color).toEqual(light3Color);
    });

    it('should apply different blink settings to different lights', () => {
      const state: SimHubState = { ...baseState, currentFlagState: 'yellow' };
      const mode: LightMode = 'all_colors';

      // Light 1: blink enabled
      const light1Blink = ColorMapper.getBlinkConfig(state, mode);
      expect(light1Blink).not.toBeNull();
      expect(light1Blink?.frequency).toBe(1.0);

      // Light 2 would have blink disabled (tested separately)
      // but the blink config is the same from ColorMapper's perspective
    });
  });

  describe('Mode override patterns', () => {
    it('should handle light config structure correctly', () => {
      const lightConfig1: LightConfig = {
        name: 'Light 1',
        uniqueId: 'light-1',
        mode: 'flags_only',
      };

      const lightConfig2: LightConfig = {
        name: 'Light 2',
        uniqueId: 'light-2',
        // No mode override
      };

      expect(lightConfig1.mode).toBe('flags_only');
      expect(lightConfig2.mode).toBeUndefined();
    });

    it('should handle blink override in light config', () => {
      const lightConfig1: LightConfig = {
        name: 'Light 1',
        uniqueId: 'light-1',
        enableBlink: false,
      };

      const lightConfig2: LightConfig = {
        name: 'Light 2',
        uniqueId: 'light-2',
        // No blink override
      };

      expect(lightConfig1.enableBlink).toBe(false);
      expect(lightConfig2.enableBlink).toBeUndefined();
    });

    it('should support both mode and blink overrides', () => {
      const lightConfig: LightConfig = {
        name: 'Custom Light',
        uniqueId: 'custom-light',
        mode: 'events_only',
        enableBlink: false,
      };

      expect(lightConfig.mode).toBe('events_only');
      expect(lightConfig.enableBlink).toBe(false);
    });
  });

  describe('Mode override edge cases', () => {
    it('should handle green flag differently in all_colors vs flags_only', () => {
      const state: SimHubState = {
        ...baseState,
        currentFlagState: 'green',
        commentaryVisible: true,
        commentarySeverity: 3,
        commentaryCategory: 'game_feel',
      };

      // In flags_only: green flag should be shown
      const flagsOnlyColor = ColorMapper.resolveColor(state, 'flags_only');
      expect(flagsOnlyColor).toEqual({
        hue: 120,
        saturation: 100,
        brightness: 80,
      }); // Green flag

      // In all_colors: green flag falls through to commentary
      const allColorsColor = ColorMapper.resolveColor(state, 'all_colors');
      expect(allColorsColor.hue).toBe(291); // Purple (game_feel)
    });

    it('should handle absence of commentary in all_colors mode', () => {
      const state: SimHubState = {
        ...baseState,
        currentFlagState: 'none',
        commentaryVisible: false,
        nearestCarDistance: 0.5,
      };

      const color = ColorMapper.resolveColor(state, 'all_colors');
      expect(color).toEqual({ hue: 120, saturation: 50, brightness: 30 }); // Ambient
    });

    it('should prioritize yellow flag over all in all_colors', () => {
      const state: SimHubState = {
        ...baseState,
        currentFlagState: 'yellow',
        commentaryVisible: true,
        commentarySeverity: 5,
        commentaryCategory: 'hardware',
      };

      const color = ColorMapper.resolveColor(state, 'all_colors');
      expect(color).toEqual({ hue: 60, saturation: 100, brightness: 100 }); // Yellow flag
    });
  });

  describe('Light mode override composition', () => {
    it('should compose mode and blink overrides independently', () => {
      const globalConfig = {
        mode: 'all_colors' as LightMode,
        enableBlink: true,
      };

      const light1 = {
        mode: 'flags_only' as LightMode | undefined,
        enableBlink: undefined,
      };

      const light1Mode = light1.mode || globalConfig.mode;
      const light1Blink =
        light1.enableBlink !== undefined
          ? light1.enableBlink
          : globalConfig.enableBlink;

      expect(light1Mode).toBe('flags_only');
      expect(light1Blink).toBe(true);
    });

    it('should allow partial overrides', () => {
      const globalConfig = {
        mode: 'all_colors' as LightMode,
        enableBlink: true,
      };

      const light = {
        mode: undefined, // No override
        enableBlink: false, // Override blink
      };

      const lightMode = light.mode || globalConfig.mode;
      const lightBlink =
        light.enableBlink !== undefined
          ? light.enableBlink
          : globalConfig.enableBlink;

      expect(lightMode).toBe('all_colors'); // Global
      expect(lightBlink).toBe(false); // Light override
    });
  });

  describe('Real-world scenario: multi-light setup', () => {
    it('should handle 3 lights with different modes in same poll', () => {
      const state: SimHubState = {
        commentarySeverity: 4,
        commentaryVisible: true,
        commentarySentimentColor: '#FFBB47BC',
        commentaryCategory: 'game_feel',
        currentFlagState: 'yellow',
        nearestCarDistance: 0.01,
        isConnected: true,
      };

      // Light 1: Pit light - flags_only
      const pit = { mode: 'flags_only' as const };
      const pitColor = ColorMapper.resolveColor(
        state,
        pit.mode || 'all_colors',
      );
      expect(pitColor).toEqual({ hue: 60, saturation: 100, brightness: 100 }); // Yellow

      // Light 2: Proximity light - events_only
      const proximity = { mode: 'events_only' as const };
      const proximityColor = ColorMapper.resolveColor(
        state,
        proximity.mode || 'all_colors',
      );
      expect(proximityColor).toEqual({ hue: 30, saturation: 100, brightness: 90 }); // Orange

      // Light 3: Main light - all_colors
      const main = { mode: 'all_colors' as const };
      const mainColor = ColorMapper.resolveColor(
        state,
        main.mode || 'all_colors',
      );
      expect(mainColor).toEqual({ hue: 60, saturation: 100, brightness: 100 }); // Yellow flag
    });

    it('should handle blink overrides per light', () => {
      const state: SimHubState = {
        ...baseState,
        currentFlagState: 'red',
      };

      // Light 1: Blink enabled
      const light1Blink = true;
      const light1Config = ColorMapper.getBlinkConfig(
        state,
        'all_colors',
      );
      expect(light1Blink && light1Config).not.toBeNull();

      // Light 2: Blink disabled
      const light2Blink = false;
      const light2BlinkResult = light2Blink
        ? ColorMapper.getBlinkConfig(state, 'all_colors')
        : null;
      expect(light2BlinkResult).toBeNull();
    });
  });
});
