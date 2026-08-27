// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { rangeForOffsets } from '../src/content/formulaBar.js';
import { extractRefs } from '../src/lib/refParser.js';

/** Build a formula bar whose text is split across the given span chunks. */
function makeBar(chunks) {
  const bar = document.createElement('div');
  for (const chunk of chunks) {
    const span = document.createElement('span');
    span.textContent = chunk;
    bar.appendChild(span);
  }
  document.body.appendChild(bar);
  return bar;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('rangeForOffsets', () => {
  it('maps offsets inside a single text node', () => {
    const formula = "='Q3 Forecast'!E40";
    const bar = makeBar([formula]);
    // Derive the end offset rather than hardcoding it, so renaming the example
    // sheet cannot silently break this.
    const range = rangeForOffsets(bar, 1, formula.length);
    expect(range.toString()).toBe("'Q3 Forecast'!E40");
  });

  it('maps offsets that span several syntax-highlighting spans', () => {
    // Sheets colours references separately, so one reference can straddle
    // multiple text nodes. This is the case that breaks naive offset handling.
    const bar = makeBar(['=SUM(', "'Q3", ' ', "Forecast'!E40", ', 1)']);
    const text = bar.textContent;
    expect(text).toBe("=SUM('Q3 Forecast'!E40, 1)");

    const [ref] = extractRefs(text);
    const range = rangeForOffsets(bar, ref.start, ref.end);
    expect(range.toString()).toBe("'Q3 Forecast'!E40");
  });

  it('maps every reference in a multi-reference formula', () => {
    const bar = makeBar(['=SUM(', "'Q3 Forecast'!E40", ', ', 'Actuals!B7', ')']);
    const text = bar.textContent;

    const found = extractRefs(text).map((ref) => rangeForOffsets(bar, ref.start, ref.end).toString());
    expect(found).toEqual(["'Q3 Forecast'!E40", 'Actuals!B7']);
  });

  it('maps a reference at the very end of the text', () => {
    const bar = makeBar(['=', 'Summary!A1']);
    const [ref] = extractRefs(bar.textContent);
    expect(rangeForOffsets(bar, ref.start, ref.end).toString()).toBe('Summary!A1');
  });

  it('returns null for offsets past the end of the text', () => {
    const bar = makeBar(['=A1']);
    expect(rangeForOffsets(bar, 10, 20)).toBeNull();
  });

  it('handles an empty formula bar without throwing', () => {
    const bar = makeBar([]);
    expect(rangeForOffsets(bar, 0, 1)).toBeNull();
  });
});
