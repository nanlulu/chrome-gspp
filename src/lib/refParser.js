// Extract A1-style cell/range references from a formula string.
//
// Returns character offsets alongside each reference because the formula-bar
// link layer needs them to place a DOM Range over the exact text.
//
// Deliberate limitation: bare named ranges (e.g. `=TotalBudget`) are NOT
// detected. An unqualified identifier is indistinguishable from a function name
// without a full function table, and false positives here would underline
// nonsense. Sheet-qualified references — the cross-tab case this feature exists
// for — are detected in full.

import { unquoteSheetName } from './a1.js';

// Ordered longest-first so `A1:B5` wins over `A1`.
const RANGE_PATTERNS = [
  /\$?[A-Za-z]{1,3}\$?\d+:\$?[A-Za-z]{1,3}\$?\d+/y, // A1:B5
  /\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}/y, // A:A  (whole column)
  /\$?\d+:\$?\d+/y, // 1:1  (whole row)
  /\$?[A-Za-z]{1,3}\$?\d+/y, // A1
];

// Unqualified sheet names may use any script (CJK, accented Latin, ...), so
// match by Unicode property rather than a literal codepoint range. Writing the
// range out longhand once embedded U+FFFF — a Unicode noncharacter that is
// valid UTF-8 but that Chrome's extension loader rejects outright.
const BARE_SHEET = /[\p{L}\p{N}_]+/uy;

// A reference cannot begin partway through a longer identifier or number.
const BOUNDARY_BEFORE = /[A-Za-z0-9_$.!']/;
// ...nor end partway through one.
const BOUNDARY_AFTER = /[A-Za-z0-9_]/;

function matchRange(text, at) {
  for (const pattern of RANGE_PATTERNS) {
    pattern.lastIndex = at;
    const m = pattern.exec(text);
    if (m) return { range: m[0], end: pattern.lastIndex };
  }
  return null;
}

/** Consume a quoted sheet name starting at `at`, honouring '' escapes. */
function matchQuotedSheet(text, at) {
  if (text[at] !== "'") return null;
  let i = at + 1;
  while (i < text.length) {
    if (text[i] === "'") {
      if (text[i + 1] === "'") { i += 2; continue; } // escaped quote
      return { raw: text.slice(at, i + 1), end: i + 1 };
    }
    i += 1;
  }
  return null; // unterminated
}

function matchBareSheet(text, at) {
  BARE_SHEET.lastIndex = at;
  const m = BARE_SHEET.exec(text);
  if (!m) return null;
  return { raw: m[0], end: BARE_SHEET.lastIndex };
}

/** Skip over a "quoted string", honouring "" escapes. Returns index after it. */
function skipStringLiteral(text, at) {
  let i = at + 1;
  while (i < text.length) {
    if (text[i] === '"') {
      if (text[i + 1] === '"') { i += 2; continue; }
      return i + 1;
    }
    i += 1;
  }
  return text.length; // unterminated
}

function tryMatchAt(text, at) {
  // Quoted sheet name: 'Q3 Forecast'!E40
  const quoted = matchQuotedSheet(text, at);
  if (quoted && text[quoted.end] === '!') {
    const range = matchRange(text, quoted.end + 1);
    if (range) {
      return { sheetRaw: quoted.raw, range: range.range, start: at, end: range.end };
    }
    return null;
  }
  if (quoted) return null; // a quoted string that isn't a sheet qualifier

  // Bare sheet name: Summary!A1
  const bare = matchBareSheet(text, at);
  if (bare && text[bare.end] === '!') {
    const range = matchRange(text, bare.end + 1);
    if (range) {
      return { sheetRaw: bare.raw, range: range.range, start: at, end: range.end };
    }
  }

  // Unqualified range on the current sheet: A1, B2:C9
  const range = matchRange(text, at);
  if (range) {
    return { sheetRaw: null, range: range.range, start: at, end: range.end };
  }
  return null;
}

/**
 * @param {string} formula e.g. "=SUM('Q3 Forecast'!E40, Actuals!B7)"
 * @returns {Array<{raw:string, sheet:string|null, range:string, start:number, end:number}>}
 */
export function extractRefs(formula) {
  if (typeof formula !== 'string' || formula.length === 0) return [];

  const refs = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    // Never look for references inside a string literal: ="see Sheet1!A1"
    if (ch === '"') {
      i = skipStringLiteral(formula, i);
      continue;
    }

    const prev = i > 0 ? formula[i - 1] : '';
    if (prev && BOUNDARY_BEFORE.test(prev)) {
      i += 1;
      continue;
    }

    const hit = tryMatchAt(formula, i);
    if (!hit) {
      i += 1;
      continue;
    }

    const after = formula[hit.end] || '';
    // `LOG10(` scans as column LOG + row 10; a trailing '(' means it is a
    // function call, not a reference.
    const isFunctionCall = after === '(';
    const runsIntoIdentifier = BOUNDARY_AFTER.test(after);

    if (isFunctionCall || runsIntoIdentifier) {
      i = hit.end;
      continue;
    }

    refs.push({
      raw: formula.slice(hit.start, hit.end),
      sheet: hit.sheetRaw === null ? null : unquoteSheetName(hit.sheetRaw),
      range: hit.range,
      start: hit.start,
      end: hit.end,
    });
    i = hit.end;
  }

  return refs;
}

/** References that point at another sheet — the ones worth jumping to. */
export function extractCrossSheetRefs(formula) {
  return extractRefs(formula).filter((ref) => ref.sheet !== null);
}
