import { describe, expect, it } from 'vitest';
import { extractCrossSheetRefs, extractRefs } from '../src/lib/refParser.js';

const raws = (formula) => extractRefs(formula).map((r) => r.raw);

describe('extractRefs — the real-world case', () => {
  it("parses ='Q3 Forecast'!E40", () => {
    const refs = extractRefs("='Q3 Forecast'!E40");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      raw: "'Q3 Forecast'!E40",
      sheet: 'Q3 Forecast',
      range: 'E40',
      start: 1,
    });
    expect(refs[0].end).toBe("='Q3 Forecast'!E40".length);
  });

  it('reports offsets that slice back to the same text', () => {
    const formula = "=SUM('Q3 Forecast'!E40, Actuals!B7)";
    for (const ref of extractRefs(formula)) {
      expect(formula.slice(ref.start, ref.end)).toBe(ref.raw);
    }
  });
});

describe('extractRefs — sheet qualifiers', () => {
  it('parses a bare sheet name', () => {
    expect(extractRefs('=Summary!A1')[0]).toMatchObject({ sheet: 'Summary', range: 'A1' });
  });

  it('parses multiple references in one formula', () => {
    expect(raws("=SUM('Q3 Forecast'!E40, Actuals!B7, Summary!A1:A20)")).toEqual([
      "'Q3 Forecast'!E40",
      'Actuals!B7',
      'Summary!A1:A20',
    ]);
  });

  it('keeps a sheet name that contains an exclamation mark', () => {
    expect(extractRefs("='Wow! Sheet'!B2")[0]).toMatchObject({ sheet: 'Wow! Sheet', range: 'B2' });
  });

  it("unescapes '' inside a quoted sheet name", () => {
    expect(extractRefs("='Bob''s Budget'!C3")[0]).toMatchObject({ sheet: "Bob's Budget" });
  });

  it('handles a sheet name that is only digits', () => {
    expect(extractRefs("='2026'!A1")[0]).toMatchObject({ sheet: '2026', range: 'A1' });
  });

  // The bare-sheet pattern matches by Unicode property. It was once written as
  // a literal codepoint range, which embedded U+FFFF — valid UTF-8, but Chrome
  // refuses to load a content script containing it.
  it('parses an unquoted sheet name in a non-Latin script', () => {
    expect(extractRefs('=予算!A1')[0]).toMatchObject({ sheet: '予算', range: 'A1' });
  });

  it('parses an unquoted sheet name with accented Latin characters', () => {
    expect(extractRefs('=Prévisions!B2')[0]).toMatchObject({ sheet: 'Prévisions', range: 'B2' });
  });
});

describe('extractRefs — range shapes', () => {
  it('parses a cell range', () => {
    expect(raws('=SUM(A1:B5)')).toEqual(['A1:B5']);
  });

  it('parses absolute references', () => {
    expect(raws('=$A$1')).toEqual(['$A$1']);
    expect(extractRefs("='Q3 Forecast'!$E$40")[0].range).toBe('$E$40');
  });

  it('parses a whole-column range', () => {
    expect(raws('=SUM(A:A)')).toEqual(['A:A']);
  });

  it('parses a whole-row range', () => {
    expect(raws('=SUM(1:1)')).toEqual(['1:1']);
  });

  it('prefers the longer range over its first cell', () => {
    expect(raws('=A1:B5')).toEqual(['A1:B5']);
  });

  it('parses three-letter columns', () => {
    expect(raws('=ZZZ100')).toEqual(['ZZZ100']);
  });
});

describe('extractRefs — things that must NOT match', () => {
  it('ignores references inside a string literal', () => {
    expect(extractRefs('="see Sheet1!A1"')).toEqual([]);
  });

  it('handles an escaped quote inside a string literal', () => {
    expect(extractRefs('=""" is a quote" & A1')).toEqual(
      expect.arrayContaining([expect.objectContaining({ raw: 'A1' })]),
    );
  });

  it('does not treat a function name as a cell reference', () => {
    // LOG10( scans as column LOG + row 10 without the trailing-paren guard.
    expect(raws('=LOG10(A1)')).toEqual(['A1']);
  });

  it('does not match inside a longer identifier', () => {
    expect(extractRefs('=MyRange1')).toEqual([]);
    expect(extractRefs('=A1B2')).toEqual([]);
  });

  it('does not match the exponent of a number literal', () => {
    expect(extractRefs('=1E5')).toEqual([]);
  });

  it('does not detect bare named ranges', () => {
    expect(extractRefs('=TotalBudget')).toEqual([]);
  });

  it('returns empty for non-formula input', () => {
    expect(extractRefs('')).toEqual([]);
    expect(extractRefs(null)).toEqual([]);
    expect(extractRefs(undefined)).toEqual([]);
    expect(extractRefs('1240')).toEqual([]);
  });

  it('survives an unterminated quote without hanging', () => {
    expect(() => extractRefs("='Unclosed!A1")).not.toThrow();
    expect(() => extractRefs('="unclosed')).not.toThrow();
  });
});

describe('extractCrossSheetRefs', () => {
  it('keeps only references that point at another sheet', () => {
    expect(raws('=A1 + Summary!B2')).toEqual(['A1', 'Summary!B2']);
    expect(extractCrossSheetRefs('=A1 + Summary!B2').map((r) => r.raw)).toEqual(['Summary!B2']);
  });
});
