// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEFAULTS, matchesHotkey } from '../src/lib/settings.js';
import { isReservedHotkey } from '../src/ui/hotkeyLabel.js';

// hotkeyLabel picks its reserved set from the platform at import time; jsdom
// reports a non-Mac userAgent, so these assert the non-Mac list.
describe('isReservedHotkey', () => {
  it('flags browser navigation shortcuts', () => {
    expect(isReservedHotkey('Alt+ArrowLeft')).toBe(true);
    expect(isReservedHotkey('Alt+ArrowRight')).toBe(true);
  });

  it('flags DevTools and tab shortcuts', () => {
    expect(isReservedHotkey('Control+Shift+KeyJ')).toBe(true);
    expect(isReservedHotkey('Control+KeyW')).toBe(true);
    expect(isReservedHotkey('Control+Tab')).toBe(true);
  });

  it('flags tab-switching digits', () => {
    expect(isReservedHotkey('Control+Digit1')).toBe(true);
    expect(isReservedHotkey('Control+Digit9')).toBe(true);
    expect(isReservedHotkey('Control+Digit0')).toBe(false);
  });

  it('allows the shipped default', () => {
    // The previous default, Meta+Shift+BracketLeft, is Chrome's "previous tab"
    // on macOS — the browser ate it and the hotkey silently never fired.
    expect(isReservedHotkey(DEFAULTS.jumpBackHotkey)).toBe(false);
    expect(DEFAULTS.jumpBackHotkey).not.toBe('Meta+Shift+BracketLeft');
  });

  it('handles empty input', () => {
    expect(isReservedHotkey('')).toBe(false);
    expect(isReservedHotkey(null)).toBe(false);
  });
});

describe('matchesHotkey against the default', () => {
  const event = (over) => ({
    code: 'BracketLeft', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...over,
  });

  it('matches the exact combination', () => {
    expect(matchesHotkey(event({ altKey: true, shiftKey: true }), DEFAULTS.jumpBackHotkey)).toBe(true);
  });

  it('rejects when a modifier is missing', () => {
    expect(matchesHotkey(event({ altKey: true }), DEFAULTS.jumpBackHotkey)).toBe(false);
  });

  it('rejects when an extra modifier is held', () => {
    expect(matchesHotkey(
      event({ altKey: true, shiftKey: true, metaKey: true }),
      DEFAULTS.jumpBackHotkey,
    )).toBe(false);
  });

  it('rejects a different key', () => {
    expect(matchesHotkey(
      event({ code: 'BracketRight', altKey: true, shiftKey: true }),
      DEFAULTS.jumpBackHotkey,
    )).toBe(false);
  });
});
