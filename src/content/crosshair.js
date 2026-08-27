// Feature 1 — paint a row and column band through the active cell.

import { DEFAULTS, toRgba } from '../lib/settings.js';
import { createScheduler, intersect, rectsEqual } from './geometry.js';
import * as sheets from './selectors.js';

const ROOT_ID = 'gspp-root';

export function createCrosshair() {
  let settings = { ...DEFAULTS };
  let root = null;
  let rowBand = null;
  let colBand = null;
  let scheduler = null;
  let observedCell = null;

  // Last painted geometry, so update() can bail without touching the DOM.
  let lastRow = null;
  let lastCol = null;

  function mount() {
    if (root && root.isConnected) return;
    root = document.createElement('div');
    root.id = ROOT_ID;
    rowBand = document.createElement('div');
    rowBand.className = 'gspp-band gspp-band-row';
    colBand = document.createElement('div');
    colBand.className = 'gspp-band gspp-band-col';
    root.append(rowBand, colBand);
    // Appended to <body>, not into Sheets' grid: Sheets reconciles its own
    // containers and will delete foreign children.
    document.body.appendChild(root);
    lastRow = null;
    lastCol = null;
    applyStyle();
  }

  function applyStyle() {
    if (!rowBand || !colBand) return;
    const rowColor = toRgba(settings.color, settings.opacity);
    const colColor = toRgba(settings.columnColor || settings.color, settings.opacity);
    rowBand.style.background = rowColor;
    colBand.style.background = colColor;
  }

  function place(band, rect, cache) {
    if (!rect) {
      // Always write this, never guard it on the cache: setSettings() clears the
      // cache to force a repaint, so a cache-guarded hide would leave a band
      // stranded on screen after toggling an axis off.
      band.style.display = 'none';
      return null;
    }
    if (rectsEqual(rect, cache)) return cache; // nothing to write

    band.style.display = 'block';
    // translate3d keeps scroll updates off the layout path.
    band.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    if (!cache || Math.abs(cache.width - rect.width) >= 0.5) {
      band.style.width = `${rect.width}px`;
    }
    if (!cache || Math.abs(cache.height - rect.height) >= 0.5) {
      band.style.height = `${rect.height}px`;
    }
    return rect;
  }

  function hide() {
    if (rowBand) rowBand.style.display = 'none';
    if (colBand) colBand.style.display = 'none';
    lastRow = null;
    lastCol = null;
  }

  function update() {
    if (!settings.enabled || (!settings.rowEnabled && !settings.colEnabled)) {
      hide();
      return;
    }
    if (!root || !root.isConnected) mount();

    // Keep the MutationObserver pointed at the current active-cell element;
    // Sheets replaces it when you switch tabs.
    const cellEl = sheets.activeCellElement();
    if (cellEl !== observedCell) {
      observedCell = cellEl;
      scheduler?.observe(cellEl);
    }

    if (!document.hasFocus() || sheets.isDialogOpen()) {
      hide();
      return;
    }

    const grid = sheets.gridViewportRect();
    const source = settings.rangeMode === 'selection'
      ? (sheets.selectionRect() || sheets.activeCellRect())
      : sheets.activeCellRect();

    if (!grid || !source) {
      hide();
      return;
    }

    // Row band spans the full grid width at the cell's vertical extent;
    // column band spans the full grid height at the cell's horizontal extent.
    // Both clipped to the grid so they never paint over headers or the toolbar.
    const row = settings.rowEnabled
      ? intersect(new DOMRect(grid.left, source.top, grid.width, source.height), grid)
      : null;
    const col = settings.colEnabled
      ? intersect(new DOMRect(source.left, grid.top, source.width, grid.height), grid)
      : null;

    lastRow = place(rowBand, row, lastRow);
    lastCol = place(colBand, col, lastCol);
  }

  return {
    start(initialSettings) {
      settings = { ...DEFAULTS, ...initialSettings };
      mount();
      scheduler = createScheduler(update);
      update();
    },
    setSettings(next) {
      settings = { ...DEFAULTS, ...next };
      applyStyle();
      lastRow = null; // force a repaint with the new geometry/visibility
      lastCol = null;
      update();
    },
    /** Sheet switch or navigation — drop cached elements and re-resolve. */
    refresh() {
      sheets.invalidate();
      observedCell = null;
      lastRow = null;
      lastCol = null;
      update();
    },
    stop() {
      scheduler?.stop();
      scheduler = null;
      root?.remove();
      root = null;
    },
  };
}
