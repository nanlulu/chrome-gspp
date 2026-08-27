// Generate Chrome Web Store screenshots at 1280x800.
//
//   npm run screenshots
//
// These are MOCKS, not captures of a live spreadsheet: rendering real Google
// Sheets would require signing in, and the sheet this was developed against
// holds internal forecast data that must not be published. The mock uses the
// extension's real default colors and overlay CSS, so it depicts the product
// honestly — but replace it with a real capture when convenient.
//
// All figures below are invented.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Pull the band colour from the shipped defaults rather than restating it, so a
// screenshot can never advertise a colour the extension does not actually use.
import { DEFAULTS, toRgba } from '../src/lib/settings.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/store');
const tmpDir = resolve(root, 'node_modules/.cache/gspp-screenshots');

const CHROME = process.env.CHROME
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// --- the mock spreadsheet -------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SECTIONS = [
  { label: 'COMPUTE', rows: [
    ['Application servers', 42800, 0.03],
    ['Batch processing', 18400, 0.05],
    ['Dev & staging', 9600, 0.01],
  ] },
  { label: 'STORAGE', rows: [
    ['Object storage', 27300, 0.04],
    ['Block volumes', 12750, 0.02],
    ['Backup & archive', 6180, 0.015],
  ] },
  { label: 'NETWORK', rows: [
    ['Egress transit', 31200, 0.06],
    ['Load balancing', 4900, 0.01],
    ['Private links', 3450, 0.005],
  ] },
  { label: 'PLATFORM', rows: [
    ['Managed database', 22400, 0.035],
    ['Message queue', 7650, 0.02],
    ['Observability', 11900, 0.025],
  ] },
  { label: 'LICENCES', rows: [
    ['Analytics suite', 15000, 0 ],
    ['Security tooling', 8800, 0.01],
    ['Support contract', 19500, 0],
  ] },
];

const money = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** Build the row model: section headers, line items, and a total row. */
function buildRows() {
  const rows = [];
  for (const section of SECTIONS) {
    rows.push({ kind: 'section', label: section.label });
    for (const [label, base, growth] of section.rows) {
      rows.push({
        kind: 'item',
        label,
        values: MONTHS.map((_, i) => Math.round(base * (1 + growth * i))),
      });
    }
  }
  const items = rows.filter((r) => r.kind === 'item');
  rows.push({
    kind: 'total',
    label: 'Total spend',
    values: MONTHS.map((_, i) => items.reduce((sum, r) => sum + r.values[i], 0)),
  });
  return rows;
}

// Active cell: column G (Jun) on the "Egress transit" line.
const ACTIVE_COL = 7; // 1-based across data columns: A=label, B..M = months
const ACTIVE_ROW_LABEL = 'Egress transit';

function html({ showLink }) {
  const rows = buildRows();
  const activeRowIndex = rows.findIndex((r) => r.label === ACTIVE_ROW_LABEL);

  const LABEL_W = 196;
  const COL_W = 74;
  const ROWNUM_W = 44;
  const ROW_H = 23;
  const TAB_H = 36;
  const GRID_TOP = 34 + 26; // formula bar + column header

  // A real sheet does not stop at the last row of data — pad with empty rows so
  // the grid reaches the tab bar, and add a trailing column so it reaches the
  // right edge. Without these the mock reads as a cropped table on white.
  const gridHeight = 800 - GRID_TOP - TAB_H;
  const fillerCount = Math.max(0, Math.ceil(gridHeight / ROW_H) - rows.length);
  for (let i = 0; i < fillerCount; i += 1) rows.push({ kind: 'empty', label: '' });

  const TRAIL_W = 1280 - ROWNUM_W - LABEL_W - 13 * COL_W;
  const colLetters = ['A', ...MONTHS.map((_, i) => String.fromCharCode(66 + i)), 'N', 'O'];
  const widthOf = (i) => {
    if (i === 0) return LABEL_W;
    return i === colLetters.length - 1 ? TRAIL_W : COL_W;
  };

  const headerCells = colLetters
    .map((letter, i) => {
      const active = i === ACTIVE_COL ? ' active' : '';
      return `<div class="ch${active}" style="width:${widthOf(i)}px">${letter}</div>`;
    })
    .join('');

  const bodyRows = rows
    .map((row, i) => {
      const n = i + 1;
      const active = i === activeRowIndex ? ' active' : '';
      const cells = [
        `<div class="cell label ${row.kind}" style="width:${LABEL_W}px">${row.label}</div>`,
        ...MONTHS.map((_, ci) => {
          const v = row.values ? row.values[ci] : null;
          const isActive = i === activeRowIndex && ci + 1 === ACTIVE_COL;
          return `<div class="cell num ${row.kind}${isActive ? ' activecell' : ''}" style="width:${COL_W}px">${
            v === null || v === undefined ? '' : money(v)
          }</div>`;
        }),
        `<div class="cell num ${row.kind}" style="width:${COL_W}px">${
          row.values ? money(row.values.reduce((a, b) => a + b, 0)) : ''
        }</div>`,
        `<div class="cell ${row.kind}" style="width:${TRAIL_W}px"></div>`,
      ].join('');
      return `<div class="row"><div class="rh${active}" style="width:${ROWNUM_W}px">${n}</div>${cells}</div>`;
    })
    .join('');

  const gridTop = GRID_TOP;
  const bandTop = gridTop + activeRowIndex * ROW_H;
  const bandLeft = ROWNUM_W + LABEL_W + (ACTIVE_COL - 1) * COL_W;

  const formula = "='Q3 Forecast'!E40";
  const formulaHtml = showLink
    ? `=<span class="tok">SUM</span>(<span class="reflink">'Q3 Forecast'!E40</span>, <span class="reflink">'Regional Detail'!B12</span>)`
    : `${formula.slice(0, 1)}<span class="ref">${formula.slice(1)}</span>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font: 12px/1 Roboto, Arial, "Helvetica Neue", sans-serif;
    color: #202124; background: #fff; position: relative;
    -webkit-font-smoothing: antialiased;
  }

  /* --- formula bar --- */
  .fbar {
    height: 34px; display: flex; align-items: center; gap: 10px;
    padding: 0 10px; border-bottom: 1px solid #e1e3e1; background: #fff;
  }
  .namebox {
    width: 96px; height: 22px; border: 1px solid #dadce0; border-radius: 3px;
    display: flex; align-items: center; padding: 0 8px; font-size: 12px; color: #202124;
  }
  .fx { color: #5f6368; font-style: italic; font-size: 13px; padding: 0 4px; }
  .finput { flex: 1; font-size: 12.5px; color: #202124; font-family: Roboto, Arial, sans-serif; }
  .ref { color: #188038; }
  .tok { color: #a142f4; }
  .reflink {
    color: #188038; border-bottom: 2px solid #1a73e8;
    background: rgba(26,115,232,0.12); border-radius: 2px; padding: 1px 1px 0;
  }

  /* --- headers + grid --- */
  .chrow { display: flex; height: 26px; background: #f8f9fa; border-bottom: 1px solid #e1e3e1; }
  .corner { width: 44px; border-right: 1px solid #e1e3e1; background: #f8f9fa; }
  .ch {
    display: flex; align-items: center; justify-content: center;
    border-right: 1px solid #e1e3e1; color: #444746; font-size: 11px; font-weight: 500;
  }
  .ch.active { background: #d3e3fd; color: #0b57d0; font-weight: 700; }

  .row { display: flex; height: 23px; }
  .rh {
    display: flex; align-items: center; justify-content: center;
    background: #f8f9fa; border-right: 1px solid #e1e3e1; border-bottom: 1px solid #e1e3e1;
    color: #444746; font-size: 11px;
  }
  .rh.active { background: #d3e3fd; color: #0b57d0; font-weight: 700; }
  .cell {
    display: flex; align-items: center; padding: 0 7px;
    border-right: 1px solid #e1e3e1; border-bottom: 1px solid #e1e3e1;
    overflow: hidden; white-space: nowrap;
  }
  .label { justify-content: flex-start; }
  .num { justify-content: flex-end; font-variant-numeric: tabular-nums; }
  .empty { }
  .section { font-weight: 700; color: #5f6368; font-size: 10.5px; letter-spacing: .06em; background: #f8f9fa; }
  .total { font-weight: 700; border-top: 2px solid #bdc1c6; }

  /* --- GSheet++ overlay: colour comes from the shipped DEFAULTS --- */
  .band { position: absolute; mix-blend-mode: multiply; pointer-events: none; background: ${
    toRgba(DEFAULTS.color, DEFAULTS.opacity)
  }; }
  .activecell {
    position: relative; box-shadow: inset 0 0 0 2px #1a73e8; background: #fff;
  }
  .handle {
    position: absolute; width: 6px; height: 6px; background: #1a73e8;
    border: 1px solid #fff; border-radius: 1px;
  }

  /* --- sheet tabs --- */
  .tabs {
    position: absolute; left: 0; right: 0; bottom: 0; height: 36px;
    display: flex; align-items: center; gap: 2px; padding: 0 10px;
    background: #f8f9fa; border-top: 1px solid #e1e3e1;
  }
  .tab {
    height: 26px; display: flex; align-items: center; padding: 0 12px;
    font-size: 11.5px; color: #444746; border-radius: 4px 4px 0 0;
  }
  .tab.on { background: #fff; color: #0b57d0; font-weight: 600; box-shadow: 0 -1px 0 #e1e3e1 inset; }

  .tip {
    position: absolute; background: #202124; color: #fff; font-size: 11px;
    padding: 5px 9px; border-radius: 4px; white-space: nowrap;
  }
  .cursor { position: absolute; width: 17px; height: 23px; }
</style></head><body>

  <div class="fbar">
    <div class="namebox">${String.fromCharCode(65 + ACTIVE_COL)}${activeRowIndex + 1}</div>
    <div class="fx">fx</div>
    <div class="finput">${formulaHtml}</div>
  </div>

  <div class="chrow"><div class="corner"></div>${headerCells}</div>
  ${bodyRows}

  <!-- GSheet++ bands -->
  <div class="band" style="left:${ROWNUM_W}px; top:${bandTop}px; width:${1280 - ROWNUM_W}px; height:${ROW_H}px"></div>
  <div class="band" style="left:${bandLeft}px; top:${gridTop}px; width:${COL_W}px; bottom:36px"></div>
  <div class="handle" style="left:${bandLeft + COL_W - 3}px; top:${bandTop + ROW_H - 3}px"></div>

  ${showLink ? `
    <div class="tip" style="left:250px; top:44px">Jump to 'Q3 Forecast'!E40</div>
    <svg class="cursor" style="left:232px; top:26px" viewBox="0 0 17 23">
      <path d="M1 1l14 10.5-6 .8 3.4 7-2.9 1.3-3.3-7L1 18z" fill="#fff" stroke="#202124" stroke-width="1.4"/>
    </svg>` : ''}

  <div class="tabs">
    <div class="tab">Summary</div>
    <div class="tab on">Budget 2026</div>
    <div class="tab">Q3 Forecast</div>
    <div class="tab">Regional Detail</div>
    <div class="tab">Assumptions</div>
  </div>
</body></html>`;
}

// --- render ---------------------------------------------------------------

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const shots = [
  { name: 'screenshot-1-crosshair', showLink: false },
  { name: 'screenshot-2-reference-jump', showLink: true },
];

for (const shot of shots) {
  const file = resolve(tmpDir, `${shot.name}.html`);
  writeFileSync(file, html(shot));
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1280,800',
    `--screenshot=${resolve(outDir, `${shot.name}.png`)}`,
    `file://${file}`,
  ], { stdio: 'ignore' });
  console.log(`wrote docs/store/${shot.name}.png`);
}

console.log('\n1280x800, ready to upload. Mocked data — replace with a real capture when convenient.');
