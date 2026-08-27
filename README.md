# GSheet++

**Google Sheets, enhanced.** A Chrome extension that fixes two things that get painful on large
spreadsheets:

1. **Crosshair** — highlights the entire row and column of the active cell, not just the headers, so
   you can see what else is on the same line. Configurable color and intensity, row and column
   toggled independently.
2. **Reference jump** — hold a modifier and the references in the formula bar (`='Q3 Forecast'!E40`)
   become clickable links that take you straight to the referenced cell, in the right tab. A jump-back
   shortcut retraces your steps.

## Install (unpacked)

```bash
npm install
npm run build
```

Then in Chrome: **chrome://extensions** → enable **Developer mode** → **Load unpacked** → select the
`dist/` folder. Open any spreadsheet; the crosshair appears immediately.

## Use

| Action | How |
| --- | --- |
| Toggle row / column highlight | Click the GSheet++ toolbar icon |
| Change color and intensity | Toolbar icon, or **All settings…** |
| Show reference links | Hold <kbd>Alt</kbd> / <kbd>⌥</kbd> over the formula bar |
| Jump to a reference | Hold the modifier and click the underlined reference |
| Jump back | <kbd>⌥</kbd><kbd>⇧</kbd><kbd>[</kbd> (rebindable), or the browser Back button — see [Known issues](#known-issues) |

## Development

```bash
npm run watch     # rebuild on change (reload the extension in Chrome to pick it up)
npm test          # unit tests
npm run build     # build the unpacked extension into dist/
```

### Releasing to the Chrome Web Store

```bash
npm run set-version -- 1.0.0   # updates src/manifest.json AND package.json
npm run package                # -> releases/gsheet-plus-plus-v1.0.0.zip
```

Then upload that zip at the
[developer console](https://chrome.google.com/webstore/devconsole). Privacy policy URL:
https://gist.github.com/nanlulu/f1ba986958e29ddda69007600d9a2ae6

Two directories, two jobs:

| | |
| --- | --- |
| `dist/` | The unpacked build. This is what you point **Load unpacked** at. Wiped and rebuilt on every `npm run build`. |
| `releases/` | One zip per version, for store uploads. Never touched by a build. |

Both are gitignored. `releases/` is kept out of git so the repo does not accumulate binaries —
attach a zip to a GitHub Release if you want it shared.

`npm run package` **refuses to overwrite a zip that already exists**, because once a version has been
uploaded its bytes should stay fixed. Bump the version instead, or pass `--force` if you genuinely
mean to replace an unreleased build:

```bash
npm run package -- --force
```

It also refuses to run if `src/manifest.json` and `package.json` disagree on the version (use
`set-version`, which writes both), and verifies the finished archive has `manifest.json` at its root
with no `.DS_Store` or source maps — Chrome rejects packages that get either wrong.

### Layout

```
src/content/   in-page logic: selectors, geometry, crosshair, formula-bar links, navigation
src/lib/       pure logic: A1 notation, formula reference parsing, settings schema
src/ui/        popup and options pages
scripts/       build, package, set-version, icon generation, DOM probes
test/          unit tests (vitest; jsdom for the DOM-facing modules)

dist/          unpacked build — load this in Chrome        (gitignored)
releases/      one zip per version, for store uploads      (gitignored)
```

### How it works

Google Sheets renders the grid to `<canvas>`, so there are no per-cell DOM elements to attach to.
GSheet++ works around this in two ways:

- **The crosshair** reads the bounding rect of `.active-cell-border` — a real DOM element Sheets
  positions over the active cell — and paints two fixed-position bands clipped to the grid viewport.
  Row heights and column widths never have to be computed. Bands blend with `mix-blend-mode:
  multiply` so text and existing cell fills stay readable underneath.
- **The jump** reads the formula from the formula bar (which is real DOM text), extracts references
  with a hand-written parser, and navigates by setting `location.hash` to `#gid=<gid>&range=<A1>` —
  the same mechanism behind Sheets' own "link to this cell", which moves without a page reload. The
  sheet name → gid map comes from the tab strip. Hidden sheets have no tab, so those fall back to
  typing the reference into the name box.

Reference links are drawn as transparent hotspots positioned with `Range.getClientRects()`. The
formula bar's own DOM is never modified — it is a live editing surface, and rewriting it would break
Sheets' editing behaviour.

## Troubleshooting

Google changes the Sheets page structure from time to time, and GSheet++ depends on it. Everything is
built to fail quietly — a missing element disables a feature rather than breaking your spreadsheet.

If the highlight or the links stop appearing:

1. Open a sheet, open DevTools, and run `__gspp.diagnose()` in the console. (Or turn on
   **Log selector diagnostics** in settings and reload.)
2. Anything reported as `MISSING` is the selector that needs updating.
3. Paste `scripts/probe.js` into the console for a fuller report of what the page looks like now.
4. Fix the candidate chain in **`src/content/selectors.js`** — by design, that is the only file that
   touches Sheets' own DOM, so it is the only one that should need changing.

## Status

Verified working against a live spreadsheet (2026-08-17):

- ✅ Row and column crosshair, with live color/intensity/toggle changes
- ✅ Reference links in the formula bar, and jumping to the referenced cell across tabs
- ⚠️ Jump-back shortcut — default changed after the original one turned out to be
  browser-reserved; the new binding is **untested on a live page**. See below.

## Known issues

### Jump-back shortcut: default rebound, needs confirming

The original default, <kbd>⌘</kbd><kbd>⇧</kbd><kbd>[</kbd>, never fired. Cause confirmed: on macOS
that is Chrome's own **"previous tab"** shortcut, so the browser consumed it before the page ever saw
a `keydown` — which is why it failed silently rather than erroring.

The default is now <kbd>⌥</kbd><kbd>⇧</kbd><kbd>[</kbd>, which keeps the `[` = back mnemonic while
avoiding <kbd>⌘</kbd> entirely. `isReservedHotkey()` in `src/ui/hotkeyLabel.js` now rejects
browser-reserved combinations in the settings UI, so this cannot be re-introduced silently.

**This has not yet been confirmed on a live page.** If it still does not fire:

1. The old value may be persisted. Open settings and rebind explicitly — a stored setting overrides
   the shipped default.
2. Check `matchesHotkey()` in `src/lib/settings.js`; it compares `event.code`, so verify the code your
   key actually produces.
3. Check the `isEditing()` guard in `onHotkey` (`src/content/index.js`). That guard silently disabled
   a feature once already — confirm it reads false when you press the key.

**Workaround either way: the browser's Back button.** It works well, because jumps navigate by
changing the URL fragment, so each one leaves a real history entry.

### Other limitations

- **Bare named ranges are not detected.** `='Q3 Forecast'!E40` works; `=TotalBudget` does not. An
  unqualified identifier is indistinguishable from a function name without a full function table, and
  guessing would underline nonsense.
- **The first jump to a given sheet is slower than later ones.** No tab exposes a gid, so GSheet++
  discovers it by clicking the tab and reading the URL, then caches it. See
  [docs/sheets-dom.md](docs/sheets-dom.md).
- Jumping into a **hidden sheet** uses the name box, which is more fragile than the hash route. This
  path has not been exercised against a live sheet.
- The bands paint over the frozen-pane divider shadow. Spanning frozen columns is intentional.

## Privacy

GSheet++ collects nothing, sends nothing, and has no server. See [PRIVACY.md](PRIVACY.md).

## License

MIT
