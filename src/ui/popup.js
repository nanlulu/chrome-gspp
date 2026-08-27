import { loadSettings, saveSettings } from '../lib/settings.js';
import { formatHotkey, MODIFIER_LABELS } from './hotkeyLabel.js';

const $ = (id) => document.getElementById(id);

function bindSwitch(id, settings) {
  const el = $(id);
  el.checked = Boolean(settings[id]);
  el.addEventListener('change', () => saveSettings({ [id]: el.checked }));
}

function syncEnabledState(enabled) {
  for (const section of document.querySelectorAll('section')) {
    section.classList.toggle('disabled', !enabled && section.id !== '');
  }
  // The "All settings…" section stays reachable even when disabled.
  document.querySelectorAll('section')[2]?.classList.remove('disabled');
}

async function init() {
  const settings = await loadSettings();

  bindSwitch('enabled', settings);
  bindSwitch('rowEnabled', settings);
  bindSwitch('colEnabled', settings);
  bindSwitch('jumpEnabled', settings);

  $('enabled').addEventListener('change', (e) => syncEnabledState(e.target.checked));
  syncEnabledState(settings.enabled);

  const color = $('color');
  color.value = settings.color;
  color.addEventListener('input', () => saveSettings({ color: color.value }));

  const opacity = $('opacity');
  const opacityValue = $('opacityValue');
  const renderOpacity = (pct) => { opacityValue.textContent = `${pct}%`; };
  opacity.value = String(Math.round(settings.opacity * 100));
  renderOpacity(opacity.value);
  opacity.addEventListener('input', () => {
    renderOpacity(opacity.value);
    saveSettings({ opacity: Number(opacity.value) / 100 });
  });

  $('modifierHint').textContent = MODIFIER_LABELS[settings.jumpModifier] || settings.jumpModifier;
  $('backHint').textContent = formatHotkey(settings.jumpBackHotkey);

  $('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

init();
