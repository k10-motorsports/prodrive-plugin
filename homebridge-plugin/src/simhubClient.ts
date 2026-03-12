import * as http from 'http';
import { SimHubState } from './types';

/**
 * HTTP client for Media Coach state endpoint.
 *
 * The SimHub plugin exposes a lightweight JSON REST endpoint on port 8889:
 *   GET http://<host>:8889/mediacoach/
 * This is served by System.Net.HttpListener inside Plugin.cs and bypasses
 * SimHub's web server (which does not expose plugin properties via REST in 9.x).
 */
export class SimHubClient {
  private stateUrl: string;
  private log: (message: string) => void;
  private lastError: string = '';

  constructor(baseUrl: string, log: (message: string) => void) {
    // baseUrl is e.g. "http://playbox.local:8888" — we replace port 8888 with 8889
    // and use the /mediacoach/ path served by the plugin's own HttpListener.
    const host = baseUrl.replace(/:\d+$/, '');
    this.stateUrl = `${host}:8889/mediacoach/`;
    this.log = log;
  }

  async getState(): Promise<SimHubState> {
    try {
      const raw = await this.fetchJson(this.stateUrl);
      const state: SimHubState = {
        commentarySeverity: this.num(raw.commentarySeverity, 0),
        commentaryVisible: raw.commentaryVisible === true,
        commentarySentimentColor: this.color(raw.commentarySentimentColor),
        commentaryCategory: this.str(raw.commentaryCategory, ''),
        currentFlagState: this.str(raw.currentFlagState, 'none'),
        nearestCarDistance: this.num(raw.nearestCarDistance, 1.0),
        isConnected: true,
      };

      if (this.lastError) {
        this.lastError = '';
        this.log('[MediaCoach] SimHub connection restored');
      }

      return state;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (this.lastError !== msg) {
        this.lastError = msg;
        this.log(`[MediaCoach] SimHub connection error: ${msg}`);
      }
      return this.defaultState();
    }
  }

  private fetchJson(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('Timeout'));
      }, 1500);

      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try { resolve(JSON.parse(data) as Record<string, unknown>); }
          catch { reject(new Error('Invalid JSON')); }
        });
      });

      req.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
  }

  private num(v: unknown, fallback: number): number {
    const n = parseFloat(String(v));
    return isNaN(n) ? fallback : n;
  }

  private str(v: unknown, fallback: string): string {
    return v && typeof v === 'string' && v.trim() ? v.trim() : fallback;
  }

  private color(v: unknown): string {
    if (!v || typeof v !== 'string') return '#FF000000';
    const hex = v.trim().toUpperCase();
    if (hex.match(/^#[0-9A-F]{8}$/)) return hex;
    if (hex.match(/^#[0-9A-F]{6}$/)) return '#FF' + hex.substring(1);
    return '#FF000000';
  }

  private defaultState(): SimHubState {
    return {
      commentarySeverity: 0,
      commentaryVisible: false,
      commentarySentimentColor: '#FF000000',
      commentaryCategory: '',
      currentFlagState: 'none',
      nearestCarDistance: 1.0,
      isConnected: false,
    };
  }
}
