import * as http from 'http';
import { SimHubState } from './types';

/**
 * HTTP client for SimHub API polling
 * Fetches Media Coach plugin properties via SimHub's built-in HTTP API
 */
export class SimHubClient {
  private baseUrl: string;
  private log: (message: string) => void;
  private lastError: string = '';

  constructor(baseUrl: string, log: (message: string) => void) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.log = log;
  }

  /**
   * Polls SimHub API to get current Media Coach state
   * Returns default state if connection fails or times out
   */
  async getState(): Promise<SimHubState> {
    try {
      const [severity, visible, color, category, flagState, distance] = await Promise.all([
        this.fetchProperty('MediaCoach.Plugin.CommentarySeverity'),
        this.fetchProperty('MediaCoach.Plugin.CommentaryVisible'),
        this.fetchProperty('MediaCoach.Plugin.CommentarySentimentColor'),
        this.fetchProperty('MediaCoach.Plugin.CommentaryCategory'),
        this.fetchProperty('MediaCoach.Plugin.CurrentFlagState'),
        this.fetchProperty('MediaCoach.Plugin.NearestCarDistance'),
      ]);

      const state: SimHubState = {
        commentarySeverity: this.parseNumber(severity, 0),
        commentaryVisible: this.parseNumber(visible, 0) !== 0,
        commentarySentimentColor: this.parseColor(color),
        commentaryCategory: this.parseString(category, ''),
        currentFlagState: this.parseString(flagState, 'none'),
        nearestCarDistance: this.parseNumber(distance, 1.0),
        isConnected: true,
      };

      // Clear error on successful fetch
      if (this.lastError) {
        this.lastError = '';
        this.log('[MediaCoach] SimHub connection restored');
      }

      return state;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (this.lastError !== errorMsg) {
        this.lastError = errorMsg;
        this.log(`[MediaCoach] SimHub connection error: ${errorMsg}`);
      }

      return this.getDefaultState();
    }
  }

  /**
   * Fetches a single property from SimHub API
   * Timeout: 1.5 seconds
   */
  private async fetchProperty(propertyName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/api/pluginproperty/${propertyName}`;

      const timeoutHandle = setTimeout(() => {
        req.destroy();
        reject(new Error(`Timeout fetching ${propertyName}`));
      }, 1500);

      const req = http.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          clearTimeout(timeoutHandle);
          try {
            const json = JSON.parse(data);
            resolve(json.Value !== undefined ? String(json.Value) : '');
          } catch {
            resolve('');
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });
    });
  }

  /**
   * Parse a numeric value with fallback
   */
  private parseNumber(value: string, fallback: number): number {
    try {
      const num = parseFloat(value);
      return isNaN(num) ? fallback : num;
    } catch {
      return fallback;
    }
  }

  /**
   * Parse a string value with fallback
   */
  private parseString(value: string, fallback: string): string {
    return value && typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  /**
   * Parse and normalize color to #AARRGGBB format
   * Handles #RRGGBB and #AARRGGBB inputs
   */
  private parseColor(value: string): string {
    if (!value || typeof value !== 'string') {
      return '#FF000000'; // Default black with full opacity
    }

    const hex = value.trim().toUpperCase();

    // Already 8-digit with alpha
    if (hex.match(/^#[0-9A-F]{8}$/)) {
      return hex;
    }

    // 6-digit RGB, add full alpha
    if (hex.match(/^#[0-9A-F]{6}$/)) {
      return '#FF' + hex.substring(1);
    }

    // Invalid format, default to black
    return '#FF000000';
  }

  /**
   * Returns a safe default state when connection fails
   */
  private getDefaultState(): SimHubState {
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
