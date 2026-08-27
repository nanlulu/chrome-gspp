# GSheet++ Privacy Policy

_Last updated: 2026-08-27_

**GSheet++ does not collect, transmit, or sell any data.**

## What GSheet++ accesses

GSheet++ runs only on `https://docs.google.com/spreadsheets/*`. On those pages it reads:

- the on-screen position of the active cell, in order to draw the highlight bands;
- the text shown in the formula bar, in order to find cell references you can click;
- the names of the sheet tabs, in order to resolve a reference like `'Q3 Forecast'!E40` to the
  right tab.

All of this happens locally in your browser, in the page you already have open. **None of it is
stored, logged, or sent anywhere.** GSheet++ has no server, makes no network requests, and contains no
analytics or tracking code.

## What GSheet++ stores

Only your own settings — highlight colors, on/off toggles, and your chosen shortcut — via Chrome's
`storage.sync` API. If you have Chrome Sync enabled, Google syncs these preferences across your own
devices in the same way it syncs your bookmarks. They contain no spreadsheet content.

You can erase them at any time with **Reset all settings** on the options page, or by removing the
extension.

## Feedback

The options page has a **Copy my settings** button and a link to a feedback form.

The button copies your settings — the on/off toggles, your colors and intensity, your range and
modifier choices, and your shortcut — to your clipboard, together with the extension version and
your browser and operating system name. The exact text is shown in full on the options page, under
**See exactly what gets copied**, before you copy it.

It contains **no spreadsheet content**: no cell values, no formulas, no sheet or tab names, and no
document links.

Nothing is copied until you press the button, and nothing is sent anywhere until you paste it into
the form and submit it. Both steps are yours. The extension itself still makes no network request
of any kind.

The form is hosted by Google Forms. It does not ask for your email address, and it does not require
you to sign in. If you choose to enter an email so we can reply, that is the only identifying thing
we receive.

## Permissions, and why each is needed

| Permission | Why |
| --- | --- |
| `storage` | Save your settings |
| `host_permissions: https://docs.google.com/spreadsheets/*` | Draw the highlight and read the formula bar on spreadsheet pages only |

GSheet++ requests no other permissions. It cannot see other tabs, your browsing history, or any site
other than Google Sheets.

## Remote code

GSheet++ contains no remote code. All of its JavaScript ships inside the extension package and is
reviewable in the [source repository](https://github.com/nanlulu/chrome-gspp).

## Contact

Questions or concerns: open an issue at https://github.com/nanlulu/chrome-gspp/issues
