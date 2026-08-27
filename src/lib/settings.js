// Settings schema, defaults, and a live-updating subscription.
// Shared by the content script, the popup, and the options page.

export const DEFAULTS = {
  enabled: true,

  // Feature 1 — crosshair
  rowEnabled: true,
  colEnabled: true,
  // A light blue, tuned to read clearly under mix-blend-mode: multiply while
  // leaving cell text legible. The original amber at 0.22 was too faint to pick
  // out on a dense sheet, which is the whole point of the crosshair.
  color: '#AECBFF',
  columnColor: '', // empty string = reuse `color` for both bands
  opacity: 0.35,
  rangeMode: 'active', // 'active' | 'selection'

  // Feature 2 — reference jump
  jumpEnabled: true,
  jumpModifier: 'Alt', // 'Alt' | 'Control' | 'Meta' | 'Shift'
  // Keeps the "[" = back mnemonic but avoids Meta entirely. The previous
  // default, Meta+Shift+BracketLeft, is Chrome's own "previous tab" shortcut on
  // macOS: the browser consumed it before the page ever saw a keydown, so the
  // jump-back hotkey silently never fired. See isReservedHotkey().
  jumpBackHotkey: 'Alt+Shift+BracketLeft',

  debug: false,
};

const KEYS = Object.keys(DEFAULTS);

function withDefaults(stored) {
  const merged = { ...DEFAULTS };
  for (const key of KEYS) {
    const value = stored?.[key];
    if (value !== undefined && value !== null) merged[key] = value;
  }
  return merged;
}

/** Read all settings, filling in defaults for anything unset. */
export async function loadSettings() {
  try {
    const stored = await chrome.storage.sync.get(KEYS);
    return withDefaults(stored);
  } catch {
    return { ...DEFAULTS };
  }
}

/** Persist a partial update. */
export async function saveSettings(patch) {
  try {
    await chrome.storage.sync.set(patch);
  } catch {
    /* storage quota or extension reload — nothing useful to do */
  }
}

/**
 * Subscribe to changes. Calls `callback` with the full merged settings object
 * whenever anything changes, so consumers never diff individual keys.
 */
export function onSettingsChanged(callback) {
  const listener = async (changes, area) => {
    if (area !== 'sync') return;
    if (!Object.keys(changes).some((key) => KEYS.includes(key))) return;
    callback(await loadSettings());
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Parse '#RRGGBB' + opacity into an rgba() string. */
export function toRgba(hex, opacity) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const value = match ? match[1] : DEFAULTS.color.slice(1);
  const int = parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const a = Math.min(1, Math.max(0, Number(opacity)));
  return `rgba(${r}, ${g}, ${b}, ${Number.isFinite(a) ? a : DEFAULTS.opacity})`;
}

/**
 * Match a KeyboardEvent against a stored hotkey like 'Meta+Shift+BracketLeft'.
 * Uses event.code so the binding survives keyboard layout changes.
 */
export function matchesHotkey(event, hotkey) {
  if (!hotkey) return false;
  const parts = String(hotkey).split('+').map((p) => p.trim()).filter(Boolean);
  const code = parts.pop();
  if (!code || event.code !== code) return false;

  const want = new Set(parts.map((p) => p.toLowerCase()));
  return (
    event.metaKey === want.has('meta') &&
    event.ctrlKey === want.has('control') &&
    event.altKey === want.has('alt') &&
    event.shiftKey === want.has('shift')
  );
}

/** True when `event` reports the configured jump modifier as held. */
export function isModifierHeld(event, modifier) {
  switch (modifier) {
    case 'Control': return event.ctrlKey;
    case 'Meta': return event.metaKey;
    case 'Shift': return event.shiftKey;
    case 'Alt':
    default: return event.altKey;
  }
}
