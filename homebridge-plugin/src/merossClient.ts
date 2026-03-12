import * as http from 'http';
import * as crypto from 'crypto';
import { HSBColor } from './types';

/**
 * Local HTTP client for Meross smart lights (e.g. MSL320 light strip)
 * Uses Meross's local JSON-over-HTTP protocol on port 80 — no cloud required.
 *
 * Protocol:
 *   POST http://<ip>/config
 *   Body: { header: { namespace, method, messageId, sign, timestamp }, payload: { ... } }
 *   sign = MD5(messageId + key + timestamp)  (key = "" for unconfigured devices)
 */
export class MerossClient {
  private lastError: string = '';

  constructor(
    private readonly ip: string,
    private readonly port: number = 80,
    private readonly key: string = '',
    private readonly log: (msg: string) => void,
  ) {}

  /**
   * Set the light color. Fire-and-forget; errors are logged but not thrown.
   */
  setColor(color: HSBColor, on: boolean): void {
    const rgb = on && color.brightness > 0 ? hsbToRgbInt(color.hue, color.saturation, color.brightness) : 0;
    const luminance = on ? Math.round(color.brightness) : 0;

    this.sendCommand('SET', 'Appliance.Control.Light', {
      light: { channel: 0, rgb, luminance, capacity: 6 },
    }).then(() => {
      if (this.lastError) {
        this.lastError = '';
        this.log(`[Meross ${this.ip}] Connection restored`);
      }
    }).catch((err: Error) => {
      const msg = err.message;
      if (msg !== this.lastError) {
        this.lastError = msg;
        this.log(`[Meross ${this.ip}] Error: ${msg}`);
      }
    });
  }

  private sendCommand(method: string, namespace: string, payload: object): Promise<void> {
    const messageId = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = crypto.createHash('md5').update(messageId + this.key + timestamp).digest('hex');

    const body = JSON.stringify({
      header: { from: '', messageId, method, namespace, payloadVersion: 1, sign, timestamp, triggerSrc: 'iOS' },
      payload,
    });

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: this.ip,
          port: this.port,
          path: '/config',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume(); // drain and discard response body
          resolve();
        },
      );

      req.setTimeout(2000, () => {
        req.destroy();
        reject(new Error('timeout'));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

/**
 * Convert HSB (HomeKit ranges: h=0-360, s=0-100, b=0-100) to a packed 24-bit RGB integer
 * as expected by the Meross light API.
 */
function hsbToRgbInt(h: number, s: number, b: number): number {
  const hf = h / 360;
  const sf = s / 100;
  const bf = b / 100;

  let r: number, g: number, bl: number;

  if (sf === 0) {
    r = g = bl = bf;
  } else {
    const i = Math.floor(hf * 6);
    const f = hf * 6 - i;
    const p = bf * (1 - sf);
    const q = bf * (1 - f * sf);
    const t = bf * (1 - (1 - f) * sf);

    switch (i % 6) {
      case 0: r = bf; g = t; bl = p; break;
      case 1: r = q; g = bf; bl = p; break;
      case 2: r = p; g = bf; bl = t; break;
      case 3: r = p; g = q; bl = bf; break;
      case 4: r = t; g = p; bl = bf; break;
      default: r = bf; g = p; bl = q; break;
    }
  }

  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(bl * 255);
}
