// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { intersect, rectsEqual } from '../src/content/geometry.js';

const rect = (x, y, w, h) => new DOMRect(x, y, w, h);

describe('intersect', () => {
  it('clips a band to the grid viewport', () => {
    // A row band running the full window width, clipped to a grid that starts
    // below the toolbar and right of the row headers.
    const band = rect(0, 300, 1440, 21);
    const grid = rect(48, 180, 1392, 600);
    const clipped = intersect(band, grid);
    expect(clipped.left).toBe(48);
    expect(clipped.right).toBe(1440);
    expect(clipped.top).toBe(300);
    expect(clipped.height).toBe(21);
  });

  it('clips a column band that extends above the grid', () => {
    const band = rect(500, 0, 100, 900);
    const grid = rect(48, 180, 1392, 600);
    const clipped = intersect(band, grid);
    expect(clipped.top).toBe(180);
    expect(clipped.bottom).toBe(780);
    expect(clipped.left).toBe(500);
    expect(clipped.width).toBe(100);
  });

  it('returns null when the cell is scrolled out of the grid', () => {
    expect(intersect(rect(0, 50, 1440, 21), rect(48, 180, 1392, 600))).toBeNull();
  });

  it('returns null for edge-only contact', () => {
    expect(intersect(rect(0, 0, 100, 100), rect(100, 0, 100, 100))).toBeNull();
  });

  it('returns null when either rect is missing', () => {
    expect(intersect(null, rect(0, 0, 10, 10))).toBeNull();
    expect(intersect(rect(0, 0, 10, 10), null)).toBeNull();
  });
});

describe('rectsEqual', () => {
  it('treats sub-pixel differences as equal', () => {
    // Guards the no-op fast path: scrolling often nudges rects by <0.5px and
    // must not trigger a repaint.
    expect(rectsEqual(rect(10, 10, 100, 20), rect(10.2, 10.1, 100.3, 20.2))).toBe(true);
  });

  it('detects a real move', () => {
    expect(rectsEqual(rect(10, 10, 100, 20), rect(10, 31, 100, 20))).toBe(false);
  });

  it('detects a size change', () => {
    expect(rectsEqual(rect(10, 10, 100, 20), rect(10, 10, 100, 42))).toBe(false);
  });

  it('handles nulls', () => {
    expect(rectsEqual(null, null)).toBe(true);
    expect(rectsEqual(null, rect(0, 0, 1, 1))).toBe(false);
  });
});
