import { DEFAULTS, loadSettings, saveSettings } from '../lib/settings.js';
import {
  FEEDBACK_FORM_URL,
  buildFeedbackReport,
  describeEnvironment,
  isFormConfigured,
} from './feedback.js';
import { formatHotkey, hotkeyFromEvent, isReservedHotkey } from './hotkeyLabel.js';

const $ = (id) => document.getElementById(id);

let statusTimer = 0;
function status(message) {
  const el = $('status');
  el.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.textContent = ''; }, 2000);
}

async function persist(patch) {
  await saveSettings(patch);
  status('Saved');
  // The options page claims the preview is exactly what gets copied, so it has
  // to follow every write. No-ops while the disclosure is closed.
  refreshFeedbackPreview();
}

function bindSwitch(id, settings) {
  const el = $(id);
  el.checked = Boolean(settings[id]);
  el.addEventListener('change', () => persist({ [id]: el.checked }));
}

function render(settings) {
  for (const id of ['enabled', 'rowEnabled', 'colEnabled', 'jumpEnabled', 'debug']) {
    $(id).checked = Boolean(settings[id]);
  }
  $('color').value = settings.color;
  $('rangeMode').value = settings.rangeMode;
  $('jumpModifier').value = settings.jumpModifier;
  $('jumpBackHotkey').textContent = formatHotkey(settings.jumpBackHotkey);

  const hasColumnColor = Boolean(settings.columnColor);
  $('useColumnColor').checked = hasColumnColor;
  $('columnColor').value = settings.columnColor || settings.color;
  $('columnColor').style.visibility = hasColumnColor ? 'visible' : 'hidden';

  const pct = Math.round(settings.opacity * 100);
  $('opacity').value = String(pct);
  $('opacityValue').textContent = `${pct}%`;
}

/** The report as it stands right now. Read fresh so it can never go stale. */
async function currentReport() {
  return buildFeedbackReport(await loadSettings(), describeEnvironment());
}

async function refreshFeedbackPreview() {
  if (!$('settingsPreview').open) return;
  $('settingsPreviewText').textContent = await currentReport();
}

function initFeedback() {
  if (isFormConfigured()) {
    $('feedbackLink').href = FEEDBACK_FORM_URL;
  } else {
    // No link at all beats one that 404s.
    $('feedbackLinkRow').hidden = true;
  }

  $('settingsPreview').addEventListener('toggle', refreshFeedbackPreview);

  $('copySettings').addEventListener('click', async () => {
    const report = await currentReport();
    try {
      await navigator.clipboard.writeText(report);
      status('Settings copied \u2014 paste them into the form');
    } catch {
      // Clipboard refused (document not focused, or a restrictive policy).
      // Show the text instead of swallowing the click: the user can still
      // select it by hand, which is the same amount of consent either way.
      $('settingsPreview').open = true;
      await refreshFeedbackPreview();
      status('Could not reach the clipboard \u2014 copy the text below');
    }
  });
}

async function init() {
  const settings = await loadSettings();
  render(settings);

  for (const id of ['enabled', 'rowEnabled', 'colEnabled', 'jumpEnabled', 'debug']) {
    bindSwitch(id, settings);
  }

  $('color').addEventListener('input', (e) => persist({ color: e.target.value }));

  $('useColumnColor').addEventListener('change', (e) => {
    const on = e.target.checked;
    $('columnColor').style.visibility = on ? 'visible' : 'hidden';
    persist({ columnColor: on ? $('columnColor').value : '' });
  });
  $('columnColor').addEventListener('input', (e) => {
    if ($('useColumnColor').checked) persist({ columnColor: e.target.value });
  });

  $('opacity').addEventListener('input', (e) => {
    $('opacityValue').textContent = `${e.target.value}%`;
    persist({ opacity: Number(e.target.value) / 100 });
  });

  $('rangeMode').addEventListener('change', (e) => persist({ rangeMode: e.target.value }));
  $('jumpModifier').addEventListener('change', (e) => persist({ jumpModifier: e.target.value }));

  // Hotkey recorder: click, then press the combination.
  const hotkeyButton = $('jumpBackHotkey');
  let recording = false;

  hotkeyButton.addEventListener('click', () => {
    recording = true;
    hotkeyButton.textContent = 'Press keys…';
    hotkeyButton.focus();
  });

  hotkeyButton.addEventListener('keydown', (event) => {
    if (!recording) return;
    event.preventDefault();

    if (event.key === 'Escape') {
      recording = false;
      loadSettings().then((s) => { hotkeyButton.textContent = formatHotkey(s.jumpBackHotkey); });
      return;
    }

    const hotkey = hotkeyFromEvent(event);
    if (!hotkey) return; // still waiting for a non-modifier key

    // Reject combinations the browser eats before the page sees them; binding
    // one produces a shortcut that silently never fires.
    if (isReservedHotkey(hotkey)) {
      hotkeyButton.textContent = 'Press keys…';
      status(`${formatHotkey(hotkey)} is reserved by the browser — pick another`);
      return;
    }

    recording = false;
    hotkeyButton.textContent = formatHotkey(hotkey);
    persist({ jumpBackHotkey: hotkey });
  });

  hotkeyButton.addEventListener('blur', () => {
    if (!recording) return;
    recording = false;
    loadSettings().then((s) => { hotkeyButton.textContent = formatHotkey(s.jumpBackHotkey); });
  });

  initFeedback();

  $('reset').addEventListener('click', async () => {
    await saveSettings({ ...DEFAULTS });
    render({ ...DEFAULTS });
    status('Settings reset to defaults');
  });
}

init();
