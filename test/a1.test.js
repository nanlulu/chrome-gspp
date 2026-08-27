import { describe, expect, it } from 'vitest';
import {
  colToIndex,
  formatRef,
  indexToCol,
  needsQuoting,
  parseRef,
  quoteSheetName,
  unquoteSheetName,
} from '../src/lib/a1.js';

describe('sheet name quoting', () => {
  it('leaves simple names unquoted', () => {
    expect(quoteSheetName('Summary')).toBe('Summary');
    expect(quoteSheetName('Q1_2026')).toBe('Q1_2026');
  });

  it('quotes names with spaces or punctuation', () => {
    expect(quoteSheetName('Q3 Forecast')).toBe("'Q3 Forecast'");
  });

  it('quotes names that start with a digit', () => {
    expect(quoteSheetName('2026')).toBe("'2026'");
  });

  it('quotes names that look like a cell reference', () => {
    expect(needsQuoting('A1')).toBe(true);
    expect(quoteSheetName('A1')).toBe("'A1'");
  });

  it('doubles inner quotes', () => {
    expect(quoteSheetName("Bob's Budget")).toBe("'Bob''s Budget'");
  });

  it('round-trips through unquoteSheetName', () => {
    for (const name of ['Summary', 'Q3 Forecast', "Bob's Budget", 'Wow! Sheet', '2026']) {
      expect(unquoteSheetName(quoteSheetName(name))).toBe(name);
    }
  });
});

describe('parseRef', () => {
  it('splits a quoted sheet reference', () => {
    expect(parseRef("'Q3 Forecast'!E40")).toEqual({ sheet: 'Q3 Forecast', range: 'E40' });
  });

  it('splits a bare sheet reference', () => {
    expect(parseRef('Summary!A1:B2')).toEqual({ sheet: 'Summary', range: 'A1:B2' });
  });

  it('returns a null sheet for an unqualified range', () => {
    expect(parseRef('A1')).toEqual({ sheet: null, range: 'A1' });
  });

  it('splits at the last unquoted ! so names containing ! survive', () => {
    expect(parseRef("'Wow! Sheet'!B2")).toEqual({ sheet: 'Wow! Sheet', range: 'B2' });
  });

  it('round-trips with formatRef', () => {
    for (const text of ["'Q3 Forecast'!E40", 'Summary!A1', 'A1', "'Bob''s Budget'!C3"]) {
      expect(formatRef(parseRef(text))).toBe(text);
    }
  });
});

describe('column index conversion', () => {
  it('converts letters to a 1-based index', () => {
    expect(colToIndex('A')).toBe(1);
    expect(colToIndex('Z')).toBe(26);
    expect(colToIndex('AA')).toBe(27);
    expect(colToIndex('$E')).toBe(5);
  });

  it('converts an index back to letters', () => {
    expect(indexToCol(1)).toBe('A');
    expect(indexToCol(26)).toBe('Z');
    expect(indexToCol(27)).toBe('AA');
    expect(indexToCol(0)).toBe('');
  });

  it('round-trips', () => {
    for (const n of [1, 5, 26, 27, 52, 703, 18278]) {
      expect(colToIndex(indexToCol(n))).toBe(n);
    }
  });
});
