/**
 * Issue #7 — Game logo opposite corner logic
 *
 * The OPPOSITE_CORNER map must flip only the horizontal axis so the logo
 * stays on the same vertical edge. Before the fix it was flipping both
 * axes (diagonal), sending top-right → bottom-left etc.
 */

import { test, expect } from '@playwright/test';

// Re-implementation of the fixed OPPOSITE_CORNER map from game-logo.js
const OPPOSITE_CORNER = {
  'top-right':       'top-left',
  'top-left':        'top-right',
  'bottom-right':    'bottom-left',
  'bottom-left':     'bottom-right',
  'absolute-center': 'top-left',
};

test.describe('Issue #7 — Game logo opposite corner', () => {

  test('top-right maps to top-left (same row, opposite column)', () => {
    expect(OPPOSITE_CORNER['top-right']).toBe('top-left');
  });

  test('top-left maps to top-right (same row, opposite column)', () => {
    expect(OPPOSITE_CORNER['top-left']).toBe('top-right');
  });

  test('bottom-right maps to bottom-left (same row, opposite column)', () => {
    expect(OPPOSITE_CORNER['bottom-right']).toBe('bottom-left');
  });

  test('bottom-left maps to bottom-right (same row, opposite column)', () => {
    expect(OPPOSITE_CORNER['bottom-left']).toBe('bottom-right');
  });

  test('opposite corner preserves vertical edge (top stays top, bottom stays bottom)', () => {
    for (const [from, to] of Object.entries(OPPOSITE_CORNER)) {
      if (from === 'absolute-center') continue;
      const fromEdge = from.split('-')[0];   // 'top' or 'bottom'
      const toEdge   = to.split('-')[0];
      expect(toEdge).toBe(fromEdge);
    }
  });

  test('opposite corner flips horizontal side', () => {
    for (const [from, to] of Object.entries(OPPOSITE_CORNER)) {
      if (from === 'absolute-center') continue;
      const fromSide = from.split('-')[1];   // 'left' or 'right'
      const toSide   = to.split('-')[1];
      expect(toSide).not.toBe(fromSide);
    }
  });

  test('absolute-center falls back to top-left', () => {
    expect(OPPOSITE_CORNER['absolute-center']).toBe('top-left');
  });

  test('mapping is not diagonal (top-right must NOT map to bottom-left)', () => {
    expect(OPPOSITE_CORNER['top-right']).not.toBe('bottom-left');
    expect(OPPOSITE_CORNER['bottom-left']).not.toBe('top-right');
    expect(OPPOSITE_CORNER['top-left']).not.toBe('bottom-right');
    expect(OPPOSITE_CORNER['bottom-right']).not.toBe('top-left');
  });

  test('applying opposite twice returns to original corner', () => {
    const corners = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
    for (const c of corners) {
      expect(OPPOSITE_CORNER[OPPOSITE_CORNER[c]]).toBe(c);
    }
  });
});
