import * as fs from 'fs';
import * as path from 'path';
import { HSBColor } from './types';

/**
 * Local HAP client for VOCOlinc HomeKit bulbs.
 * Uses the `hap-controller` npm package to pair directly with the bulb over the local network,
 * bypassing Apple Home and HomeKit automation latency.
 *
 * SETUP: The bulb must be factory-reset (not currently paired) before calling pair().
 * After pairing, credentials are stored in storagePath and used on subsequent starts.
 *
 * Install dependency:
 *   npm install hap-controller
 * or on the Pi:
 *   sudo /opt/homebridge/bin/npm install --prefix /var/lib/homebridge/node_modules/homebridge-media-coach-lights hap-controller
 *
 * Configuration example in config.json lights array:
 *   {
 *     "name": "Sim Rig Overhead",
 *     "uniqueId": "media-coach-light-2",
 *     "hapIp": "192.168.1.200",
 *     "hapPort": 80,
 *     "hapPin": "123-45-678",
 *     "hapDeviceId": "AA:BB:CC:DD:EE:FF"
 *   }
 */

// Lazy import: hap-controller is optional (not in peerDependencies)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HttpClient: any = null;
function getHttpClient() {
  if (!HttpClient) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      HttpClient = require('hap-controller').HttpClient;
    } catch {
      throw new Error(
        'hap-controller package not found. Install it with:\n' +
        'sudo /opt/homebridge/bin/npm install --prefix ' +
        '/var/lib/homebridge/node_modules/homebridge-media-coach-lights hap-controller',
      );
    }
  }
  return HttpClient;
}

/** Standard HAP characteristic type UUIDs (short form) for a colour bulb */
const CHAR_ON = '25';
const CHAR_HUE = '13';
const CHAR_SATURATION = '2F';
const CHAR_BRIGHTNESS = '8';

interface PairingData {
  [key: string]: unknown;
}

interface CharMap {
  on: string;
  hue: string;
  saturation: string;
  brightness: string;
}

export class VocolincClient {
  private client: unknown = null;
  private pairingData: PairingData | null = null;
  private charMap: CharMap | null = null;
  private readonly pairingDataPath: string;
  private lastError: string = '';

  constructor(
    private readonly deviceId: string,
    private readonly ip: string,
    private readonly port: number = 80,
    storagePath: string,
    private readonly log: (msg: string) => void,
  ) {
    this.pairingDataPath = path.join(storagePath, `vocolinc-${deviceId.replace(/:/g, '')}.json`);
    this.loadPairingData();
  }

  get isPaired(): boolean {
    return this.pairingData !== null;
  }

  /**
   * One-time pairing. The bulb must be unpaired (factory reset) first.
   * pin format: "XXX-XX-XXX" or "XXXXXXXX"
   */
  async pair(pin: string): Promise<void> {
    const Client = getHttpClient();
    const client = new Client(this.deviceId, this.ip, this.port);
    this.pairingData = await client.pairSetup(pin) as PairingData;
    fs.mkdirSync(path.dirname(this.pairingDataPath), { recursive: true });
    fs.writeFileSync(this.pairingDataPath, JSON.stringify(this.pairingData, null, 2));
    this.client = client;
    await this.discoverCharacteristics();
    this.log(`[VOCOlinc ${this.ip}] Paired successfully — credentials saved to ${this.pairingDataPath}`);
  }

  /**
   * Drive the bulb to match the given color. Fire-and-forget; errors are logged only.
   */
  setColor(color: HSBColor, on: boolean): void {
    if (!this.pairingData || !this.charMap) return;

    // Re-establish session and set characteristics
    this.sendColor(color, on).catch((err: Error) => {
      const msg = err.message;
      if (msg !== this.lastError) {
        this.lastError = msg;
        this.log(`[VOCOlinc ${this.ip}] Error: ${msg}`);
      }
    });
  }

  private async sendColor(color: HSBColor, on: boolean): Promise<void> {
    const Client = getHttpClient();
    const client = this.client ?? new Client(this.deviceId, this.ip, this.port);
    const map = this.charMap!;
    const isOn = on && color.brightness > 0;

    const chars: Record<string, unknown> = { [map.on]: isOn };
    if (isOn) {
      chars[map.hue] = color.hue;
      chars[map.saturation] = color.saturation;
      chars[map.brightness] = color.brightness;
    }

    await client.setCharacteristics(chars, this.pairingData);

    if (this.lastError) {
      this.lastError = '';
      this.log(`[VOCOlinc ${this.ip}] Connection restored`);
    }
  }

  private loadPairingData(): void {
    try {
      if (fs.existsSync(this.pairingDataPath)) {
        this.pairingData = JSON.parse(fs.readFileSync(this.pairingDataPath, 'utf8'));
        const Client = getHttpClient();
        this.client = new Client(this.deviceId, this.ip, this.port);
        this.log(`[VOCOlinc ${this.ip}] Loaded pairing data from ${this.pairingDataPath}`);
        // Discover characteristics on startup
        this.discoverCharacteristics().catch((err: Error) => {
          this.log(`[VOCOlinc ${this.ip}] Could not discover characteristics: ${err.message}`);
        });
      } else {
        this.log(
          `[VOCOlinc ${this.ip}] No pairing data found. ` +
          `Factory-reset the bulb and call pair() with its HomeKit PIN before it can be controlled.`,
        );
      }
    } catch (err) {
      this.log(`[VOCOlinc ${this.ip}] Failed to load pairing data: ${(err as Error).message}`);
    }
  }

  private async discoverCharacteristics(): Promise<void> {
    if (!this.client || !this.pairingData) return;
    const Client = getHttpClient();
    const client = this.client ?? new Client(this.deviceId, this.ip, this.port);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accessories = await (client as any).getAccessories(this.pairingData);

    const map: Partial<CharMap> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const acc of accessories.accessories ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const svc of acc.services ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const ch of svc.characteristics ?? []) {
          const type = String(ch.type ?? '').toUpperCase().replace(/-.*/, '');
          const id = `${svc.iid}.${ch.iid}`;
          if (type === CHAR_ON) map.on = id;
          if (type === CHAR_HUE) map.hue = id;
          if (type === CHAR_SATURATION) map.saturation = id;
          if (type === CHAR_BRIGHTNESS) map.brightness = id;
        }
      }
    }

    if (map.on && map.hue && map.saturation && map.brightness) {
      this.charMap = map as CharMap;
      this.log(`[VOCOlinc ${this.ip}] Characteristics ready`);
    } else {
      this.log(`[VOCOlinc ${this.ip}] Warning: could not find all light characteristics`);
    }
  }
}
