// Turn stored hotkey strings ('Meta+Shift+BracketLeft') into readable labels.

const IS_MAC = navigator.platform?.toUpperCase().includes('MAC')
  || navigator.userAgent.includes('Mac OS');

export const MODIFIER_LABELS = IS_MAC
  ? { Alt: '⌥', Control: '⌃', Meta: '⌘', Shift: '⇧' }
  : { Alt: 'Alt', Control: 'Ctrl', Meta: 'Win', Shift: 'Shift' };

const CODE_LABELS = {
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Space: 'Space',
  Enter: 'Enter',
  Backspace: 'Backspace',
};

function labelForCode(code) {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}

/** 'Meta+Shift+BracketLeft' -> '⌘⇧[' on macOS, 'Win+Shift+[' elsewhere. */
export function formatHotkey(hotkey) {
  if (!hotkey) return '—';
  const parts = String(hotkey).split('+').filter(Boolean);
  const code = parts.pop();
  const mods = parts.map((m) => MODIFIER_LABELS[m] || m);
  const key = labelForCode(code);
  return IS_MAC ? [...mods, key].join('') : [...mods, key].join('+');
}

/**
 * Combinations the browser consumes before a page ever sees them. Binding one
 * produces a shortcut that silently does nothing — exactly how the original
 * Meta+Shift+BracketLeft default failed.
 */
const RESERVED_MAC = new Set([
  'Meta+BracketLeft', 'Meta+BracketRight', // back / forward
  'Meta+Shift+BracketLeft', 'Meta+Shift+BracketRight', // previous / next tab
  'Meta+Alt+ArrowLeft', 'Meta+Alt+ArrowRight', // previous / next tab
  'Meta+Shift+KeyJ', 'Meta+Alt+KeyI', 'Meta+Alt+KeyJ', 'Meta+Alt+KeyC', // DevTools
  'Meta+KeyT', 'Meta+KeyW', 'Meta+KeyN', 'Meta+KeyQ', 'Meta+KeyL', 'Meta+KeyR',
  'Meta+KeyD', 'Meta+KeyF', 'Meta+KeyP', 'Meta+KeyS', 'Meta+KeyO', 'Meta+KeyH',
  'Meta+KeyM', 'Meta+Shift+KeyT', 'Meta+Shift+KeyN', 'Meta+Shift+KeyW',
]);

const RESERVED_OTHER = new Set([
  'Alt+ArrowLeft', 'Alt+ArrowRight', // back / forward
  'Control+Tab', 'Control+Shift+Tab', // tab cycling
  'Control+Shift+KeyI', 'Control+Shift+KeyJ', 'Control+Shift+KeyC', // DevTools
  'Control+KeyT', 'Control+KeyW', 'Control+KeyN', 'Control+KeyL', 'Control+KeyR',
  'Control+KeyD', 'Control+KeyF', 'Control+KeyP', 'Control+KeyS', 'Control+KeyO',
  'Control+Shift+KeyT', 'Control+Shift+KeyN', 'Control+Shift+KeyW',
]);

/** True if the browser will intercept this combination before the page. */
export function isReservedHotkey(hotkey) {
  if (!hotkey) return false;
  const reserved = IS_MAC ? RESERVED_MAC : RESERVED_OTHER;
  if (reserved.has(hotkey)) return true;
  // Cmd/Ctrl + a digit switches tabs.
  return /^(Meta|Control)\+Digit[1-9]$/.test(hotkey);
}

/** Build a stored hotkey string from a KeyboardEvent. */
export function hotkeyFromEvent(event) {
  const mods = [];
  if (event.metaKey) mods.push('Meta');
  if (event.ctrlKey) mods.push('Control');
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');

  // A bare modifier keypress is not a complete binding.
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return null;
  if (!mods.length) return null; // require at least one modifier

  return [...mods, event.code].join('+');
}
