import { Service, PlatformAccessory } from 'homebridge';

/**
 * HomeKit OccupancySensor accessory representing a single race flag state.
 * When the flag is active, the sensor reports "detected".
 * This lets Apple Home automations trigger real lights, scenes, etc. per flag.
 *
 * Example: "When Yellow Flag sensor is detected → set living room lights to yellow"
 */
export class FlagSensorAccessory {
  private service: Service;
  private detected: boolean = false;

  constructor(
    private readonly platform: any,
    private readonly accessory: PlatformAccessory,
    public readonly flagName: string,
  ) {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Media Coach')
      .setCharacteristic(this.platform.Characteristic.Model, 'Flag Sensor')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'FLAG-' + this.accessory.UUID)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, '1.0.0');

    this.service =
      this.accessory.getService(this.platform.Service.OccupancySensor) ||
      this.accessory.addService(this.platform.Service.OccupancySensor);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.displayName,
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.OccupancyDetected)!
      .onGet(() => this.detected
        ? this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
        : this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
  }

  updateState(active: boolean): void {
    if (active === this.detected) return;
    this.detected = active;
    this.service.updateCharacteristic(
      this.platform.Characteristic.OccupancyDetected,
      this.detected
        ? this.platform.Characteristic.OccupancyDetected.OCCUPANCY_DETECTED
        : this.platform.Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED,
    );
  }
}

/** Flag names that get individual sensor accessories */
export const FLAG_SENSOR_NAMES = ['green', 'yellow', 'red', 'black', 'white', 'blue', 'debris'] as const;
export type FlagSensorName = typeof FLAG_SENSOR_NAMES[number];
