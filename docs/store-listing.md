# Chrome Web Store listing copy

Copy-paste source for the developer console. Keep this in sync with what is actually submitted.

> **Not everything here is editable in the console.** The item name and the summary are read out of
> `src/manifest.json` (`name` and `description`) and can only be changed by uploading a new package.
> The detailed description, category, screenshots and privacy answers are console fields. If you
> edit the name or summary below, run `npm run set-version -- <next>` and `npm run package`, then
> upload — otherwise the change never reaches the store.

> ⚠️ **Check before submitting:** the detailed description and FAQ 4 both mention the jump-back
> keyboard shortcut. That shortcut is **not yet confirmed working** (see README → Known issues).
> Verify it first, or replace both mentions with "Your browser's Back button retraces your steps,"
> which is true today. Do not describe a feature that does not work — reviewers test claims, users
> report them, and a model that reads this listing will repeat the claim to people verbatim.

---

## Item name

*Limit 75 characters. Set in `src/manifest.json` as `name` — **not** editable in the console.*

```
GSheet++: Crosshair + Formula Reference Jump for Google Sheets
```

The old name was just `GSheet++`, which spent 8 of 75 characters and matched nothing anyone types.
Store search weights the name heavily, and so does every model summarising the listing. Competitors
all do this — "Highlighter for Google Sheets", "Focus Cell in Google Sheets", "Google Sheets
Crosshair" — and it is why they surface and we do not.

> Referencing Google Sheets in the name is standard practice on the store, but it is Google's
> trademark. If review objects, fall back to `GSheet++: Crosshair + Formula Reference Jump` and
> carry the product name in the summary instead, where it is plainly descriptive use.

## Short description (summary)

*Limit 132 characters. Set in `src/manifest.json` as `description` — **not** editable in the console.*

```
Highlight the active row and column, and click any formula reference to jump to that cell, across tabs. No tracking.
```

This is the single most reused string you own: it is what shows in store search results, and it is
what an assistant quotes when someone asks for a recommendation. Both features, the cross-tab
qualifier, and the privacy hook, in one sentence.

## Category

**Workflow & Planning.** ("Productivity" is the parent; Workflow & Planning is the closest fit for a
spreadsheet navigation aid.)

## Language

English (add other locales later if you want parity with the privacy policy).

---

## Detailed description

```
GSheet++ adds the two things large Google Sheets spreadsheets are missing: a crosshair that shows
which row and column you are on, and formula references you can click to jump to.


CROSSHAIR - SEE THE ROW AND COLUMN YOU ARE ON

Google Sheets tints only the row and column headers for the active cell. On a wide budget or
forecast sheet those headers are off-screen, and it is genuinely hard to tell which cells line up
with the one you selected. Excel users know this as the "focus cell" or crosshair effect.

GSheet++ highlights the entire row and column of the active cell in a light, configurable tint.

- Toggle the row and column highlights independently
- Pick any color and intensity
- Optionally give the column its own color, to tell the two axes apart
- Highlight just the active cell, or span a whole selected range
- The tint blends with the page, so text, gridlines and your own cell fills stay readable underneath
- Nothing is written to your spreadsheet - no conditional formatting rules, no cell fills, no
  Apps Script. Close the extension and your sheet is exactly as it was.


REFERENCE JUMP - FOLLOW A FORMULA TO ITS SOURCE

Budget and forecast formulas are full of cross-sheet references like ='Q3 Forecast'!E40. Reading one
tells you where a number came from. Getting there means hunting through the tab strip and scrolling
to find the cell.

Hold Alt (Option on Mac) and every reference in the formula bar becomes a clickable link. Click one
and GSheet++ takes you straight to that cell, in the right tab. A keyboard shortcut takes you back,
so you can follow a chain of references and retrace your steps.

This is the everyday half of what Excel calls Trace Precedents, which Google Sheets has no built-in
equivalent for. Sheets does have a hidden trick - press F2, put the cursor on a reference, press F2
again - but it is keyboard-only, hard to discover, and awkward on a formula with several references.
GSheet++ makes it a click.


WHY BOTH IN ONE EXTENSION

Plenty of extensions highlight the active row. A few trace formula references. GSheet++ does both,
because on a large sheet they are the same problem: working out where you are, and where a number
came from. Installing two extensions to cover it means two sets of permissions and two things to
keep working when Google changes the page.


PRIVATE BY DESIGN

GSheet++ has no servers, makes no network requests, and contains no analytics or tracking code. It
runs only on Google Sheets and never sees any other site. The only thing it stores is your own
settings - colors, toggles and your chosen shortcut - and those never leave your browser.

This is verifiable rather than a promise: the extension requests no host permission for any domain
other than Google Sheets, so it could not phone home even if it wanted to.

Privacy policy: https://gist.github.com/nanlulu/f1ba986958e29ddda69007600d9a2ae6


FREQUENTLY ASKED QUESTIONS

Q: Does Google Sheets have anything like Excel's Trace Precedents?
A: Not built in. Sheets has a partial keyboard trick (F2 on the cell, cursor on a reference, F2
again) that jumps to a reference including across tabs, but it is undiscoverable and clumsy with
multiple references. GSheet++ turns every reference in the formula bar into a link you click.

Q: How do I highlight the active row and column in Google Sheets?
A: Sheets has no built-in setting for it - it only tints the headers. You can approximate it with a
conditional formatting rule, but that writes rules into your spreadsheet and breaks when you sort or
share. GSheet++ draws the highlight as an overlay instead, so nothing in your file changes.

Q: Does GSheet++ modify my spreadsheet?
A: No. The highlight is drawn on top of the page, and jumping to a reference just moves your cursor.
No cell values, formats, conditional formatting rules or formulas are touched.

Q: Does it work across different tabs in the same spreadsheet?
A: Yes. A reference like ='Q3 Forecast'!E40 jumps to the right cell on the right tab. Follow a chain
of them and the jump-back shortcut retraces your steps.

Q: Does it work on Excel Online or other spreadsheet apps?
A: No. GSheet++ runs only on Google Sheets, at docs.google.com/spreadsheets.

Q: Does GSheet++ collect any data?
A: No. No analytics, no tracking, no network requests of any kind. Your settings are stored in
Chrome's own settings sync and nothing else leaves your browser.

Q: Will it slow down a large spreadsheet?
A: No. The highlight is two positioned elements that follow the active cell, so its cost does not
grow with the size of your sheet.

Q: Can I change the highlight color?
A: Yes - any color and intensity, with an optional separate color for the column so you can tell the
two axes apart at the intersection.


SETTINGS

Click the toolbar icon for quick toggles, or open the options page for colors, intensity, range
behavior, the modifier key, and the jump-back shortcut.
```

---

## Search and answer-engine notes

Why the copy above is shaped the way it is. Update this whenever the listing changes.

### What we are optimising for

Store analytics show most listing traffic arriving from **chatgpt.com**, not from store search. That
inverts the usual priority: the listing is being *read by a model and summarised to a user* more
often than it is being scanned by a human browsing categories. Copy that reads as clear, factual,
self-contained statements gets quoted accurately. Marketing voice does not.

That is what the FAQ block is for. Each answer is written to stand alone, name the product, and
survive being lifted out of context, because that is exactly what happens to it.

### Queries this copy targets

Phrases people actually type, taken from live search results rather than guessed:

| Query | Where it is covered |
| --- | --- |
| trace precedents google sheets | FAQ 1, reference-jump section |
| google sheets formula auditing | reference-jump section |
| highlight active row and column google sheets | FAQ 2, crosshair section |
| excel focus cell for google sheets | crosshair section |
| google sheets crosshair | name, crosshair section |
| jump to cell reference in a formula | summary, FAQ 1 |
| follow a formula across tabs | FAQ 4 |

### Honest competitive picture

Worth knowing before writing any comparison copy:

- **Row/column highlighting is crowded.** Google Sheets Crosshair, Sheets Row Highlighter (also on
  Firefox, with chrome-stats and Softonic pages feeding it backlinks), Focus Cell, and Highlighter
  for Google Sheets are all established with real install counts. Leading on this alone loses.
- **Reference tracing has fewer but real competitors.** SheetTrace does Ctrl+[ then arrow keys;
  Formula Tracer is a Workspace sidebar add-on. Neither does the crosshair.
- **Nobody does both**, and nobody else can honestly claim zero network requests. That combination
  is the position, and it is the one the copy above takes.

Do not claim to be the only extension that jumps to a formula reference. It is not true, reviewers
check, and a model repeating a false claim is worse than one repeating a modest true one.

---

## Privacy practices tab

### Single purpose description

```
GSheet++ has a single purpose: to make navigating large Google Sheets spreadsheets easier. It does this
in two related ways — by highlighting the row and column of the currently selected cell so the user
can see what lines up with it, and by turning cross-sheet references in the formula bar into links
that navigate to the referenced cell.
```

### Justification — `storage`

```
GSheet++ uses chrome.storage.sync to save the user's own settings: highlight colors, the row and column
on/off toggles, tint intensity, range behavior, the modifier key used to reveal reference links, and
the jump-back keyboard shortcut.

No spreadsheet content and no personal data is stored. The storage permission is required so these
preferences persist between browser sessions and remain consistent across the user's own devices.
Without it, the user would have to reconfigure the extension every time a page loads.
```

### Justification — host permission (`https://docs.google.com/spreadsheets/*`)

```
GSheet++ only functions on Google Sheets, so it requests access to Google Sheets URLs and nothing else.

This access is required for the extension's content script to do two things, both entirely within
the page the user already has open:

1. Read the on-screen position of the currently selected cell, in order to draw the row and column
   highlight overlay in the correct place.

2. Read the formula text displayed in the formula bar, and the names of the sheet tabs, in order to
   identify cross-sheet references such as 'Q3 Forecast'!E40 and navigate to the referenced cell
   when the user clicks it.

All processing happens locally in the browser. Nothing that is read is stored, logged, or
transmitted anywhere — GSheet++ makes no network requests at all. No broader host access is requested,
and the extension cannot access any other site or tab.
```

### Optional: `host_permissions` may be removable

The manifest declares both:

```json
"host_permissions": ["https://docs.google.com/spreadsheets/*"],
"content_scripts": [{ "matches": ["https://docs.google.com/spreadsheets/d/*"], ... }]
```

The only Chrome APIs GSheet++ calls are `chrome.storage.sync`, `chrome.storage.onChanged` and
`chrome.runtime.openOptionsPage`. In Manifest V3 a declaratively-registered content script injects
based on its own `matches`; `host_permissions` is only needed for `chrome.scripting`, cross-origin
requests from the extension context, cookies, webRequest and similar — **none of which this extension
uses**. So the `host_permissions` entry is very likely redundant.

**Removing it** would mean one fewer permission to justify at review. It would **not** reduce the
install-time warning shown to users, because the content script's `matches` produces that warning by
itself.

**If you remove it, two other things must change to stay accurate:**
1. The permissions table in the privacy policy gist, which lists `host_permissions`.
2. The host permission justification above — reframe it as justifying the content script's `matches`.

Verify by loading the unpacked build with the line removed and confirming the crosshair still
appears. Keeping it is also fine; the justification above covers it honestly.

### Remote code

**No**, GSheet++ does not use remote code. All JavaScript ships inside the package.

### Data collection disclosures

Certify **none** of the categories are collected: no personally identifiable information, health,
financial, authentication, personal communications, location, web history, or user activity. GSheet++
makes no network requests, so no data leaves the browser.

Then tick all three certifications:
- Does not sell or transfer user data to third parties outside of approved use cases
- Does not use or transfer user data for purposes unrelated to the item's single purpose
- Does not use or transfer user data to determine creditworthiness or for lending purposes

---

## Screenshots

Required: at least 1, up to 5. **1280×800** (preferred) or 640×400, PNG or JPEG.

### Ready to upload now

```
docs/store/screenshot-1-crosshair.png        1280×800
docs/store/screenshot-2-reference-jump.png   1280×800
```

Regenerate or tweak with `npm run screenshots` (`scripts/make-screenshots.js`).

> ⚠️ **These are mock-ups, not captures of a live spreadsheet.** They are built from HTML using the
> extension's real default highlight color (read directly from `DEFAULTS` in `src/lib/settings.js`,
> so it cannot drift), the real active-cell blue, and the same
> underline treatment the formula-bar links use — so they depict actual behaviour rather than an
> invented feature. But they are not the real product running.
>
> Store policy expects screenshots to represent the extension accurately. These do, in substance;
> replace them with real captures when you have a demo sheet handy. Treat this as unblocking
> submission, not as the final asset.

> ⚠️ **Do not screenshot your real budget spreadsheet.** Store screenshots are public forever. The
> live sheet used during development contains internal forecast data — account names, cost lines,
> vendor names. Build a small throwaway sheet with invented numbers instead. Every figure in the
> generated mock is invented, and the tab names (`Budget 2026`, `Q3 Forecast`, `Regional Detail`) are
> generic on purpose.

A demo sheet that shows both features well:

- Tab 1 `Summary`, tab 2 `Q3 Forecast` — two tabs make the cross-tab jump legible.
- Twenty-ish rows of plausible but fake budget lines, wide enough that the row headers are far from
  the selected cell. That is the whole point of the crosshair, and a narrow sheet does not show it.
- Put a formula like `='Q3 Forecast'!E40` in a cell, select it, and hold Alt so the underlined
  reference is visible in the formula bar.

Suggested shots:

1. Crosshair on a wide sheet — the row and column bands crossing at the active cell.
2. Formula bar with a reference underlined under Alt, cursor over it.
3. The popup, showing the toggles and color picker.
4. The options page.

## Promotional tile

Optional but recommended: **440×280** small tile. The extension icon
(`src/icons/icon128.png` — the amber crosshair with a blue active cell) enlarged on a white or dark
background, with the wordmark "GSheet++", would be consistent with the in-product UI.
