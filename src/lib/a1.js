// A1-notation helpers. Pure functions, no DOM — unit tested in test/a1.test.js.

const BARE_SHEET_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LOOKS_LIKE_CELL = /^\$?[A-Za-z]{1,3}\$?\d+$/;
const RESERVED = new Set(['TRUE', 'FALSE']);

/**
 * A sheet name only needs quoting when it would otherwise be ambiguous: it has
 * spaces or punctuation, it starts with a digit, or it happens to look like a
 * cell reference or a literal. 'Q3 Forecast' needs quotes; Summary does not.
 */
export function needsQuoting(name) {
  if (!BARE_SHEET_NAME.test(name)) return true;
  if (LOOKS_LIKE_CELL.test(name)) return true;
  return RESERVED.has(name.toUpperCase());
}

/** Wrap a sheet name in single quotes if required, doubling any inner quote. */
export function quoteSheetName(name) {
  if (!needsQuoting(name)) return name;
  return `'${String(name).replace(/'/g, "''")}'`;
}

/** Inverse of quoteSheetName: strip surrounding quotes and unescape ''. */
export function unquoteSheetName(raw) {
  if (typeof raw !== 'string') return '';
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  return raw;
}

/** Render {sheet, range} back to a string Sheets accepts in the name box. */
export function formatRef({ sheet, range }) {
  return sheet ? `${quoteSheetName(sheet)}!${range}` : range;
}

/**
 * Split a reference into {sheet, range} at the sheet separator. Splits at the
 * LAST unquoted '!' so that sheet names containing '!' survive the round trip.
 */
export function parseRef(text) {
  if (typeof text !== 'string') return { sheet: null, range: '' };
  let inQuotes = false;
  let split = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") {
      // '' inside a quoted name is an escaped quote, not a terminator.
      if (inQuotes && text[i + 1] === "'") { i += 1; continue; }
      inQuotes = !inQuotes;
    } else if (ch === '!' && !inQuotes) {
      split = i;
    }
  }
  if (split === -1) return { sheet: null, range: text };
  return {
    sheet: unquoteSheetName(text.slice(0, split)),
    range: text.slice(split + 1),
  };
}

/** Column letters to a 1-based index: A -> 1, Z -> 26, AA -> 27. */
export function colToIndex(letters) {
  let n = 0;
  const upper = String(letters).replace(/\$/g, '').toUpperCase();
  for (const ch of upper) {
    const code = ch.charCodeAt(0) - 64;
    if (code < 1 || code > 26) return 0;
    n = n * 26 + code;
  }
  return n;
}

/** Inverse of colToIndex: 1 -> A, 27 -> AA. */
export function indexToCol(index) {
  let n = Math.floor(index);
  if (!(n > 0)) return '';
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
