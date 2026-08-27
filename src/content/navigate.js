// Feature 2 (part 1) — move the cursor to a referenced cell, and back again.
//
// Two strategies, each the other's fallback:
//   1. Hash navigation — set location.hash to #gid=<gid>&range=<A1>. Sheets
//      honours this without a page reload. Fast and does not fight the app.
//   2. Name box — type the reference into the A1 box and press Enter. Slower
//      and more fragile, but it is the only option for hidden sheets (no tab,
//      therefore no gid) and for named ranges.

import { formatRef } from '../lib/a1.js';
import * as sheets from './selectors.js';

/** Where the cursor was before each jump, so we can come back. */
const backStack = [];
const MAX_BACK = 50;

/**
 * Sheet name -> gid, learned at runtime.
 *
 * The tab strip does not expose the gid on this Sheets build (observed live:
 * every tab reported null), so we discover it by switching to a sheet and
 * reading the gid Sheets writes into the URL. Once learned, later jumps to
 * that sheet take the fast hash route directly.
 */
const learnedGids = new Map();

function currentGid() {
  return /[#&?]gid=(-?\d+)/.exec(location.hash + location.search)?.[1] || null;
}

/** Current position as {gid, a1}, read from the URL and the name box. */
function currentPosition() {
  const box = sheets.nameBox();
  const a1 = box ? (box.value || box.textContent || '').trim() : '';
  return { gid: currentGid(), a1 };
}

function knownGid(sheetName) {
  return sheets.gidForSheetName(sheetName) || learnedGids.get(sheetName) || null;
}

function jumpViaHash(gid, range) {
  // ':' is legal in a fragment and Sheets' own "link to this cell" URLs leave it
  // unencoded, so keep the same shape rather than sending %3A.
  const encoded = encodeURIComponent(range).replace(/%3A/gi, ':');
  const target = `#gid=${gid}&range=${encoded}`;
  if (location.hash === target) {
    // Re-jumping to where we already are fires no hashchange, so Sheets would
    // ignore it. Clear first to force the event.
    location.hash = `#gid=${gid}`;
  }
  location.hash = target;
  return true;
}

function setNativeValue(element, value) {
  // React/Closure-style frameworks patch the value setter; go through the
  // prototype descriptor so the change is seen as a real edit.
  const proto = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) descriptor.set.call(element, value);
  else element.value = value;
}

function jumpViaNameBox(refText) {
  const box = sheets.nameBox();
  if (!box) return false;

  try {
    box.focus();

    if (box.tagName === 'INPUT' || box.tagName === 'TEXTAREA') {
      box.select?.();
      setNativeValue(box, refText);
    } else if (box.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      selection.removeAllRanges();
      selection.addRange(range);
      // execCommand is deprecated but remains the most reliable way to make a
      // contenteditable edit look user-generated to the host app.
      if (!document.execCommand('insertText', false, refText)) {
        box.textContent = refText;
      }
    } else {
      return false;
    }

    box.dispatchEvent(new Event('input', { bubbles: true }));

    for (const type of ['keydown', 'keypress', 'keyup']) {
      box.dispatchEvent(new KeyboardEvent(type, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }));
    }
    return true;
  } catch {
    return false;
  }
}

/** Fire the event sequence a Sheets tab actually listens for. */
function clickTab(el) {
  // No `view` — handlers do not need it, and omitting it keeps the event
  // constructible in environments with a stricter MouseEvent implementation.
  const options = { bubbles: true, cancelable: true };
  for (const type of ['mousedown', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, options));
  }
}

/**
 * Switch sheets by clicking its tab, then position within it once Sheets has
 * updated the URL. This needs no prior knowledge of the gid — and it learns
 * the gid on the way through, so the next jump to this sheet is direct.
 */
function jumpViaTabClick(ref, onSettled) {
  const tab = sheets.tabElementForName(ref.sheet);
  if (!tab) return false;

  const before = currentGid();
  clickTab(tab);

  let attempts = 0;
  const settle = () => {
    attempts += 1;
    const gid = currentGid();

    if (gid && gid !== before) {
      learnedGids.set(ref.sheet, gid);
      jumpViaHash(gid, ref.range);
      onSettled?.(true);
      return;
    }
    if (attempts < 12) {
      setTimeout(settle, 60);
      return;
    }
    // Tab switch never registered in the URL; fall back to the name box.
    //
    // Run the fallback BEFORE notifying. Optional-call syntax short-circuits
    // its arguments, so `onSettled?.(jumpViaNameBox(...))` silently skips the
    // fallback entirely whenever no callback was passed — which is the normal
    // case from jumpTo().
    const ok = jumpViaNameBox(formatRef(ref));
    onSettled?.(ok);
  };
  setTimeout(settle, 60);
  return true;
}

/**
 * Jump to a reference produced by refParser.
 * @param {{sheet: string|null, range: string}} ref
 * @returns {{ok: boolean, strategy: string, message?: string}}
 */
export function jumpTo(ref) {
  if (!ref || !ref.range) return { ok: false, strategy: 'none', message: 'No reference' };

  const origin = currentPosition();

  // Same-sheet reference: the name box handles it without needing a gid.
  if (!ref.sheet) {
    const ok = jumpViaNameBox(ref.range);
    if (ok) pushBack(origin);
    return { ok, strategy: 'nameBox', message: ok ? '' : 'Could not reach the name box' };
  }

  const gid = knownGid(ref.sheet);
  if (gid) {
    jumpViaHash(gid, ref.range);
    pushBack(origin);
    return { ok: true, strategy: 'hash' };
  }

  // gid unknown: switch via the tab itself and learn the gid en route.
  if (jumpViaTabClick(ref)) {
    pushBack(origin);
    return { ok: true, strategy: 'tabClick' };
  }

  // No tab with that name — hidden sheet, or a name we failed to match.
  const ok = jumpViaNameBox(formatRef(ref));
  if (ok) pushBack(origin);
  return {
    ok,
    strategy: 'nameBox',
    message: ok ? '' : `Could not find sheet "${ref.sheet}"`,
  };
}

function pushBack(position) {
  if (!position || (!position.gid && !position.a1)) return;
  backStack.push(position);
  if (backStack.length > MAX_BACK) backStack.shift();
}

/** Return to the cell we jumped from. */
export function jumpBack() {
  const previous = backStack.pop();
  if (!previous) return { ok: false, message: 'Nothing to go back to' };

  if (previous.gid && previous.a1) {
    jumpViaHash(previous.gid, previous.a1);
    return { ok: true, message: `Back to ${previous.a1}` };
  }
  if (previous.a1) {
    const ok = jumpViaNameBox(previous.a1);
    return { ok, message: ok ? `Back to ${previous.a1}` : 'Could not go back' };
  }
  return { ok: false, message: 'Nothing to go back to' };
}

export function backStackDepth() {
  return backStack.length;
}
