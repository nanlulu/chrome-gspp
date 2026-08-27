/*
 * GSheet++ reference-jump probe. NOT shipped in the extension.
 *
 * Self-contained on purpose: it depends on nothing from GSheet++, so it can be
 * pasted directly into the DevTools console without switching the console's
 * execution context away from the page's main world.
 *
 * Usage: select a cell containing a cross-tab formula (e.g. ='Q3 Forecast'!E40),
 * then paste this whole file into the console and send the output back.
 */
(() => {
  const out = (label, value) => console.log(`%c${label}`, 'font-weight:bold', value);
  console.group('%cGSheet++ jump probe', 'font-weight:bold;font-size:14px');

  // 1. Formula bar — the candidate chain GSheet++ currently tries, in order.
  const FORMULA_CANDIDATES = [
    '#t-formula-bar-input .cell-input',
    '#t-formula-bar-input',
    '.formula-bar-input-container .cell-input',
    '#formula-bar-input',
    '.formula-bar-input',
    '[aria-label*="Formula bar" i]',
  ];
  console.group('1. formula bar candidates');
  let formulaHit = null;
  for (const sel of FORMULA_CANDIDATES) {
    const nodes = document.querySelectorAll(sel);
    const first = nodes[0];
    const text = first ? (first.value !== undefined ? first.value : first.textContent) : null;
    console.log(nodes.length ? '✅' : '❌', sel, nodes.length ? { count: nodes.length, text } : '');
    if (!formulaHit && first) formulaHit = first;
  }
  out('resolved formula bar:', formulaHit || 'NONE — this alone breaks the feature');
  console.groupEnd();

  // 2. Structural scan — every editable control in the top strip. If the chain
  //    above missed, the right selector is almost certainly in here.
  console.group('2. editable controls in the top 260px');
  const controls = document.querySelectorAll('[contenteditable="true"], input, textarea');
  const rows = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.top > 260) continue;
    const text = (el.value !== undefined ? el.value : el.textContent) || '';
    rows.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      class: String(el.className || '').slice(0, 60),
      aria: el.getAttribute('aria-label') || '',
      rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
      text: text.slice(0, 60),
      startsWithEquals: text.trim().startsWith('='),
    });
  }
  console.table(rows);
  console.log('Look for the row whose text is your formula. Its id/class is the selector we need.');
  console.groupEnd();

  // 3. Name box — the navigation fallback target.
  console.group('3. name box candidates');
  for (const sel of ['#t-name-box', '.waffle-name-box input', '.waffle-name-box', 'input[aria-label*="Name box" i]']) {
    const el = document.querySelector(sel);
    console.log(el ? '✅' : '❌', sel, el ? { tag: el.tagName, value: el.value, editable: el.isContentEditable } : '');
  }
  console.groupEnd();

  // 4. Sheet tabs -> gid, for hash navigation.
  console.group('4. sheet tabs and gids');
  const tabs = document.querySelectorAll('.docs-sheet-tab, [id^="sheet-button-"]');
  if (!tabs.length) console.warn('❌ no sheet tabs matched');
  const tabRows = [];
  tabs.forEach((el) => {
    const nameEl = el.querySelector('.docs-sheet-tab-name') || el;
    tabRows.push({
      name: (nameEl.textContent || '').trim(),
      id: el.id || '(none)',
      gid: (/(?:sheet-button-)(-?\d+)/.exec(el.id || '') || [])[1] || 'NOT IN ID',
      dataset: JSON.stringify({ ...el.dataset }).slice(0, 80),
    });
  });
  console.table(tabRows);
  out('current URL hash:', location.hash || '(empty)');
  console.groupEnd();

  // 5. What GSheet++ would extract from the formula it can see.
  console.group('5. reference parsing');
  const text = formulaHit
    ? (formulaHit.value !== undefined ? formulaHit.value : formulaHit.textContent) || ''
    : '';
  out('formula text seen:', JSON.stringify(text));
  if (!text) {
    console.warn('No formula text. Select a cell that contains a formula, then re-run.');
  } else if (!text.trim().startsWith('=')) {
    console.warn('That text is not a formula — GSheet++ will find no references in it.');
  } else {
    // Same shape as src/lib/refParser.js, inlined so this file stays standalone.
    const re = /('(?:[^']|'')*'|[A-Za-z0-9_]+)!(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)/g;
    const found = [...text.matchAll(re)].map((m) => m[0]);
    out('cross-sheet references found:', found.length ? found : 'NONE');
  }
  console.groupEnd();

  // 6. Is the extension actually running on this page?
  console.group('6. extension presence');
  console.log(
    'GSheet++ overlay root present:',
    Boolean(document.getElementById('gspp-root')),
    '(true = content script is running; the crosshair proves this too)',
  );
  console.log(
    'Note: __gspp is defined in the extension\'s isolated world. To call it, switch the\n'
    + 'console context dropdown (top-left, currently "top") to "GSheet++", then run __gspp.debugJump()',
  );
  console.groupEnd();

  console.groupEnd();
  return 'probe complete — please copy the output above';
})();
