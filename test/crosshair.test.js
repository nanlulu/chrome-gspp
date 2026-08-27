// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stand in for the live Sheets DOM so band placement can be asserted exactly.
vi.mock('../src/content/selectors.js', () => ({
  activeCellRect: vi.fn(),
  activeCellElement: vi.fn(() => null),
  selectionRect: vi.fn(() => null),
  gridViewportRect: vi.fn(),
  isDialogOpen: vi.fn(() => false),
  invalidate: vi.fn(),
  diagnose: vi.fn(() => ({})),
}));

const { createCrosshair } = await import('../src/content/crosshair.js');
const sheets = await import('../src/content/selectors.js');

const rect = (x, y, w, h) => new DOMRect(x, y, w, h);

// A plausible layout: grid starts at x=48 (row headers) and y=180 (toolbar),
// with the active cell E40 sitting inside it.
const GRID = rect(48, 180, 1392, 600);
const CELL = rect(500, 300, 100, 21);

const rowBand = () => document.querySelector('.gspp-band-row');
const colBand = () => document.querySelector('.gspp-band-col');

const settings = (overrides = {}) => ({
  enabled: true,
  rowEnabled: true,
  colEnabled: true,
  color: '#FFF3C4',
  columnColor: '',
  opacity: 0.22,
  rangeMode: 'active',
  ...overrides,
});

describe('crosshair band placement', () => {
  let crosshair;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    sheets.gridViewportRect.mockReturnValue(GRID);
    sheets.activeCellRect.mockReturnValue(CELL);
    sheets.selectionRect.mockReturnValue(null);
    sheets.isDialogOpen.mockReturnValue(false);
    // jsdom reports the document as unfocused by default.
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    crosshair = createCrosshair();
  });

  it('mounts a single overlay root on body', () => {
    crosshair.start(settings());
    expect(document.querySelectorAll('#gspp-root')).toHaveLength(1);
    expect(document.querySelector('#gspp-root').parentElement).toBe(document.body);
  });

  it('spans the row band across the full grid width at the cell height', () => {
    crosshair.start(settings());
    const band = rowBand();
    expect(band.style.display).toBe('block');
    // x = grid.left, y = cell.top
    expect(band.style.transform).toBe('translate3d(48px, 300px, 0)');
    expect(band.style.width).toBe('1392px');
    expect(band.style.height).toBe('21px');
  });

  it('spans the column band across the full grid height at the cell width', () => {
    crosshair.start(settings());
    const band = colBand();
    // x = cell.left, y = grid.top
    expect(band.style.transform).toBe('translate3d(500px, 180px, 0)');
    expect(band.style.width).toBe('100px');
    expect(band.style.height).toBe('600px');
  });

  it('clips a band when the cell is partly outside the grid', () => {
    // Cell scrolled left, so it starts under the row headers.
    sheets.activeCellRect.mockReturnValue(rect(0, 300, 100, 21));
    crosshair.start(settings());
    // Column band should start at the grid edge, not at x=0.
    expect(colBand().style.transform).toBe('translate3d(48px, 180px, 0)');
    expect(colBand().style.width).toBe('52px'); // 100 - 48 clipped away
  });

  it('hides bands when the cell is scrolled out of the grid entirely', () => {
    sheets.activeCellRect.mockReturnValue(rect(500, 10, 100, 21)); // above the grid
    crosshair.start(settings());
    expect(rowBand().style.display).toBe('none');
  });
});

describe('crosshair toggles', () => {
  let crosshair;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    sheets.gridViewportRect.mockReturnValue(GRID);
    sheets.activeCellRect.mockReturnValue(CELL);
    sheets.selectionRect.mockReturnValue(null);
    sheets.isDialogOpen.mockReturnValue(false);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    crosshair = createCrosshair();
  });

  it('draws only the row band when the column is toggled off', () => {
    crosshair.start(settings({ colEnabled: false }));
    expect(rowBand().style.display).toBe('block');
    expect(colBand().style.display).toBe('none');
  });

  it('draws only the column band when the row is toggled off', () => {
    crosshair.start(settings({ rowEnabled: false }));
    expect(rowBand().style.display).toBe('none');
    expect(colBand().style.display).toBe('block');
  });

  it('hides everything when disabled', () => {
    crosshair.start(settings({ enabled: false }));
    expect(rowBand().style.display).toBe('none');
    expect(colBand().style.display).toBe('none');
  });

  it('applies settings changes live without a restart', () => {
    crosshair.start(settings());
    expect(rowBand().style.display).toBe('block');
    crosshair.setSettings(settings({ rowEnabled: false }));
    expect(rowBand().style.display).toBe('none');
  });

  it('uses the shared color for both bands by default', () => {
    crosshair.start(settings());
    expect(rowBand().style.background).toBe('rgba(255, 243, 196, 0.22)');
    expect(colBand().style.background).toBe('rgba(255, 243, 196, 0.22)');
  });

  it('uses a distinct column color when configured', () => {
    crosshair.start(settings({ columnColor: '#C4E2FF' }));
    expect(rowBand().style.background).toBe('rgba(255, 243, 196, 0.22)');
    expect(colBand().style.background).toBe('rgba(196, 226, 255, 0.22)');
  });
});

describe('crosshair range mode', () => {
  const SELECTION = rect(300, 250, 400, 120); // B2:D6-ish

  let crosshair;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    sheets.gridViewportRect.mockReturnValue(GRID);
    sheets.activeCellRect.mockReturnValue(CELL);
    sheets.selectionRect.mockReturnValue(SELECTION);
    sheets.isDialogOpen.mockReturnValue(false);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    crosshair = createCrosshair();
  });

  it("ignores the selection in 'active' mode", () => {
    crosshair.start(settings({ rangeMode: 'active' }));
    expect(rowBand().style.height).toBe('21px'); // the cell, not the selection
  });

  it("spans the selection in 'selection' mode", () => {
    crosshair.start(settings({ rangeMode: 'selection' }));
    expect(rowBand().style.height).toBe('120px');
    expect(colBand().style.width).toBe('400px');
  });

  it("falls back to the active cell when there is no selection overlay", () => {
    sheets.selectionRect.mockReturnValue(null);
    crosshair.start(settings({ rangeMode: 'selection' }));
    expect(rowBand().style.height).toBe('21px');
  });
});

describe('crosshair hide conditions', () => {
  let crosshair;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    sheets.gridViewportRect.mockReturnValue(GRID);
    sheets.activeCellRect.mockReturnValue(CELL);
    sheets.selectionRect.mockReturnValue(null);
    sheets.isDialogOpen.mockReturnValue(false);
    crosshair = createCrosshair();
  });

  it('hides while a dialog is open', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    sheets.isDialogOpen.mockReturnValue(true);
    crosshair.start(settings());
    expect(rowBand().style.display).toBe('none');
  });

  it('hides when the window is not focused', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    crosshair.start(settings());
    expect(rowBand().style.display).toBe('none');
  });

  it('hides when the sheet has not rendered an active cell yet', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    sheets.activeCellRect.mockReturnValue(null);
    crosshair.start(settings());
    expect(rowBand().style.display).toBe('none');
  });

  it('does not throw when the grid viewport cannot be resolved', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    sheets.gridViewportRect.mockReturnValue(null);
    expect(() => crosshair.start(settings())).not.toThrow();
  });
});
