import {
  DynamicPlatformPlugin,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
  Logger,
  API,
} from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { MediaCoachLightAccessory } from './platformAccessory';
import { SimHubClient } from './simhubClient';
import { MerossClient } from './merossClient';
import { VocolincClient } from './vocolincClient';
import { FlagSensorAccessory, FLAG_SENSOR_NAMES, FlagSensorName } from './flagSensorAccessory';
import { ColorMapper } from './colorMapper';
import {
  SimHubState,
  LightMode,
  PluginConfig,
  PlatformAccessoryContext,
} from './types';

/**
 * Media Coach Homebridge Platform Plugin
 * Polls SimHub HTTP API and maps telemetry to HomeKit light colors
 */
export class MediaCoachLightsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // Track accessories
  public readonly accessories: PlatformAccessory[] = [];
  private lightAccessories: Map<string, MediaCoachLightAccessory> = new Map();
  private merossClients: Map<string, MerossClient> = new Map();
  private vocolincClients: Map<string, VocolincClient> = new Map();
  private flagSensors: Map<FlagSensorName, FlagSensorAccessory> = new Map();

  // Configuration and clients
  private config: PluginConfig;
  private simhubClient: SimHubClient;
  private pollingInterval: NodeJS.Timeout | null = null;

  // State cache
  private currentState: SimHubState | null = null;
  private blinkActive: boolean = false;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.info('Initializing Media Coach Lights platform');

    // Parse and validate configuration
    this.config = this.parseConfig(config as unknown as PluginConfig);

    // Initialize SimHub client
    this.simhubClient = new SimHubClient(
      this.config.simhubUrl,
      (msg: string) => this.log.debug(msg),
    );

    // Listen for accessory restoration
    this.api.on('didFinishLaunching', () => {
      this.discoverAccessories();
    });

    this.api.on('shutdown', () => {
      this.stopPolling();
    });
  }

  /**
   * Parse and validate plugin configuration
   */
  private parseConfig(config: PluginConfig): PluginConfig {
    return {
      simhubUrl: config.simhubUrl || 'http://localhost:8888',
      pollIntervalMs: Math.max(100, config.pollIntervalMs || 500),
      mode: (config.mode || 'all_colors') as LightMode,
      enableBlink: config.enableBlink !== false,
      ambientColor: config.ambientColor || {
        hue: 120,
        saturation: 50,
        brightness: 30,
      },
      lights: config.lights || [{ name: 'Media Coach', uniqueId: 'media-coach-light-1' }],
      enableFlagSensors: config.enableFlagSensors !== false,
    };
  }

  /**
   * Called by Homebridge to discover and restore accessories
   */
  discoverAccessories(): void {
    this.log.info('Discovering Media Coach light accessories');

    for (const lightConfig of this.config.lights) {
      const uuid = this.api.hap.uuid.generate(lightConfig.uniqueId);
      let accessory = this.accessories.find((acc) => acc.UUID === uuid);

      if (!accessory) {
        // Create new accessory
        accessory = new this.api.platformAccessory(
          lightConfig.name,
          uuid,
          this.api.hap.Categories.LIGHTBULB,
        );
        accessory.context = { lightConfig } as PlatformAccessoryContext;
        this.accessories.push(accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log.info(`Registered accessory: ${lightConfig.name}`);
      } else {
        this.log.info(`Restored accessory: ${lightConfig.name}`);
      }

      // Create the light accessory handler and store reference
      const lightAccessory = new MediaCoachLightAccessory(this, accessory);
      this.lightAccessories.set(uuid, lightAccessory);

      // Create Meross client if this light has a local Meross device configured
      if (lightConfig.merossIp) {
        const meross = new MerossClient(
          lightConfig.merossIp,
          lightConfig.merossPort ?? 80,
          lightConfig.merossKey ?? '',
          (msg: string) => this.log.debug(msg),
        );
        this.merossClients.set(uuid, meross);
        this.log.info(`Meross local control enabled for ${lightConfig.name} (${lightConfig.merossIp})`);
      }

      // Create VOCOlinc HAP client if this light has a local HAP device configured
      if (lightConfig.hapIp && lightConfig.hapDeviceId) {
        const vocolinc = new VocolincClient(
          lightConfig.hapDeviceId,
          lightConfig.hapIp,
          lightConfig.hapPort ?? 80,
          this.api.user.storagePath(),
          (msg: string) => this.log.debug(msg),
        );
        this.vocolincClients.set(uuid, vocolinc);
        this.log.info(`VOCOlinc HAP control enabled for ${lightConfig.name} (${lightConfig.hapIp})`);

        // Auto-pair on first run if PIN is provided and no credentials are stored yet
        if (!vocolinc.isPaired && lightConfig.hapPin) {
          this.log.info(`[VOCOlinc ${lightConfig.hapIp}] No pairing data found — pairing now with PIN ${lightConfig.hapPin}`);
          vocolinc.pair(lightConfig.hapPin).catch((err: Error) => {
            this.log.error(`[VOCOlinc ${lightConfig.hapIp}] Pairing failed: ${err.message}`);
          });
        }
      }
    }

    // Register flag sensor accessories if enabled
    if (this.config.enableFlagSensors) {
      this.discoverFlagSensors();
    }

    // Start polling loop
    this.startPolling();
  }

  /**
   * Register one OccupancySensor per flag so Apple Home automations can trigger on flag changes.
   * Sensors are named "<first light name> - <Flag> Flag", e.g. "Sim Rig Light - Yellow Flag"
   */
  private discoverFlagSensors(): void {
    const baseName = this.config.lights[0]?.name ?? 'Media Coach';

    for (const flagName of FLAG_SENSOR_NAMES) {
      const displayName = `${baseName} - ${flagName.charAt(0).toUpperCase() + flagName.slice(1)} Flag`;
      const uuid = this.api.hap.uuid.generate(`media-coach-flag-sensor-${flagName}`);
      let accessory = this.accessories.find((acc) => acc.UUID === uuid);

      if (!accessory) {
        accessory = new this.api.platformAccessory(
          displayName,
          uuid,
          this.api.hap.Categories.SENSOR,
        );
        accessory.context = { flagSensor: flagName };
        this.accessories.push(accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log.info(`Registered flag sensor: ${displayName}`);
      } else {
        this.log.info(`Restored flag sensor: ${displayName}`);
      }

      this.flagSensors.set(flagName, new FlagSensorAccessory(this, accessory, flagName));
    }
  }

  /**
   * Called when HomeKit removes an accessory
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.debug(`Configuring accessory: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  /**
   * Start the main polling loop
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      return; // Already running
    }

    this.log.info(
      `Starting SimHub polling (interval: ${this.config.pollIntervalMs}ms)`,
    );

    this.pollingInterval = setInterval(() => {
      this.pollTick();
    }, this.config.pollIntervalMs);

    // Do an immediate poll
    this.pollTick();
  }

  /**
   * Stop the polling loop
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.log.info('Stopped SimHub polling');
    }
  }

  /**
   * Single polling tick: fetch state, determine color, update accessories
   */
  private async pollTick(): Promise<void> {
    try {
      // Fetch current state from SimHub
      const state = await this.simhubClient.getState();
      this.currentState = state;

      // Update each accessory using its own mode/blink settings (or global fallback)
      for (const [uuid, lightAccessory] of this.lightAccessories) {
        const lightConfig = lightAccessory.getLightConfig();
        const lightMode = lightConfig.mode || this.config.mode;
        const lightBlink = lightConfig.enableBlink !== undefined
          ? lightConfig.enableBlink
          : this.config.enableBlink;

        // Determine target color based on this light's mode
        const targetColor = ColorMapper.resolveColor(state, lightMode);

        // Apply blink effect if enabled for this light
        const blinkConfig = lightBlink
          ? ColorMapper.getBlinkConfig(state, lightMode)
          : null;

        let finalColor = targetColor;

        if (blinkConfig && blinkConfig.enabled) {
          const now = Date.now();
          const cycleMs = 1000 / blinkConfig.frequency;
          const phase = (now % cycleMs) / cycleMs;

          if (phase >= 0.5) {
            finalColor = {
              ...targetColor,
              brightness: Math.max(0, targetColor.brightness - 50),
            };
          }
        }

        lightAccessory.updateColor(finalColor);

        // Drive Meross device directly if configured for this light
        const merossClient = this.merossClients.get(uuid);
        if (merossClient) {
          merossClient.setColor(finalColor, finalColor.brightness > 0);
        }

        // Drive VOCOlinc HAP device directly if configured for this light
        const vocolincClient = this.vocolincClients.get(uuid);
        if (vocolincClient) {
          vocolincClient.setColor(finalColor, finalColor.brightness > 0);
        }
      }

      // Update flag sensors
      if (this.flagSensors.size > 0) {
        const activeFlag = state.currentFlagState as FlagSensorName;
        for (const [flagName, sensor] of this.flagSensors) {
          sensor.updateState(flagName === activeFlag);
        }
      }
    } catch (error) {
      this.log.warn(
        `Error during polling tick: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
