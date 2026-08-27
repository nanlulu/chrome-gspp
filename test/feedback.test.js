// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/lib/settings.js';
import { buildFeedbackReport, describeBrowser, isFormConfigured } from '../src/ui/feedback.js';
import { formatHotkey } from '../src/ui/hotkeyLabel.js';

const ENV = { version: '0.1.0', browser: 'Chrome 140 on macOS' };

describe('buildFeedbackReport', () => {
  it('reports every setting', () => {
    const report = buildFeedbackReport(DEFAULTS, ENV);
    // Labels are prose, so assert on the values that must be present rather
    // than on wording that is allowed to change.
    expect(report).toContain('0.1.0');
    expect(report).toContain('Chrome 140 on macOS');
    expect(report).toContain(DEFAULTS.color);
    expect(report).toContain('35%');
    expect(report).toContain('active');
    expect(report).toContain('Alt');
    expect(report.split('\n').filter((l) => l.trim()).length)
      .toBe(Object.keys(DEFAULTS).length + 2); // 11 settings + version + browser
  });

  it('marks defaults, and leaves changed values unmarked', () => {
    const report = buildFeedbackReport({ ...DEFAULTS, colEnabled: false }, ENV);
    const line = report.split('\n').find((l) => l.startsWith('column highlight'));
    expect(line).toContain('off');
    expect(line).not.toContain('(default)');
    // The row above it is untouched, so it keeps its tag.
    expect(report.split('\n').find((l) => l.startsWith('row highlight')))
      .toContain('(default)');
  });

  it('renders the hotkey the same way the settings page does', () => {
    const report = buildFeedbackReport(DEFAULTS, ENV);
    expect(report).toContain(formatHotkey(DEFAULTS.jumpBackHotkey));
  });

  it('shows an unset column color as (none) rather than an empty column', () => {
    expect(buildFeedbackReport(DEFAULTS, ENV)).toContain('(none)');
    expect(buildFeedbackReport({ ...DEFAULTS, columnColor: '#FF0000' }, ENV))
      .toContain('#FF0000');
  });

  it('falls back to defaults for missing keys instead of printing undefined', () => {
    const report = buildFeedbackReport({}, ENV);
    expect(report).not.toContain('undefined');
    expect(report).toContain(DEFAULTS.color);
  });

  it('survives being handed nothing at all', () => {
    expect(() => buildFeedbackReport(null, {})).not.toThrow();
    expect(buildFeedbackReport(null, {})).toContain('unknown version');
  });

  // The one that matters. The report is pasted into a permanent, public form
  // response, and spreadsheet content sits one function call away in the debug
  // helpers (__gspp.debugJump reports formula text and every sheet tab name;
  // describeSheetTab returns a tab name plus its outerHTML). FIELDS is an
  // allowlist so that leaking one of those has to be a deliberate edit.
  it('drops anything not on the allowlist', () => {
    const report = buildFeedbackReport({
      ...DEFAULTS,
      sheetName: 'Q3 Forecast',
      formulaText: "='Q3 Forecast'!E40*1.15",
      documentUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit',
      email: 'someone@example.com',
    }, ENV);

    expect(report).not.toContain('Q3 Forecast');
    expect(report).not.toContain('E40');
    expect(report).not.toContain('abc123');
    expect(report).not.toContain('example.com');
    expect(report).not.toContain('sheetName');
  });
});

describe('describeBrowser', () => {
  it('prefers userAgentData and skips the deliberately absurd brand', () => {
    expect(describeBrowser({
      userAgentData: {
        brands: [
          { brand: 'Not)A;Brand', version: '99' },
          { brand: 'Google Chrome', version: '140' },
        ],
        platform: 'macOS',
      },
    })).toBe('Google Chrome 140 on macOS');
  });

  it('falls back to the user-agent string', () => {
    expect(describeBrowser({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.0.0 Safari/537.36',
    })).toBe('Chrome 140 on macOS');
  });

  it('does not throw without a navigator', () => {
    expect(() => describeBrowser(undefined)).not.toThrow();
  });
});

describe('isFormConfigured', () => {
  it('rejects the placeholder so the UI can hide a dead link', () => {
    expect(isFormConfigured('https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/viewform'))
      .toBe(false);
    expect(isFormConfigured('https://docs.google.com/forms/d/e/1FAIpQL_real/viewform'))
      .toBe(true);
  });
});
