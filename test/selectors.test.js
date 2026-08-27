// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  formulaBar,
  gidForSheetName,
  invalidate,
  isEditing,
  sheetTabs,
  tabElementForName,
  unionRects,
} from '../src/content/selectors.js';

const rect = (x, y, w, h) => new DOMRect(x, y, w, h);

/** jsdom has no layout, so hand elements the geometry the code reads. */
function withRect(el, r) {
  el.getBoundingClientRect = () => r;
  return el;
}

describe('unionRects', () => {
  it('reconstructs a cell box from four 1px edge divs', () => {
    // Sheets draws the active-cell outline as four separate edge divs. Reading
    // only the first yields the top edge — full width, ~1px tall — which
    // rendered the row band as a hairline.
    const cell = { x: 890, y: 532, w: 200, h: 42 };
    const edges = [
      rect(cell.x, cell.y, cell.w, 2), // top
      rect(cell.x + cell.w - 2, cell.y, 2, cell.h), // right
      rect(cell.x, cell.y + cell.h - 2, cell.w, 2), // bottom
      rect(cell.x, cell.y, 2, cell.h), // left
    ];

    const union = unionRects(edges);
    expect(union.left).toBe(cell.x);
    expect(union.top).toBe(cell.y);
    expect(union.width).toBe(cell.w);
    expect(union.height).toBe(cell.h);
  });

  it('is unchanged by a single full-cell box', () => {
    // If Sheets ever switches back to one element, the union is a no-op.
    const union = unionRects([rect(500, 300, 100, 21)]);
    expect(union.width).toBe(100);
    expect(union.height).toBe(21);
  });

  it('ignores degenerate rects', () => {
    const union = unionRects([rect(0, 0, 0, 0), rect(500, 300, 100, 21)]);
    expect(union.left).toBe(500);
    expect(union.width).toBe(100);
  });

  it('returns null when nothing is usable', () => {
    expect(unionRects([])).toBeNull();
    expect(unionRects([rect(0, 0, 0, 0)])).toBeNull();
    expect(unionRects([null, undefined])).toBeNull();
  });

  it('produces a band-worthy height, not a hairline', () => {
    // Regression guard for the reported bug: the union must be tall enough to
    // read as a row band.
    const edges = [
      rect(890, 532, 200, 1),
      rect(890, 573, 200, 1),
      rect(890, 532, 1, 42),
      rect(1089, 532, 1, 42),
    ];
    expect(unionRects(edges).height).toBeGreaterThan(20);
  });
});

describe('isEditing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    invalidate();
  });

  /**
   * The Sheets formula bar: .cell-input, permanently contenteditable.
   *
   * The rects are essential, not decoration. jsdom reports 0x0 by default,
   * which makes any visibility-based check fall through and lets a broken
   * implementation pass. Giving it real geometry is what makes the test bite.
   */
  function mountFormulaBar(text = '=A1') {
    const wrap = withRect(document.createElement('div'), rect(180, 24, 900, 28));
    wrap.id = 't-formula-bar-input';
    const inner = withRect(document.createElement('div'), rect(180, 26, 900, 24));
    inner.className = 'cell-input';
    inner.setAttribute('contenteditable', 'true');
    inner.textContent = text;
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    return inner;
  }

  /**
   * Sheets parks focus in an offscreen input to capture keystrokes, so on a
   * real page activeElement is almost never <body>. Reproducing that is what
   * makes the test below meaningful.
   */
  function mountGridKeyboardCapture() {
    const capture = withRect(document.createElement('input'), rect(-9999, -9999, 1, 1));
    document.body.appendChild(capture);
    capture.focus();
    return capture;
  }

  it('is false when the grid has focus, even though the formula bar is contenteditable', () => {
    // THE regression that mattered: `.cell-input[contenteditable="true"]` also
    // matches the formula bar, so treating "a visible contenteditable exists"
    // as editing pinned this true forever and killed the feature outright.
    mountFormulaBar();
    const capture = mountGridKeyboardCapture();
    expect(document.activeElement).toBe(capture); // not <body>, as on a real page

    expect(isEditing()).toBe(false);
  });

  it('does NOT treat formula bar focus as editing — a deliberate trade', () => {
    // Sheets keeps focus in a .cell-input at all times, and the formula bar is
    // itself a .cell-input, so "formula bar has focus" cannot distinguish
    // editing from ordinary cell selection. We accept possibly showing links
    // during an edit rather than never showing them at all.
    const bar = mountFormulaBar();
    bar.tabIndex = 0;
    bar.focus();

    expect(isEditing()).toBe(false);
  });

  it('is false with nothing focused', () => {
    expect(isEditing()).toBe(false);
  });

  /**
   * The real element, as observed live while merely navigating cells:
   *   tag DIV, id waffle-rich-text-editor, class cell-input,
   *   rect "4,-9998 0x30", contentEditable true, focused
   *
   * It is both the cell editor and the always-focused keystroke sink, which is
   * why focus alone cannot distinguish editing from selection.
   */
  function mountCellEditor(r) {
    const editor = withRect(document.createElement('div'), r);
    editor.id = 'waffle-rich-text-editor';
    editor.className = 'cell-input';
    editor.setAttribute('contenteditable', 'true');
    editor.tabIndex = 0;
    document.body.appendChild(editor);
    return editor;
  }

  it('is false when the focused editor is parked off-screen (not editing)', () => {
    mountFormulaBar();
    const editor = mountCellEditor(rect(4, -9998, 0, 30)); // the exact live rect
    editor.focus();

    expect(document.activeElement).toBe(editor);
    expect(isEditing()).toBe(false);
  });

  it('is true when the same editor is laid out over a cell (really editing)', () => {
    mountFormulaBar();
    const editor = mountCellEditor(rect(500, 300, 120, 24));
    editor.focus();

    expect(isEditing()).toBe(true);
  });

  it('is false when the editor has a position but zero width', () => {
    mountFormulaBar();
    const editor = mountCellEditor(rect(500, 300, 0, 30));
    editor.focus();

    expect(isEditing()).toBe(false);
  });

  it('is true when the name box has focus, so typing a range is not hijacked', () => {
    const box = document.createElement('input');
    box.id = 't-name-box';
    document.body.appendChild(box);
    box.focus();

    expect(isEditing()).toBe(true);
  });
});

describe('sheet tab gid extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    invalidate();
  });

  function mountTab(name, attrs = {}) {
    const tab = document.createElement('div');
    tab.className = 'docs-sheet-tab';
    for (const [key, value] of Object.entries(attrs)) tab.setAttribute(key, value);
    const label = document.createElement('div');
    label.className = 'docs-sheet-tab-name';
    label.textContent = name;
    tab.appendChild(label);
    document.body.appendChild(tab);
    return tab;
  }

  it('reads the gid from a sheet-button id', () => {
    mountTab('Q3 Forecast', { id: 'sheet-button-1234567890' });
    expect(gidForSheetName('Q3 Forecast')).toBe('1234567890');
  });

  it('reads the gid from a data attribute', () => {
    mountTab('Summary', { 'data-gid': '42' });
    expect(gidForSheetName('Summary')).toBe('42');
  });

  it('returns null rather than guessing when no gid is exposed', () => {
    // The live case: names parse, gid is nowhere. Must return null so the
    // caller falls back, rather than inventing a number and navigating wrong.
    mountTab('Pricing Detail', { id: 'tab-3', 'data-index': '3' });
    expect(gidForSheetName('Pricing Detail')).toBeNull();
  });

  it('still resolves tab names when the gid is missing', () => {
    mountTab('SECTION ->');
    mountTab('Q3 Forecast - Regional');
    expect(sheetTabs().map((t) => t.name)).toEqual(['SECTION ->', 'Q3 Forecast - Regional']);
    expect(tabElementForName('Q3 Forecast - Regional')).toBeTruthy();
    expect(tabElementForName('nope')).toBeNull();
  });

  it('matches tab names case-insensitively and ignores surrounding space', () => {
    mountTab('Q3 Forecast', { id: 'sheet-button-7' });
    expect(gidForSheetName('  q3 forecast  ')).toBe('7');
  });
});

describe('formulaBar discovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    invalidate();
  });

  it('finds the formula bar by its known selector', () => {
    const wrap = document.createElement('div');
    wrap.id = 't-formula-bar-input';
    const inner = document.createElement('div');
    inner.className = 'cell-input';
    inner.textContent = "='Q3 Forecast'!E40";
    wrap.appendChild(inner);
    document.body.appendChild(wrap);

    expect(formulaBar()).toBe(inner);
  });

  it('falls back to finding an editable control near the top holding a formula', () => {
    // No recognised class at all — the structural fallback has to carry it.
    const decoy = withRect(document.createElement('input'), rect(0, 600, 300, 20));
    decoy.type = 'text';
    decoy.value = 'not a formula';
    document.body.appendChild(decoy);

    const bar = withRect(document.createElement('div'), rect(180, 30, 900, 24));
    bar.setAttribute('contenteditable', 'true');
    bar.textContent = "='Q3 Forecast'!E40";
    document.body.appendChild(bar);

    expect(formulaBar()).toBe(bar);
  });

  it('ignores editable controls that are too low or too narrow', () => {
    const low = withRect(document.createElement('div'), rect(180, 700, 900, 24));
    low.setAttribute('contenteditable', 'true');
    low.textContent = '=A1';
    document.body.appendChild(low);

    const narrow = withRect(document.createElement('div'), rect(10, 30, 40, 24));
    narrow.setAttribute('contenteditable', 'true');
    narrow.textContent = '=A1';
    document.body.appendChild(narrow);

    expect(formulaBar()).toBeNull();
  });
});
