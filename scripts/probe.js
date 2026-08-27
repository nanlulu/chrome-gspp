/*
 * GSheet++ Step 0 — DOM discovery probe. NOT shipped in the extension.
 *
 * Usage: open a real Google Sheet, select a cell in a tab whose formula has a
 * cross-sheet reference, open DevTools, paste this whole file into the console.
 *
 * Copy the output into docs/sheets-dom.md, then reconcile any MISSING entries
 * with the candidate chains in src/content/selectors.js.
 */
(() => {
  const CANDIDATES = {
    activeCell: ['.active-cell-border', '.autofill-cover'],
    selectionRange: ['.selection-border', '.range-border', '.selected-range-border'],
    gridViewport: [
      '.grid-scrollable-wrapper',
      '#waffle-grid-container',
      '.waffle-grid-container',
      '.grid-container',
    ],
    columnHeaders: ['.column-headers-background', '.column-header-wrapper'],
    rowHeaders: ['.row-headers-background', '.row-header-wrapper'],
    nameBox: ['#t-name-box', '.waffle-name-box input', '.waffle-name-box', 'input[aria-label*="Name box" i]'],
    formulaBar: [
      '#t-formula-bar-input .cell-input',
      '#t-formula-bar-input',
      '.formula-bar-input-container .cell-input',
      '[aria-label*="Formula bar" i]',
    ],
    sheetTabs: ['.docs-sheet-tab', '[id^="sheet-button-"]'],
    bottomBar: ['#docs-sheet-container-bar', '.docs-sheet-container-bar'],
    editingCell: ['.cell-input[contenteditable="true"]', '.waffle-cell-editor'],
  };

  const describe = (el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '(none)',
      classes: el.className && el.className.baseVal !== undefined
        ? el.className.baseVal
        : String(el.className || '(none)').slice(0, 120),
      rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
      count: document.querySelectorAll(el.tagName.toLowerCase()).length,
    };
  };

  console.group('%cGSheet++ DOM probe', 'font-weight:bold;font-size:14px');

  const results = {};
  for (const [key, selectors] of Object.entries(CANDIDATES)) {
    let hit = null;
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length) {
        hit = { selector: sel, matches: nodes.length, ...describe(nodes[0]) };
        break;
      }
    }
    results[key] = hit || { selector: 'NONE MATCHED', tried: selectors.join(' | ') };
  }
  console.table(results);

  // How many elements form the active-cell outline: one box, or four edges?
  const activeCells = document.querySelectorAll('.active-cell-border');
  console.log('active-cell-border element count:', activeCells.length,
    '(1 = single box, 4 = separate edge divs — geometry.js must union them)');
  activeCells.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    console.log(`  [${i}]`, `${Math.round(r.left)},${Math.round(r.top)}`,
      `${Math.round(r.width)}x${Math.round(r.height)}`, el);
  });

  // Sheet tabs and their gids — needed for hash navigation.
  console.group('sheet tabs');
  const tabs = document.querySelectorAll('.docs-sheet-tab, [id^="sheet-button-"]');
  if (!tabs.length) console.warn('no sheet tabs matched — check the tab-strip selector');
  tabs.forEach((el) => {
    const nameEl = el.querySelector('.docs-sheet-tab-name') || el;
    console.log({
      name: (nameEl.textContent || '').trim(),
      id: el.id || '(none)',
      gid: (/(?:sheet-button-)(-?\d+)/.exec(el.id || '') || [])[1] || 'NOT IN ID',
      dataset: { ...el.dataset },
    });
  });
  console.log('current gid from URL:', /gid=(\d+)/.exec(location.hash + location.search)?.[1] || '(none)');
  console.groupEnd();

  // Formula bar text structure — one text node, or many spans?
  console.group('formula bar');
  const fb = document.querySelector('#t-formula-bar-input .cell-input')
    || document.querySelector('#t-formula-bar-input');
  if (!fb) {
    console.warn('formula bar not found — check the candidate chain');
  } else {
    console.log('element:', fb);
    console.log('textContent:', JSON.stringify(fb.textContent));
    console.log('value:', fb.value);
    console.log('child nodes:', fb.childNodes.length);
    fb.childNodes.forEach((n, i) => console.log(`  [${i}]`, n.nodeName, JSON.stringify(n.textContent)));
    console.log('IMPORTANT: if text is split across spans, formulaBar.js must walk',
      'text nodes to map character offsets -> DOM Range.');
  }
  console.groupEnd();

  // Name box — the navigation fallback target.
  console.group('name box');
  const nb = document.querySelector('#t-name-box') || document.querySelector('.waffle-name-box');
  console.log('element:', nb);
  if (nb) console.log('tag:', nb.tagName, 'value:', nb.value, 'contentEditable:', nb.isContentEditable);
  console.groupEnd();

  console.log('%cNext: paste this output into docs/sheets-dom.md and reconcile any',
    'color:#888', 'NONE MATCHED rows with src/content/selectors.js');
  console.groupEnd();

  return results;
})();
