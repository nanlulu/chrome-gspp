// Rect math and change detection for the crosshair.
//
// The core performance idea: many noisy events (scroll, wheel, mutations, a
// safety-net tick) all funnel into ONE requestAnimationFrame-coalesced call,
// and that call does no DOM writes unless the geometry actually changed. This
// replaces the 100ms setInterval polling used by the prior-art userscript.

/** Intersection of two rects, or null when they do not overlap. */
export function intersect(a, b) {
  if (!a || !b) return null;
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right <= left || bottom <= top) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

/** Compare rects at sub-pixel tolerance; null === null counts as equal. */
export function rectsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

const SCROLL_EVENTS = ['scroll', 'wheel'];
const INPUT_EVENTS = ['mouseup', 'keyup', 'mousedown'];
const WINDOW_EVENTS = ['resize', 'focus', 'blur'];

// Safety net for anything the event listeners miss (Sheets moves the active
// cell through paths we do not observe). Deliberately slow — the event
// listeners do the real work; this only catches drift.
const RECONCILE_MS = 250;

/**
 * Drive `onUpdate` whenever the grid may have moved.
 * @returns {{ stop: () => void, poke: () => void }}
 */
export function createScheduler(onUpdate) {
  let frame = 0;
  let timer = 0;
  let observer = null;
  let stopped = false;

  const schedule = () => {
    if (stopped || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      try {
        onUpdate();
      } catch {
        /* never let a render error escape into the page */
      }
    });
  };

  // Capture phase: the grid scrolls inside its own containers, and those
  // scroll events do not bubble to window.
  for (const type of SCROLL_EVENTS) {
    window.addEventListener(type, schedule, { capture: true, passive: true });
  }
  for (const type of INPUT_EVENTS) {
    window.addEventListener(type, schedule, { capture: true, passive: true });
  }
  for (const type of WINDOW_EVENTS) {
    window.addEventListener(type, schedule, { passive: true });
  }

  timer = setInterval(schedule, RECONCILE_MS);

  /** Watch the active-cell element's inline style for movement. */
  const observe = (element) => {
    if (observer) observer.disconnect();
    if (!element) return;
    observer = new MutationObserver(schedule);
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  };

  const stop = () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    if (timer) clearInterval(timer);
    if (observer) observer.disconnect();
    for (const type of SCROLL_EVENTS) {
      window.removeEventListener(type, schedule, { capture: true });
    }
    for (const type of INPUT_EVENTS) {
      window.removeEventListener(type, schedule, { capture: true });
    }
    for (const type of WINDOW_EVENTS) {
      window.removeEventListener(type, schedule);
    }
  };

  return { stop, poke: schedule, observe };
}
