# Feedback form

Copy-paste source for the Google Form linked from the options page. Keep this in sync with the
live form.

> ⚠️ **Not live yet.** `FEEDBACK_FORM_URL` in `src/ui/feedback.js` is still the placeholder, so the
> options page hides the link rather than shipping one that 404s. Build the form, then swap the URL
> in (see [Wiring it up](#wiring-it-up)).

---

## The design rule

**Ask only what the settings blob cannot tell you.**

The options page copies a report that already contains every *quantitative* fact — which toggles
are on, the exact color hex, the intensity, the range mode, the modifier, the shortcut, the
extension version, and the browser. Asking any of that again wastes the one or two questions a
respondent will actually answer.

So every question below is qualitative. The blob answers *what*; the form only asks *why*.

This is also why the form is six questions with **one** required. Completion rate falls off a
cliff past five or six, and a partial response beats an abandoned one. Each question below earns
its place or it is not there — see [Deliberately left out](#deliberately-left-out).

---

## Form title

```
GSheet++ feedback
```

## Form description

```
Thanks for using GSheet++.

GSheet++ collects nothing — no analytics, no tracking, no network requests at all. That means this
form is the only way we find out what's working and what isn't.

Nothing here is required except the first question, and there's no sign-in. Answer as much or as
little as you like.
```

---

## Questions

### 1. Which parts of GSheet++ do you actually use?

*Checkboxes · **Required***

```
The row highlight
The column highlight
Formula bar links (hold Alt to turn references into links)
The jump-back shortcut
Not sure yet — I only just installed it
```

Why it's first: it is one tap, which gets people committed before the questions that need typing.
It is also genuinely new information — your settings blob says a feature is *enabled*, which is not
the same as someone *using* it. A large gap between "enabled" and "I use it" is the most
interesting signal this form can produce.

"Not sure yet" is doing real work: a pile of those means the features aren't discoverable, which no
amount of settings data would ever have told you.

---

### 2. Have you turned any part of it off? Which, and why?

*Paragraph · Optional*

Help text:

```
This is the single most useful thing you can tell us. Something like "I turned the column highlight
off because it made my conditional formatting hard to read" is exactly what we can act on.
```

The help text is not decoration. Without a worked example people answer "no" or skip it; with one,
they match the shape and you get a reason instead of a yes/no. This is the question the whole form
exists for.

---

### 3. If you changed the highlight color or intensity, what were you trying to fix?

*Multiple choice · Optional · **turn on "Other"***

```
The default was too faint to notice
The default was too strong or distracting
It clashed with colors already in my sheet
It made cell text harder to read
Just personal preference
I didn't change it
```

Multiple choice rather than free text, because this is the one "why" that aggregates into a
decision: three people picking "too faint" is an argument for moving the default, whereas three
differently-worded sentences are not.

Note there is no "what color did you pick?" question — the pasted blob has the exact hex and
percentage. Leave Google Forms' built-in **Other** option on so anyone with a reason you didn't
anticipate can still give it.

---

### 4. What's missing, or what's broken?

*Paragraph · Optional*

Help text:

```
Bugs, papercuts, or something you wish it did. If the highlight or the links stopped appearing,
mention which Google Sheets view you were in.
```

---

### 5. Paste your settings here

*Paragraph · Optional*

Help text:

```
Optional, and it helps a lot. On the GSheet++ options page, press "Copy my settings", then paste
here. You can see the exact text before you copy it — it's just your toggles, colors and shortcut.
No spreadsheet content: no cell values, formulas, sheet names or document links.
```

Second-to-last on purpose: it is the highest-friction question, since it means leaving the form and
going to the options page. Anyone who bails here has already answered everything that matters.

Restating what's in the blob is worth the words. "Paste your diagnostics" reads like a request to
hand over unknown data, and people skip it.

---

### 6. Email, if you'd like a reply

*Short answer · Optional*

Help text:

```
Only if you want to hear back. Leave it blank otherwise — the form is anonymous either way.
```

Do **not** use the built-in "Collect email addresses" setting for this. That setting verifies the
address against a Google account and forces sign-in; a plain text field keeps the form anonymous
and lets people without a Google account respond at all.

---

## Form settings

In **Settings**, before sending the link:

| Setting | Value | Why |
| --- | --- | --- |
| **Limit to 1 response** | **OFF** | ⚠️ The important one. Turning it on forces Google sign-in, which converts an anonymous form into an identified one *and* locks out anyone without a Google account. |
| Collect email addresses | **Do not collect** | Question 6 handles this without demanding sign-in. |
| Restrict to users in your organization | OFF | Only shown on Workspace accounts; may not appear at all on a personal account. |
| Send responders a copy | OFF | Requires email collection. |
| Progress bar | OFF | Six questions. It just draws attention to the length. |
| Shuffle question order | OFF | The order is doing work — see the notes above. |
| Question 1 | Required | Everything else optional. |

### Confirmation message

```
Thanks — that genuinely helps.

GSheet++ has no analytics, so this form is the whole feedback channel. If you left an email, you'll
hear back.
```

### Responses

Link the form to a spreadsheet (**Responses → Link to Sheets**). Free-text answers are far easier
to read down a column than clicked through one at a time — and it puts your feedback in a sheet you
can use GSheet++ on.

---

## Wiring it up

1. Build the form, then **Send → link** and copy it. Prefer the full form URL over the `forms.gle`
   shortlink, which is a redirect.
2. Replace the placeholder in `src/ui/feedback.js`:

   ```js
   export const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/<FORM_ID>/viewform';
   ```

   `isFormConfigured()` looks for the string `REPLACE_WITH_FORM_ID`, so the options page reveals the
   link the moment a real URL is in place. No other change is needed.
3. `npm run build`, reload the unpacked extension, open the options page, confirm the **Send
   feedback** row is now visible and the link opens the form.

### Test it signed out

Open the link in an incognito window while signed out of Google and submit a throwaway response. If
it demands sign-in, **Limit to 1 response** is still on. This is worth doing once — the failure is
silent from your side, since you stay signed in and never see the wall your users hit.

---

## Deliberately left out

Each of these is defensible on its own and would still cost you a question:

- **"How did you hear about GSheet++?"** — Web Store acquisition stats already cover it.
- **"How often do you use it?"** — self-reported frequency is unreliable, and the Web Store's
  weekly-active-users number is the real answer.
- **"What color did you pick?"** — the pasted blob has the exact hex.
- **"Which browser / OS?"** — also in the blob.
- **Prefilling the extension version into the form URL.** Zero privacy cost, since it's the build
  number rather than user data. Dropped anyway: the blob already carries the version, and it would
  add a step to every release that will eventually be forgotten, leaving a wrong version in the URL
  — worse than no version at all.

If you want one more, the best candidate is **"Roughly how big are the sheets you use this on?"**
(under 100 rows / hundreds / thousands / tens of thousands). The whole pitch is large spreadsheets,
and it would tell you whether the people installing it are who you think they are.
