import * as fs from 'fs';
import * as path from 'path';
import { HSBColor } from './types';

/**
 * Local HAP client for VOCOlinc HomeKit bulbs (and other HAP/IP accessories).
 * Uses the `hap-controller` npm package (Apollon77/hap-controller-node).
 *
 * Install dependency on the Pi:
 *   sudo /opt/homebridge/bin/npm install \
 *     --prefix /var/lib/homebridge/node_modules/homebridge-media-coach-lights \
 *     hap-controller
 *
 * Setup flow:
 *   1. Factory-reset the bulb (remove from Apple Home, or hold button)
 *   2. Add it back to Apple Home (to get it on WiFi), then Remove Accessory immediately
 *   3. Add hapIp, hapPort, hapDeviceId, hapPin to this light's config
 *   4. Restart Homebridge — pairing happens automatically on first run
 *   5. Once paired, hapPin can be removed from config
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HttpClientClass: any = null;

function getHttpClient() {
  if (!HttpClientClass) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      HttpClientClass = require('hap-controller').HttpClient;
    } catch {
      throw new Error(
        'hap-controller package not found. Install it with:\n' +
        'sudo /opt/homebridge/bin/npm install ' +
        '--prefix /var/lib/homebridge/node_modules/homebridge-media-coach-lights hap-controller',
      );
    }
  }
  return HttpClientClass;
}

/** Short-form HAP characteristic type UUIDs for a colour bulb */
const CHAR_ON = '25';
const CHAR_HUE = '13';
const CHAR_SATURATION = '2F';
const CHAR_BRIGHTNESS = '8';

interface CharMap {
  on: string;       // "aid.iid" format, e.g. "1.10"
  hue: string;
  saturation: string;
  brightness: string;
}

export class VocolincClient {
  private pairingData: object | null = null;
  private charMap: CharMap | null = null;
  private readonly pairingDataPath: string;
  private lastError: string = '';

  constructor(
    private readonly deviceId: string,
    private readonly ip: string,
    private readonly port: number = 8080,
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
   * One-time pairing with the bulb. Accepts any PIN format (dashes optional).
   * Stores credentials to disk; subsequent restarts load them automatically.
   */
  async pair(pin: string): Promise<void> {
    const digits = pin.replace(/\D/g, '');
    const normalizedPin = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 8)}`;

    const Client = getHttpClient();
    const client = new Client(this.deviceId, this.ip, this.port);
    await client.pairSetup(normalizedPin);

    // getLongTermData() returns the credentials after a successful pairSetup
    this.pairingData = client.getLongTermData();
    fs.mkdirSync(path.dirname(this.pairingDataPath), { recursive: true });
    fs.writeFileSync(this.pairingDataPath, JSON.stringify(this.pairingData, null, 2));

    this.log(`[VOCOlinc ${this.ip}] Paired successfully — credentials saved`);
    await this.discoverCharacteristics();
  }

  /**
   * Drive the bulb color. Fire-and-forget; errors are logged only.
   */
  setColor(color: HSBColor, on: boolean): void {
    if (!this.pairingData || !this.charMap) return;
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
    // Pass pairingData as 4th constructor arg for authenticated requests
    const client = new Client(this.deviceId, this.ip, this.port, this.pairingData);
    const map = this.charMap!;
    const isOn = on && color.brightness > 0;

    const chars: Record<string, unknown> = { [map.on]: isOn };
    if (isOn) {
      chars[map.hue] = color.hue;
      chars[map.saturation] = color.saturation;
      chars[map.brightness] = Math.round(color.brightness);
    }

    await client.setCharacteristics(chars);

    if (this.lastError) {
      this.lastError = '';
      this.log(`[VOCOlinc ${this.ip}] Connection restored`);
    }
  }

  private loadPairingData(): void {
    try {
      if (fs.existsSync(this.pairingDataPath)) {
        this.pairingData = JSON.parse(fs.readFileSync(this.pairingDataPath, 'utf8'));
        this.log(`[VOCOlinc ${this.ip}] Loaded pairing credentials`);
        this.discoverCharacteristics().catch((err: Error) => {
          this.log(`[VOCOlinc ${this.ip}] Characteristic discovery failed: ${err.message}`);
        });
      } else {
        this.log(`[VOCOlinc ${this.ip}] No credentials — will pair on first run if hapPin is set`);
      }
    } catch (err) {
      this.log(`[VOCOlinc ${this.ip}] Failed to load credentials: ${(err as Error).message}`);
    }
  }

  private async discoverCharacteristics(): Promise<void> {
    if (!this.pairingData) return;
    const Client = getHttpClient();
    const client = new Client(this.deviceId, this.ip, this.port, this.pairingData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.getAccessories();

    const map: Partial<CharMap> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const acc of result.accessories ?? []) {
      const aid: number = acc.aid ?? 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const svc of acc.services ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const ch of svc.characteristics ?? []) {
          // Type is a full UUID like "00000025-0000-1000-8000-0026BB765291" — match short prefix
          const type = String(ch.type ?? '').toUpperCase().replace(/^0+/, '').split('-')[0];
          const id = `${aid}.${ch.iid}`;
          if (type === CHAR_ON) map.on = id;
          if (type === CHAR_HUE) map.hue = id;
          if (type === CHAR_SATURATION) map.saturation = id;
          if (type === CHAR_BRIGHTNESS) map.brightness = id;
        }
      }
    }

    if (map.on && map.hue && map.saturation && map.brightness) {
      this.charMap = map as CharMap;
      this.log(`[VOCOlinc ${this.ip}] Ready (on=${map.on} hue=${map.hue} sat=${map.saturation} bri=${map.brightness})`);
    } else {
      this.log(`[VOCOlinc ${this.ip}] Warning: could not map all light characteristics (found: ${JSON.stringify(map)})`);
    }
  }
}
