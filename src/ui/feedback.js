// Build the settings summary a user copies into the feedback form.
//
// GSheet++ collects nothing, so the only way to learn which settings people
// actually keep — and why they turn the others off — is to ask. This produces
// the text for that: the user presses a button, reads it, and decides whether
// to paste it. Nothing here touches the network.
//
// FIELDS is an allowlist, not a serialisation of whatever it is handed. That is
// deliberate. The obvious next request is "put the diagnostics in there too",
// and the diagnostics next door carry spreadsheet content: __gspp.debugJump()
// reports the raw formula text and every sheet tab name, and
// describeSheetTab() returns a tab's name plus its outerHTML. Form responses
// are permanent. An allowlist makes leaking one of those a deliberate edit to
// this file rather than an accident somewhere else.

import { DEFAULTS } from '../lib/settings.js';
import { formatHotkey } from './hotkeyLabel.js';

// Set this once the Google Form exists. Until then the UI hides the link
// rather than shipping one that 404s. Form design and setup: docs/feedback-form.md
export const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/viewform';

export function isFormConfigured(url = FEEDBACK_FORM_URL) {
  return !url.includes('REPLACE_WITH_FORM_ID');
}

const onOff = (value) => (value ? 'on' : 'off');

/**
 * Every key that may appear in the report, in display order, with how to
 * render it. Anything not listed here is dropped — see the note above.
 */
const FIELDS = [
  { key: 'enabled', label: 'enabled', format: onOff },
  { key: 'rowEnabled', label: 'row highlight', format: onOff },
  { key: 'colEnabled', label: 'column highlight', format: onOff },
  { key: 'color', label: 'color', format: (v) => String(v) },
  { key: 'columnColor', label: 'column color', format: (v) => (v ? String(v) : '(none)') },
  { key: 'opacity', label: 'intensity', format: (v) => `${Math.round(Number(v) * 100)}%` },
  { key: 'rangeMode', label: 'range mode', format: (v) => String(v) },
  { key: 'jumpEnabled', label: 'formula bar links', format: onOff },
  { key: 'jumpModifier', label: 'link modifier', format: (v) => String(v) },
  { key: 'jumpBackHotkey', label: 'jump back', format: formatHotkey },
  { key: 'debug', label: 'debug logging', format: onOff },
];

const LABEL_WIDTH = Math.max(...FIELDS.map((f) => f.label.length)) + 2;

/**
 * Render the report.
 *
 * Pure, and deliberately human-readable rather than JSON: the privacy claim on
 * the options page is that you can see what you are about to paste. An opaque
 * blob would send the same bytes while destroying the thing that makes this
 * safe to offer at all.
 *
 * @param {object} settings merged settings, as returned by loadSettings()
 * @param {{version?: string, browser?: string}} env
 */
export function buildFeedbackReport(settings, env = {}) {
  const source = settings || {};
  const header = [`GSheet++ ${env.version || 'unknown version'}`];
  if (env.browser) header.push(env.browser);

  const lines = FIELDS.map(({ key, label, format }) => {
    const value = source[key] === undefined || source[key] === null
      ? DEFAULTS[key]
      : source[key];
    // Marking the defaults means the lines *without* a tag are the interesting
    // ones — which is exactly what we are trying to find out.
    const suffix = value === DEFAULTS[key] ? '  (default)' : '';
    return `${label.padEnd(LABEL_WIDTH)}${format(value)}${suffix}`;
  });

  return `${header.join('\n')}\n\n${lines.join('\n')}\n`;
}

/** Platform name from a user-agent string, for the userAgentData fallback. */
function guessPlatform(userAgent = '') {
  if (/CrOS/i.test(userAgent)) return 'ChromeOS';
  if (/Mac/i.test(userAgent)) return 'macOS';
  if (/Win/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/Linux|X11/i.test(userAgent)) return 'Linux';
  return '';
}

/**
 * "Chrome 140 on macOS".
 *
 * Prefers navigator.userAgentData over the full user-agent string: it carries
 * the same two facts a bug report needs with far less fingerprinting entropy,
 * which matters when the destination is a permanent form response.
 */
export function describeBrowser(nav = globalThis.navigator) {
  const brands = nav?.userAgentData?.brands;
  if (Array.isArray(brands) && brands.length) {
    // Chrome pads this list with a deliberately absurd entry ("Not)A;Brand")
    // to stop parsers hard-coding it, so skip that before taking the first.
    const brand = brands.find((b) => /chrome|chromium|edge/i.test(b?.brand || ''))
      || brands.find((b) => !/not.*a.*brand/i.test(b?.brand || ''));
    if (brand) {
      const platform = nav.userAgentData.platform || guessPlatform(nav.userAgent);
      return platform ? `${brand.brand} ${brand.version} on ${platform}` : `${brand.brand} ${brand.version}`;
    }
  }

  const userAgent = nav?.userAgent || '';
  const version = /Chrome\/(\d+)/.exec(userAgent)?.[1];
  const platform = guessPlatform(userAgent);
  if (!version) return platform;
  return platform ? `Chrome ${version} on ${platform}` : `Chrome ${version}`;
}

/** Version + browser, read from the extension and the page. */
export function describeEnvironment() {
  let version = 'unknown version';
  try {
    version = chrome?.runtime?.getManifest?.()?.version || version;
  } catch {
    /* not running as an extension (tests, or a plain page) */
  }
  return { version, browser: describeBrowser() };
}
