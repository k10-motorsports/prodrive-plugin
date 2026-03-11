import { SimHubClient } from '../simhubClient';
import { SimHubState } from '../types';
import * as http from 'http';

// Mock the http module
jest.mock('http');

/**
 * Sets up http.get mock to return the given property values in order.
 * Order: severity, visible, color, category, flagState, distance
 */
function setupMockResponses(props: {
  severity: string;
  visible: string;
  color: string;
  category: string;
  flagState: string;
  distance: string;
}): void {
  const mockGet = http.get as jest.MockedFunction<typeof http.get>;
  const responses = [
    { Value: props.severity },
    { Value: props.visible },
    { Value: props.color },
    { Value: props.category },
    { Value: props.flagState },
    { Value: props.distance },
  ];

  let callCount = 0;
  mockGet.mockImplementation((url: any, callback: any) => {
    const response = responses[callCount++];
    const mockRes = {
      on: jest.fn(function (this: any, event: string, handler: Function) {
        if (event === 'data') {
          handler(JSON.stringify(response));
        } else if (event === 'end') {
          handler();
        }
      }),
    };

    setTimeout(() => {
      callback(mockRes as any);
    }, 10);

    return {
      on: jest.fn(),
      destroy: jest.fn(),
    } as any;
  });
}

/**
 * Sets up http.get mock to return raw string responses (for malformed JSON tests).
 */
function setupRawMockResponses(responses: string[]): void {
  const mockGet = http.get as jest.MockedFunction<typeof http.get>;
  let callCount = 0;
  mockGet.mockImplementation((url: any, callback: any) => {
    const response = responses[callCount++];
    const mockRes = {
      on: jest.fn(function (this: any, event: string, handler: Function) {
        if (event === 'data') {
          handler(response);
        } else if (event === 'end') {
          handler();
        }
      }),
    };

    setTimeout(() => {
      callback(mockRes as any);
    }, 10);

    return {
      on: jest.fn(),
      destroy: jest.fn(),
    } as any;
  });
}

/**
 * Sets up http.get mock to immediately fire an error on the request object.
 */
function setupErrorMock(errorMessage: string): void {
  const mockGet = http.get as jest.MockedFunction<typeof http.get>;
  mockGet.mockImplementation((url: any, callback: any) => {
    return {
      on: jest.fn(function (this: any, event: string, handler: Function) {
        if (event === 'error') {
          handler(new Error(errorMessage));
        }
      }),
      destroy: jest.fn(),
    } as any;
  });
}

describe('SimHubClient', () => {
  let mockLog: jest.Mock;
  let client: SimHubClient;

  beforeEach(() => {
    mockLog = jest.fn();
    client = new SimHubClient('http://localhost:8888', mockLog);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should remove trailing slash from URL', () => {
      const clientWithSlash = new SimHubClient(
        'http://localhost:8888/',
        mockLog,
      );
      expect(clientWithSlash).toBeDefined();
    });

    it('should accept URL without trailing slash', () => {
      const clientNoSlash = new SimHubClient(
        'http://localhost:8888',
        mockLog,
      );
      expect(clientNoSlash).toBeDefined();
    });
  });

  describe('parseNumber', () => {
    it('should parse valid numeric strings', async () => {
      setupMockResponses({
        severity: '100',
        visible: '1',
        color: '#FF000000',
        category: '',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentarySeverity).toBe(100);
    });

    it('should return fallback for NaN values', async () => {
      setupMockResponses({
        severity: 'not-a-number',
        visible: '0',
        color: '#FF000000',
        category: '',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentarySeverity).toBe(0); // fallback
    });

    it('should return fallback for empty strings', async () => {
      setupMockResponses({
        severity: '',
        visible: '0',
        color: '#FF000000',
        category: '',
        flagState: 'none',
        distance: '',
      });

      const state = await client.getState();
      expect(state.commentarySeverity).toBe(0); // fallback
      expect(state.nearestCarDistance).toBe(1.0); // fallback for NaN
    });
  });

  describe('parseString', () => {
    it('should trim whitespace from strings', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FF000000',
        category: '  hardware  ',
        flagState: '  yellow  ',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentaryCategory).toBe('hardware');
      expect(state.currentFlagState).toBe('yellow');
    });

    it('should return fallback for empty strings', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FF000000',
        category: '',
        flagState: '',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentaryCategory).toBe('');
      expect(state.currentFlagState).toBe('none');
    });

    it('should return fallback for whitespace-only strings', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FF000000',
        category: '   ',
        flagState: '   ',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentaryCategory).toBe('');
      expect(state.currentFlagState).toBe('none');
    });
  });

  describe('parseColor', () => {
    it('should handle #AARRGGBB format', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FFFF0000',
        category: 'hardware',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentarySentimentColor).toBe('#FFFF0000');
    });

    it('should convert #RRGGBB to #FFRRGGBB', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FF0000',
        category: 'hardware',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentarySentimentColor).toBe('#FFFF0000');
    });

    it('should default to black (#FF000000) for invalid color', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: 'invalid',
        category: 'hardware',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentarySentimentColor).toBe('#FF000000');
    });

    it('should handle empty color string', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '',
        category: 'hardware',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentarySentimentColor).toBe('#FF000000');
    });

    it('should be case-insensitive for hex', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#ffff0000',
        category: 'hardware',
        flagState: 'none',
        distance: '0.5',
      });

      const state1 = await client.getState();

      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FFFF0000',
        category: 'hardware',
        flagState: 'none',
        distance: '0.5',
      });

      const state2 = await client.getState();

      expect(state1.commentarySentimentColor).toBe(state2.commentarySentimentColor);
    });
  });

  describe('getState', () => {
    it('should fetch all properties successfully', async () => {
      setupMockResponses({
        severity: '3',
        visible: '1',
        color: '#FFAABBCC',
        category: 'hardware',
        flagState: 'yellow',
        distance: '0.015',
      });

      const state = await client.getState();

      expect(state.commentarySeverity).toBe(3);
      expect(state.commentaryVisible).toBe(true);
      expect(state.commentarySentimentColor).toBe('#FFAABBCC');
      expect(state.commentaryCategory).toBe('hardware');
      expect(state.currentFlagState).toBe('yellow');
      expect(state.nearestCarDistance).toBe(0.015);
      expect(state.isConnected).toBe(true);
    });

    it('should return default state on connection error', async () => {
      setupErrorMock('Connection refused');

      const state = await client.getState();

      expect(state.commentarySeverity).toBe(0);
      expect(state.commentaryVisible).toBe(false);
      expect(state.commentarySentimentColor).toBe('#FF000000');
      expect(state.commentaryCategory).toBe('');
      expect(state.currentFlagState).toBe('none');
      expect(state.nearestCarDistance).toBe(1.0);
      expect(state.isConnected).toBe(false);
    });

    it('should log error on connection failure', async () => {
      setupErrorMock('Timeout fetching property');

      await client.getState();

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('error'));
    });

    it('should handle timeout gracefully', async () => {
      setupErrorMock('Timeout');

      const state = await client.getState();
      expect(state.isConnected).toBe(false);
    });

    it('should parse numeric strings to numbers', async () => {
      setupMockResponses({
        severity: '5',
        visible: '0',
        color: '#FF000000',
        category: '',
        flagState: 'none',
        distance: '0.25',
      });

      const state = await client.getState();

      expect(state.commentarySeverity).toBe(5);
      expect(typeof state.commentarySeverity).toBe('number');
      expect(state.nearestCarDistance).toBe(0.25);
      expect(typeof state.nearestCarDistance).toBe('number');
    });

    it('should handle malformed JSON response', async () => {
      setupRawMockResponses([
        'invalid json',
        '{ incomplete',
        '{ "Value": "1" }',
        '{ "Value": "" }',
        '{ "Value": "none" }',
        '{ "Value": "0.5" }',
      ]);

      const state = await client.getState();

      // Should fall back to defaults for malformed JSON
      expect(state.commentarySeverity).toBe(0);
      expect(state.isConnected).toBe(true); // Still connected, just failed parsing
    });

    it('should clear error on successful reconnection', async () => {
      // First call: error
      setupErrorMock('Connection refused');

      await client.getState();
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('error'));

      // Second call: success
      mockLog.mockClear();
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FF000000',
        category: '',
        flagState: 'none',
        distance: '0.5',
      });

      await client.getState();

      // Should log reconnection
      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('restored'),
      );
    });
  });

  describe('getDefaultState', () => {
    it('should return safe default state', async () => {
      setupErrorMock('Connection failed');

      const state = await client.getState();

      expect(state).toEqual({
        commentarySeverity: 0,
        commentaryVisible: false,
        commentarySentimentColor: '#FF000000',
        commentaryCategory: '',
        currentFlagState: 'none',
        nearestCarDistance: 1.0,
        isConnected: false,
      });
    });
  });

  describe('API endpoint construction', () => {
    it('should construct correct API URLs', async () => {
      const mockGet = http.get as jest.MockedFunction<typeof http.get>;
      const capturedUrls: string[] = [];

      mockGet.mockImplementation((url: any, callback: any) => {
        capturedUrls.push(String(url));
        return {
          on: jest.fn(function (this: any, event: string, handler: Function) {
            if (event === 'error') {
              handler(new Error('Timeout'));
            }
          }),
          destroy: jest.fn(),
        } as any;
      });

      await client.getState();

      // Verify correct endpoint paths
      expect(capturedUrls.some((url) =>
        url.includes('MediaCoach.Plugin.CommentarySeverity'),
      )).toBe(true);
      expect(capturedUrls.some((url) =>
        url.includes('MediaCoach.Plugin.CommentaryVisible'),
      )).toBe(true);
      expect(capturedUrls.some((url) =>
        url.includes('MediaCoach.Plugin.CommentarySentimentColor'),
      )).toBe(true);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle zero visibility as false', async () => {
      setupMockResponses({
        severity: '0',
        visible: '0',
        color: '#FF000000',
        category: '',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentaryVisible).toBe(false);
    });

    it('should handle non-zero visibility as true', async () => {
      setupMockResponses({
        severity: '0',
        visible: '1',
        color: '#FF000000',
        category: '',
        flagState: 'none',
        distance: '0.5',
      });

      const state = await client.getState();
      expect(state.commentaryVisible).toBe(true);
    });
  });
});
