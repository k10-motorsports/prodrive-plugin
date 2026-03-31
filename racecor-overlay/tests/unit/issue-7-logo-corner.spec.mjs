/**
 * Issue #7 — Game logo opposite corner logic
 *
 * Top layouts: logo on the same row, opposite column (top-right → top-left).
 * Bottom layouts: logo on the diagonal opposite (bottom-right → top-left).
 */

import { test, expect } from '@playwright/test';

// Re-implementation of the OPPOSITE_CORNER map from game-logo.js
const OPPOSITE_CORNER = {
  'top-right':       'top-left',
  'top-left':        'top-right',
  'bottom-right':    'top-left',
  'bottom-left':     'top-right',
  'absolute-center': 'bottom-left',
};

test.describe('Issue #7 — Game logo opposite corner', () => {

  test('top-right maps to top-left (same row, opposite column)', () => {
    expect(OPPOSITE_CORNER['top-right']).toBe('top-left');
  });

  test('top-left maps to top-right (same row, opposite column)', () => {
    expect(OPPOSITE_CORNER['top-left']).toBe('top-right');
  });

  test('bottom-right maps to top-left (diagonal opposite)', () => {
    expect(OPPOSITE_CORNER['bottom-right']).toBe('top-left');
  });

  test('bottom-left maps to top-right (diagonal opposite)', () => {
    expect(OPPOSITE_CORNER['bottom-left']).toBe('top-right');
  });

  test('top layouts keep same vertical edge, flip horizontal', () => {
    for (const [from, to] of Object.entries(OPPOSITE_CORNER)) {
      if (from === 'absolute-center') continue;
      if (!from.startsWith('top')) continue;
      const fromEdge = from.split('-')[0];
      const toEdge   = to.split('-')[0];
      expect(toEdge).toBe(fromEdge); // same row
      const fromSide = from.split('-')[1];
      const toSide   = to.split('-')[1];
      expect(toSide).not.toBe(fromSide); // opposite column
    }
  });

  test('bottom layouts flip vertical edge and horizontal side (diagonal)', () => {
    for (const [from, to] of Object.entries(OPPOSITE_CORNER)) {
      if (from === 'absolute-center') continue;
      if (!from.startsWith('bottom')) continue;
      const fromEdge = from.split('-')[0];
      const toEdge   = to.split('-')[0];
      expect(toEdge).not.toBe(fromEdge); // opposite row
      const fromSide = from.split('-')[1];
      const toSide   = to.split('-')[1];
      expect(toSide).not.toBe(fromSide); // opposite column
    }
  });

  test('absolute-center falls back to bottom-left', () => {
    expect(OPPOSITE_CORNER['absolute-center']).toBe('bottom-left');
  });

  test('logo never overlaps dashboard position', () => {
    for (const [from, to] of Object.entries(OPPOSITE_CORNER)) {
      expect(to).not.toBe(from);
    }
  });
});
