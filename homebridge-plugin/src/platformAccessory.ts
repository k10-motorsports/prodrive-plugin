import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
} from 'homebridge';
import { HSBColor, LightConfig, PlatformAccessoryContext } from './types';

/**
 * Homebridge platform accessory for a single lightbulb
 * Wraps a Lightbulb service with Hue, Saturation, Brightness, and On characteristics
 */
export class MediaCoachLightAccessory {
  private service: Service;
  private currentHue: number = 0;
  private currentSaturation: number = 0;
  private currentBrightness: number = 0;
  private currentOn: boolean = true;

  constructor(
    private readonly platform: any,
    private readonly accessory: PlatformAccessory,
  ) {
    // Get or create Lightbulb service
    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    // Set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Media Coach')
      .setCharacteristic(this.platform.Characteristic.Model, 'SimHub Light Control')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'MC-' + this.accessory.UUID)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '1.0.0');

    // Name characteristic on the Lightbulb service (required by HAP spec)
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.displayName,
    );

    // Register handlers for HomeKit get/set
    this.service
      .getCharacteristic(this.platform.Characteristic.On)!
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.Hue)!
      .onGet(this.handleHueGet.bind(this))
      .onSet(this.handleHueSet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.Saturation)!
      .onGet(this.handleSaturationGet.bind(this))
      .onSet(this.handleSaturationSet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.Brightness)!
      .onGet(this.handleBrightnessGet.bind(this))
      .onSet(this.handleBrightnessSet.bind(this));
  }

  /**
   * Returns this light's config (including per-light mode/blink overrides)
   */
  getLightConfig(): LightConfig {
    return (this.accessory.context as PlatformAccessoryContext).lightConfig;
  }

  /**
   * Updates the light color from the platform's polling loop
   * Called whenever new telemetry arrives
   */
  updateColor(color: HSBColor): void {
    this.currentHue = color.hue;
    this.currentSaturation = color.saturation;
    this.currentBrightness = color.brightness;
    this.currentOn = color.brightness > 0;

    // Update HomeKit characteristics
    this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.currentHue);
    this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.currentSaturation);
    this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.currentBrightness);
    this.service.updateCharacteristic(this.platform.Characteristic.On, this.currentOn);
  }

  /**
   * HomeKit GET handlers - return current cached values
   */
  private handleOnGet(): CharacteristicValue {
    return this.currentOn;
  }

  private handleHueGet(): CharacteristicValue {
    return this.currentHue;
  }

  private handleSaturationGet(): CharacteristicValue {
    return this.currentSaturation;
  }

  private handleBrightnessGet(): CharacteristicValue {
    return this.currentBrightness;
  }

  /**
   * HomeKit SET handlers - user changed light from Apple Home
   * In our plugin, we treat these as read-only from SimHub's perspective,
   * so we can either log these or ignore them.
   * For now, we update our cache to reflect the change.
   */
  private handleOnSet(value: CharacteristicValue): void {
    this.currentOn = Boolean(value);
    this.platform.log.debug(
      `[${this.accessory.displayName}] On set to ${this.currentOn}`,
    );
  }

  private handleHueSet(value: CharacteristicValue): void {
    this.currentHue = value as number;
    this.platform.log.debug(
      `[${this.accessory.displayName}] Hue set to ${this.currentHue}`,
    );
  }

  private handleSaturationSet(value: CharacteristicValue): void {
    this.currentSaturation = value as number;
    this.platform.log.debug(
      `[${this.accessory.displayName}] Saturation set to ${this.currentSaturation}`,
    );
  }

  private handleBrightnessSet(value: CharacteristicValue): void {
    this.currentBrightness = value as number;
    this.currentOn = this.currentBrightness > 0;
    this.platform.log.debug(
      `[${this.accessory.displayName}] Brightness set to ${this.currentBrightness}`,
    );
  }
}
