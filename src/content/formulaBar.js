// Feature 2 (part 2) — while the jump modifier is held, turn every reference in
// the formula bar into a clickable link.
//
// Key design decision: we never rewrite the formula bar's DOM. It is a live
// editing surface, and replacing its innerHTML would corrupt Sheets' own
// editing and range-highlight behaviour. Instead we measure where each
// reference sits and float transparent hotspots on top.

import { DEFAULTS, isModifierHeld } from '../lib/settings.js';
import { extractRefs } from '../lib/refParser.js';
import * as sheets from './selectors.js';

const LAYER_ID = 'gspp-links';

/**
 * Map character offsets in the element's text to a DOM Range.
 *
 * Sheets may split the formula across many spans for syntax colouring, so the
 * offsets from refParser have to be walked across text-node boundaries.
 * Exported for unit testing.
 */
export function rangeForOffsets(root, start, end) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  let node = walker.nextNode();
  while (node) {
    const length = node.nodeValue.length;
    if (!startNode && consumed + length > start) {
      startNode = node;
      startOffset = start - consumed;
    }
    if (startNode && consumed + length >= end) {
      endNode = node;
      endOffset = end - consumed;
      break;
    }
    consumed += length;
    node = walker.nextNode();
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  try {
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
  } catch {
    return null;
  }
  return range;
}

let measureCtx = null;
/** Width of `text` in the given CSS font — the <input> measurement fallback. */
function measureText(text, font) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * On-screen boxes for one reference. A reference can produce several boxes when
 * a long formula wraps, which is why this returns an array.
 */
function rectsForRef(barEl, ref, text) {
  // Contenteditable / span-based formula bar: use a real DOM Range, which
  // handles wrapping and bidi for free.
  if (barEl.firstChild && barEl.tagName !== 'INPUT' && barEl.tagName !== 'TEXTAREA') {
    const range = rangeForOffsets(barEl, ref.start, ref.end);
    if (range) {
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (rects.length) return rects;
    }
  }

  // <input>/<textarea> fallback: no text nodes to range over, so measure the
  // prefix width with canvas metrics against the element's own font.
  const style = window.getComputedStyle(barEl);
  const font = style.font || `${style.fontSize} ${style.fontFamily}`;
  const box = barEl.getBoundingClientRect();
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const scrollLeft = barEl.scrollLeft || 0;

  const prefix = measureText(text.slice(0, ref.start), font);
  const width = measureText(text.slice(ref.start, ref.end), font);
  const left = box.left + padLeft - scrollLeft + prefix;

  return [new DOMRect(left, box.top + 2, width, box.height - 4)];
}

/** Clip a rect to the formula bar so hotspots cannot escape when it scrolls. */
function clipTo(rect, bounds) {
  const left = Math.max(rect.left, bounds.left);
  const right = Math.min(rect.right, bounds.right);
  if (right - left < 1) return null;
  return new DOMRect(left, rect.top, right - left, rect.height);
}

export function createFormulaLinks({ getSettings, onJump }) {
  let layer = null;
  let active = false;
  let lastSignature = '';

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    document.body.appendChild(layer);
    return layer;
  }

  function teardown() {
    active = false;
    lastSignature = '';
    if (layer) layer.replaceChildren();
  }

  function render() {
    const settings = getSettings();

    // console.log from a content script lands in the page's normal console, so
    // this is visible without switching the DevTools execution context.
    // Always log a plain string first: an array or object as the sole argument
    // renders as a collapsed row that reads as an empty message.
    const bail = (reason, detail) => {
      if (settings.debug) {
        console.log(`[GSheet++] links not shown: ${reason}`);
        if (detail !== undefined) console.log('[GSheet++]   detail:', detail);
      }
      teardown();
    };

    if (!settings.enabled || !settings.jumpEnabled) {
      return bail('disabled in settings');
    }

    // Stay out of the way while the user is actually editing — Sheets does its
    // own range highlighting there.
    if (sheets.isEditing()) {
      return bail('isEditing() is true', sheets.activeElementInfo());
    }

    const barEl = sheets.formulaBar();
    if (!barEl) return bail('formula bar not found (selector chain and structural fallback both missed)');

    const text = sheets.formulaText();
    const refs = extractRefs(text);
    if (!refs.length) return bail(`no references parsed from ${JSON.stringify(text.slice(0, 80))}`);

    if (settings.debug) {
      console.log('[GSheet++] showing links for:', refs.map((r) => r.raw));
    }

    const bounds = barEl.getBoundingClientRect();
    // Skip the DOM work when nothing has moved or changed.
    const signature = `${text}|${Math.round(bounds.left)},${Math.round(bounds.top)},${Math.round(bounds.width)}`;
    if (active && signature === lastSignature) return undefined;
    lastSignature = signature;

    const host = ensureLayer();
    const nodes = [];

    for (const ref of refs) {
      for (const rect of rectsForRef(barEl, ref, text)) {
        const clipped = clipTo(rect, bounds);
        if (!clipped) continue;

        const hotspot = document.createElement('div');
        hotspot.className = 'gspp-link';
        hotspot.style.transform = `translate3d(${clipped.left}px, ${clipped.top}px, 0)`;
        hotspot.style.width = `${clipped.width}px`;
        hotspot.style.height = `${clipped.height}px`;
        hotspot.title = `Jump to ${ref.raw}`;

        hotspot.addEventListener('mousedown', (event) => {
          // Swallow the event so it never reaches the grid underneath.
          event.preventDefault();
          event.stopPropagation();
        }, true);

        hotspot.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          teardown();
          onJump(ref);
        }, true);

        nodes.push(hotspot);
      }
    }

    host.replaceChildren(...nodes);
    active = nodes.length > 0;
    return undefined;
  }

  const onKeyDown = (event) => {
    const settings = getSettings();
    const modifier = settings.jumpModifier || DEFAULTS.jumpModifier;
    // Only react to the modifier itself being held, not to it accompanying
    // some other keystroke the user is typing.
    if (event.key === modifier || isModifierHeld(event, modifier)) render();
  };

  const onKeyUp = (event) => {
    const settings = getSettings();
    const modifier = settings.jumpModifier || DEFAULTS.jumpModifier;
    if (event.key === modifier || !isModifierHeld(event, modifier)) teardown();
  };

  const onReposition = () => {
    if (active) render();
  };

  return {
    start() {
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('keyup', onKeyUp, true);
      window.addEventListener('blur', teardown);
      window.addEventListener('scroll', onReposition, { capture: true, passive: true });
      window.addEventListener('resize', onReposition, { passive: true });
    },
    refresh: teardown,
    stop() {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', teardown);
      window.removeEventListener('scroll', onReposition, { capture: true });
      window.removeEventListener('resize', onReposition);
      layer?.remove();
      layer = null;
    },
  };
}
