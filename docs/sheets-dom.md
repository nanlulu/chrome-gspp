# Google Sheets DOM notes

What GSheet++ depends on inside the Sheets page, and what was actually observed rather than guessed.

**Status: confirmed against a live spreadsheet on 2026-08-17.** Both features work. Every entry below
was verified in the browser, not inferred.

## How to refresh this document

1. Open a real spreadsheet with several tabs, one containing a cross-sheet formula.
2. Select a cell whose formula references another tab.
3. Paste `scripts/probe.js` (general DOM) or `scripts/probe-jump.js` (reference jump) into the
   DevTools console. `probe-jump.js` is self-contained and runs in the page's main world.
4. For the extension's own view, switch the console context dropdown from `top` to **GSheet++**, then run
   `__gspp.diagnose()` or `__gspp.debugJump()`.

## Confirmed findings

| Lookup | What is actually there | Notes |
| --- | --- | --- |
| Active cell | `.active-cell-border`, **four separate 1px edge divs** | Not one box. `querySelector` returns the top edge — full cell width, ~1px tall — which renders the row band as a hairline while the column band looks fine. `activeCellRect()` unions all matches. Do not reduce this to a single lookup. |
| Cell editor | `#waffle-rich-text-editor`, class `cell-input` | **Both the editor and the always-focused keystroke sink.** Observed idle, mid-navigation: `rect "4,-9998 0x30"`, `contentEditable true`, focused. See "Detecting edit mode" below — this element broke `isEditing()` three times. |
| Formula bar | `#t-formula-bar-input .cell-input` | Resolves. Text is readable without entering edit mode. A structural fallback also exists (an editable control in the top ~220px whose text starts with `=`). |
| Name box | `#t-name-box` | Used as the last-resort navigation route. |
| Sheet tabs | `.docs-sheet-tab` with `.docs-sheet-tab-name` | Names resolve correctly, including separator-style tabs such as `SECTION ->`. |
| Sheet **gid** | **Not exposed on the tab at all** | Every tab reported `gid null`. Hash navigation therefore cannot work from a cold start. See "Navigating without gids". |
| Hash navigation | `#gid=<gid>&range=<A1>` | Works, and moves without a page reload — but only once a gid is known. |

## Detecting edit mode

The single most error-prone part of this codebase. `#waffle-rich-text-editor` is simultaneously the
cell editor *and* the input sink that holds focus whenever the grid has focus. Three definitions of
`isEditing()` were tried and the first three were all permanently `true`, which silently disabled the
reference links and the jump-back hotkey:

1. ❌ "a visible contenteditable exists" — matches the formula bar, which is always contenteditable.
2. ❌ "focus is inside the formula bar or an editable" — the sink always has focus.
3. ❌ "focus is inside a dedicated editor element" — the sink *is* the dedicated editor element.
4. ✅ **"the focused editor is actually laid out on screen"** — Sheets parks the editor off-screen at
   zero width (`top -9998, width 0`) when idle and moves it over the cell during a real edit.

**Any future change here must be tested against both states**, not just reasoned about. `isEditing()`
returning true in the idle state disables the whole reference-jump feature with no visible error.

## Navigating without gids

Because no tab exposes a gid, `jumpTo()` runs a three-step strategy:

1. **Known gid → hash navigation.** Fastest; no page reload.
2. **Unknown gid → click the tab**, wait for Sheets to write the gid into the URL, then position with
   hash navigation. This needs no prior knowledge, and the gid it discovers is cached in
   `learnedGids`, so repeat jumps to that sheet take route 1. First jump to a given sheet is
   therefore slightly slower.
3. **No tab with that name → name box.** Covers hidden sheets and named ranges.

## Design rules that follow

- **Only `src/content/selectors.js` may query Sheets' own DOM.** Everything else asks it. Breakage
  stays a one-file fix.
- **Every lookup returns null instead of throwing.** A wrong selector degrades GSheet++ to a no-op; it
  must never break the spreadsheet.
- **Overlays attach to `document.body`**, never to Sheets' containers, which reconcile their children
  and delete foreign nodes.
- **The formula bar's DOM is never modified.** It is a live editing surface; hotspots float on top,
  positioned with `Range.getClientRects()`.
- **Never guess a gid from an arbitrary number.** Returning null and falling back is correct;
  navigating to the wrong sheet is not.

## Re-check after any Sheets redesign

- Is `.active-cell-border` still four elements? `__gspp.diagnose()` reports `activeCellElements` and
  `activeCellRect` — a height collapsing to ~1px means the union broke.
- Does the idle editor still sit off-screen at zero width? If Sheets starts parking it on-screen,
  `isEditing()` needs a new discriminator.
- Do tabs still hide the gid? If a future build exposes one, route 1 applies immediately.
- Does `mix-blend-mode: multiply` still read well, including over dark cell fills?
