// Every Google Sheets DOM lookup lives here.
//
// Sheets is a Closure app with obfuscated, unstable markup. When Google changes
// it, this file is the only one that should need editing. Rules:
//   1. Nothing outside this module may call querySelector on Sheets' own DOM.
//   2. Every lookup has a candidate chain, most-specific first.
//   3. Every lookup returns null rather than throwing. A missed selector must
//      degrade GSheet++ to a no-op, never break the user's spreadsheet.
//
// Run `scripts/probe.js` in the DevTools console on a real sheet to see which
// candidates currently resolve; record findings in docs/sheets-dom.md.

/**
 * Candidate chains. Confidence notes:
 *  - activeCell: CONFIRMED against a live sheet by an existing userscript.
 *  - the rest: unverified guesses at time of writing, hence the long chains and
 *    the derived fallbacks below.
 */
const CANDIDATES = {
  activeCell: ['.active-cell-border', '.autofill-cover'],
  selectionRange: [
    '.selection-border',
    '.range-border',
    '.selected-range-border',
  ],
  gridViewport: [
    '.grid-scrollable-wrapper',
    '#waffle-grid-container',
    '.waffle-grid-container',
    '.grid-container',
  ],
  columnHeaders: ['.column-headers-background', '.column-header-wrapper'],
  rowHeaders: ['.row-headers-background', '.row-header-wrapper'],
  nameBox: [
    '#t-name-box',
    '.waffle-name-box input',
    '.waffle-name-box',
    'input[aria-label*="Name box" i]',
  ],
  formulaBar: [
    '#t-formula-bar-input .cell-input',
    '#t-formula-bar-input',
    '.formula-bar-input-container .cell-input',
    '#formula-bar-input',
    '.formula-bar-input',
    '[aria-label*="Formula bar" i]',
  ],
  sheetTabs: ['.docs-sheet-tab', '[id^="sheet-button-"]'],
  bottomBar: ['#docs-sheet-container-bar', '.docs-sheet-container-bar'],
  // Deliberately excludes anything matching `.cell-input`. Sheets keeps focus
  // parked in a `.cell-input` keystroke sink at all times — observed live:
  // document.activeElement.className === 'cell-input' while merely selecting
  // cells, not editing. Matching it here made isEditing() permanently true and
  // silently disabled the reference links and the jump-back hotkey.
  editingCell: ['#waffle-rich-text-editor', '.waffle-cell-editor'],
};

const cache = new Map();

function isUsable(el) {
  return el instanceof Element && el.isConnected;
}

/** Resolve a candidate chain, caching the winner until it detaches. */
function find(key) {
  const cached = cache.get(key);
  if (isUsable(cached)) return cached;

  for (const selector of CANDIDATES[key] || []) {
    let el = null;
    try {
      el = document.querySelector(selector);
    } catch {
      continue; // an invalid selector must not take the extension down
    }
    if (isUsable(el)) {
      cache.set(key, el);
      return el;
    }
  }
  cache.delete(key);
  return null;
}

/** Drop cached elements — call on sheet switch or navigation. */
export function invalidate() {
  cache.clear();
}

function rectOf(el) {
  if (!isUsable(el)) return null;
  const rect = el.getBoundingClientRect();
  // A zero-size rect means the sheet is still loading or the element is hidden.
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

/** Resolve a candidate chain to ALL matching elements, not just the first. */
function findAll(key) {
  for (const selector of CANDIDATES[key] || []) {
    let nodes = [];
    try {
      nodes = Array.from(document.querySelectorAll(selector)).filter(isUsable);
    } catch {
      continue;
    }
    if (nodes.length) return nodes;
  }
  return [];
}

/**
 * Smallest rect containing all the given rects. Exported for unit testing.
 *
 * Sheets draws the active-cell outline as four separate 1px edge divs (top,
 * right, bottom, left) rather than one box. Taking only the first match yields
 * the top edge: full cell width but ~1px tall, which renders the row band as a
 * hairline. Unioning the edges reconstructs the actual cell box.
 */
export function unionRects(rects) {
  const valid = rects.filter((r) => r && r.width > 0 && r.height > 0);
  if (!valid.length) return null;

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of valid) {
    if (r.left < left) left = r.left;
    if (r.top < top) top = r.top;
    if (r.right > right) right = r.right;
    if (r.bottom > bottom) bottom = r.bottom;
  }
  return new DOMRect(left, top, right - left, bottom - top);
}

/** Bounding rect of the active (focused) cell, or null. */
export function activeCellRect() {
  const elements = findAll('activeCell');
  if (!elements.length) return null;
  return unionRects(elements.map((el) => el.getBoundingClientRect()));
}

/** The element whose style mutations signal the active cell moving. */
export function activeCellElement() {
  return find('activeCell');
}

/** Bounding rect of the multi-cell selection, or null when there is none. */
export function selectionRect() {
  const elements = findAll('selectionRange');
  if (!elements.length) return null;
  // Same edge-div treatment as the active cell.
  return unionRects(elements.map((el) => el.getBoundingClientRect()));
}

/**
 * The scrollable grid area, used to clip highlight bands so they never paint
 * over the toolbar, the headers, or the sheet-tab bar.
 *
 * Falls back to deriving the region from the header elements, and finally to
 * the window inset below the active cell's own container — a wrong-but-sane
 * rect beats no highlight at all.
 */
export function gridViewportRect() {
  const direct = rectOf(find('gridViewport'));
  if (direct) return direct;

  const colHeaders = rectOf(find('columnHeaders'));
  const rowHeaders = rectOf(find('rowHeaders'));
  const bottomBar = rectOf(find('bottomBar'));

  if (colHeaders || rowHeaders) {
    const top = colHeaders ? colHeaders.bottom : 0;
    const left = rowHeaders ? rowHeaders.right : 0;
    const bottom = bottomBar ? bottomBar.top : window.innerHeight;
    return new DOMRect(left, top, window.innerWidth - left, bottom - top);
  }

  const cell = activeCellRect();
  if (!cell) return null;
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

/** The name box input (the A1 box left of the formula bar), or null. */
export function nameBox() {
  const el = find('nameBox');
  if (!el) return null;
  // Some candidates match a wrapper; drill to the real input if there is one.
  if (el.tagName === 'INPUT' || el.isContentEditable) return el;
  return el.querySelector('input') || el;
}

/**
 * Find the formula bar by shape rather than by class, for when the candidate
 * chain misses: an editable control near the top of the window whose text
 * currently reads like a formula. This only fires when the selected cell holds
 * a formula, which is exactly when the reference links matter.
 */
function discoverFormulaBar() {
  const controls = document.querySelectorAll(
    '[contenteditable="true"], input[type="text"], textarea',
  );
  for (const el of controls) {
    const rect = el.getBoundingClientRect();
    // The formula bar sits in the top chrome and is wide.
    if (rect.top > 220 || rect.width < 120) continue;
    const text = (el.value !== undefined ? el.value : el.textContent) || '';
    if (text.trim().startsWith('=')) return el;
  }
  return null;
}

/** The formula bar element whose text shows the active cell's formula. */
export function formulaBar() {
  const direct = find('formulaBar');
  if (direct) return direct;

  const cached = cache.get('formulaBar:discovered');
  if (isUsable(cached)) return cached;

  const discovered = discoverFormulaBar();
  if (discovered) cache.set('formulaBar:discovered', discovered);
  return discovered;
}

/** Text currently displayed in the formula bar (the active cell's formula). */
export function formulaText() {
  const el = formulaBar();
  if (!el) return '';
  return (el.value !== undefined ? el.value : el.textContent) || '';
}

/**
 * Sheet tabs as [{ name, gid, element }]. Powers name -> gid lookup for hash
 * navigation. Hidden sheets have no tab and so never appear here — that is why
 * navigate.js keeps the name-box fallback.
 */
/**
 * Dig the numeric gid out of a tab element.
 *
 * Observed live: the gid is NOT in `id` as `sheet-button-<gid>` — every tab
 * reported null. So this checks several places, but only ever accepts a value
 * from an attribute whose *name* mentions gid/sheet. A looser "first number
 * found" search would happily return a tab index and navigate to the wrong
 * sheet, which is worse than returning null and letting a fallback handle it.
 */
function gidFromElement(el) {
  const fromId = /sheet-button-(-?\d+)/.exec(el.id || '');
  if (fromId) return fromId[1];

  for (const [key, value] of Object.entries(el.dataset || {})) {
    if (/gid|sheet|id/i.test(key) && /^-?\d+$/.test(value)) return value;
  }

  for (const attr of el.attributes || []) {
    if (/gid|sheet/i.test(attr.name) && /^-?\d+$/.test(attr.value)) return attr.value;
  }

  const inner = el.querySelector('[id*="sheet-button-"]');
  const fromInner = inner && /sheet-button-(-?\d+)/.exec(inner.id || '');
  return fromInner ? fromInner[1] : null;
}

export function sheetTabs() {
  const tabs = [];
  const seen = new Set();

  for (const selector of CANDIDATES.sheetTabs) {
    let nodes = [];
    try {
      nodes = document.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const el of nodes) {
      if (seen.has(el)) continue;
      seen.add(el);

      const nameEl = el.querySelector('.docs-sheet-tab-name') || el;
      const name = (nameEl.textContent || '').trim();

      if (name) tabs.push({ name, gid: gidFromElement(el), element: el });
    }
    if (tabs.length) break;
  }
  return tabs;
}

/** The tab element whose name matches, or null. */
export function tabElementForName(name) {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  for (const tab of sheetTabs()) {
    if (tab.name.toLowerCase() === target) return tab.element;
  }
  return null;
}

/** Raw attribute dump of the first tab, for locating where the gid lives. */
export function describeSheetTab() {
  const tabs = sheetTabs();
  if (!tabs.length) return null;
  const el = tabs[0].element;
  const attrs = {};
  for (const attr of el.attributes || []) attrs[attr.name] = attr.value;
  return {
    name: tabs[0].name,
    gid: tabs[0].gid,
    attributes: attrs,
    dataset: { ...el.dataset },
    outerHTML: el.outerHTML.slice(0, 400),
  };
}

/** Numeric gid of the sheet tab whose name matches, or null. */
export function gidForSheetName(name) {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  for (const tab of sheetTabs()) {
    if (tab.name.toLowerCase() === target) return tab.gid;
  }
  return null;
}

/**
 * True while the user is actively typing in a cell, the formula bar, or the
 * name box.
 *
 * Note: this deliberately does NOT test `activeElement.tagName === 'INPUT'`.
 * Sheets parks focus in a hidden input to capture keystrokes, so that check is
 * true almost all the time and would suppress the feature permanently. We test
 * for containment in a specific, visible editing surface instead.
 */
/** Is the element actually laid out somewhere the user can see? */
function isOnScreen(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return (
    rect.bottom > 0
    && rect.right > 0
    && rect.top < window.innerHeight
    && rect.left < window.innerWidth
  );
}

/**
 * True only while the user is genuinely editing.
 *
 * The subtlety that broke this three times: `#waffle-rich-text-editor`
 * (class `cell-input`) is BOTH the cell editor and the keystroke sink that
 * holds focus at all times. Observed idle, mid-navigation:
 *
 *     tag DIV, id waffle-rich-text-editor, rect "4,-9998 0x30"
 *
 * So focus on it proves nothing — every focus-based or existence-based test
 * returns true permanently and silently disables the reference links and the
 * jump-back hotkey. What separates the two states is layout: Sheets parks the
 * editor off-screen at zero width when idle, and moves it over the cell with a
 * real box during an edit. Hence the on-screen test.
 */
export function isEditing() {
  const active = document.activeElement;
  if (!active || active === document.body) return false;

  // Typing a range into the name box must not be hijacked.
  const box = nameBox();
  if (box && (box === active || box.contains(active))) return true;

  const editor = find('editingCell');
  if (editor && (editor === active || editor.contains(active))) {
    return isOnScreen(editor);
  }
  return false;
}

/** Details of the focused element, for diagnosing editing-state confusion. */
export function activeElementInfo() {
  const active = document.activeElement;
  if (!active) return null;
  const rect = active.getBoundingClientRect();
  const bar = find('formulaBar');
  return {
    tag: active.tagName,
    id: active.id || '(none)',
    class: String(active.className || '(none)').slice(0, 80),
    rect: `${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
    isFormulaBar: Boolean(bar && (bar === active || bar.contains(active))),
    contentEditable: active.isContentEditable,
  };
}

/** True when a modal dialog is covering the grid. */
export function isDialogOpen() {
  const dialog = document.querySelector('[role="dialog"], .modal-dialog');
  return Boolean(dialog && rectOf(dialog));
}

/** Which lookups currently resolve — used by the diagnostic in index.js. */
export function diagnose() {
  const report = {};
  for (const key of Object.keys(CANDIDATES)) {
    if (key === 'sheetTabs') {
      report.sheetTabs = `${sheetTabs().length} tabs`;
      continue;
    }
    const el = find(key);
    report[key] = el ? 'ok' : 'MISSING';
  }
  // Element counts matter: the active-cell outline is drawn as four edge divs,
  // and a regression to reading only one would silently flatten a band.
  const cell = activeCellRect();
  report.activeCellElements = findAll('activeCell').length;
  report.activeCellRect = cell
    ? `${Math.round(cell.width)}x${Math.round(cell.height)}`
    : 'none';
  return report;
}
