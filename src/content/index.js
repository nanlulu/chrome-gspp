// GSheet++ content script entry point.
//
// Lifecycle: wait for the grid to exist, start both features, keep them in sync
// with settings, and re-resolve Sheets' DOM whenever the user switches tabs.

import { extractRefs } from '../lib/refParser.js';
import { loadSettings, matchesHotkey, onSettingsChanged } from '../lib/settings.js';
import { createCrosshair } from './crosshair.js';
import { createFormulaLinks } from './formulaBar.js';
import { jumpBack, jumpTo } from './navigate.js';
import * as sheets from './selectors.js';
import { toast } from './toast.js';

let settings = null;
const crosshair = createCrosshair();
const formulaLinks = createFormulaLinks({
  getSettings: () => settings,
  onJump: (ref) => {
    const result = jumpTo(ref);
    if (result.ok) toast(`→ ${ref.raw}`);
    else toast(result.message || `Could not jump to ${ref.raw}`);
  },
});

function onHotkey(event) {
  if (!settings?.enabled || !settings.jumpEnabled) return;
  if (!matchesHotkey(event, settings.jumpBackHotkey)) return;
  if (sheets.isEditing()) return;

  event.preventDefault();
  event.stopPropagation();
  const result = jumpBack();
  toast(result.message);
}

/** Sheets swaps out grid DOM on tab switch; drop caches and re-resolve. */
function onNavigation() {
  sheets.invalidate();
  crosshair.refresh();
  formulaLinks.refresh();
}

/** Wait for the grid to render before measuring anything. */
function whenGridReady(callback, attempt = 0) {
  if (sheets.activeCellRect() || sheets.gridViewportRect()) {
    callback();
    return;
  }
  if (attempt > 60) {
    callback(); // start anyway; the scheduler will pick the grid up later
    return;
  }
  setTimeout(() => whenGridReady(callback, attempt + 1), 250);
}

async function main() {
  settings = await loadSettings();

  whenGridReady(() => {
    crosshair.start(settings);
    formulaLinks.start();

    if (settings.debug) {
      console.log('[GSheet++] selector diagnosis:', sheets.diagnose());
    }
  });

  onSettingsChanged((next) => {
    const wasDebug = settings?.debug;
    settings = next;
    crosshair.setSettings(next);
    if (!next.debug || wasDebug) return;
    console.log('[GSheet++] selector diagnosis:', sheets.diagnose());
  });

  window.addEventListener('keydown', onHotkey, true);
  window.addEventListener('hashchange', onNavigation);

  // Expose manual diagnostics for troubleshooting selector breakage.
  window.__gspp = {
    diagnose: () => sheets.diagnose(),
    settings: () => settings,

    /**
     * Walk the reference-jump pipeline and report where it stops. Every gate
     * that can silently suppress the links is listed in order, so a failure
     * names itself instead of just doing nothing.
     */
    debugJump: () => {
      const bar = sheets.formulaBar();
      const text = sheets.formulaText();
      const refs = extractRefs(text);
      const report = {
        '1_enabled': settings?.enabled && settings?.jumpEnabled
          ? 'ok'
          : 'BLOCKED - enable GSheet++ and formula bar links in settings',
        '2_formulaBarFound': bar ? 'ok' : 'BLOCKED - formula bar selector missed',
        '3_formulaText': text || '(empty - select a cell containing a formula)',
        '4_referencesFound': refs.length
          ? refs.map((r) => r.raw)
          : 'BLOCKED - no references parsed from that text',
        // Note: run from the console, focus sits in DevTools rather than the
        // page, so this reads false even when it would block during real use.
        // The bail log printed when you hold the modifier is authoritative.
        '5_isEditing_unreliableFromConsole': sheets.isEditing(),
        '6_jumpModifier': settings?.jumpModifier,
        '7_sheetTabs': sheets.sheetTabs().map((t) => `${t.name} -> gid ${t.gid}`),
      };
      if (bar) report.formulaBarElement = bar;
      console.table(report);
      // Printed separately: console.table flattens nested objects to {}.
      console.log('[GSheet++] focus right now:', sheets.activeElementInfo());
      console.log('[GSheet++] first sheet tab, raw:', sheets.describeSheetTab());
      return report;
    },
  };
}

main();
