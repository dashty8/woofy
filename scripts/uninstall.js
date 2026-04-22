// Strip __woofy__-tagged hooks from ~/.claude/settings.json.

const fs = require('fs');
const os = require('os');
const path = require('path');

const TAG = '__woofy__';
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch { return null; }
}

function writeSettings(data) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

function run() {
  const settings = readSettings();
  if (!settings || !settings.hooks) {
    console.log('[woofy] no hooks to remove.');
    return;
  }
  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const arr = settings.hooks[event];
    if (!Array.isArray(arr)) continue;
    for (const slot of arr) {
      if (!slot || !Array.isArray(slot.hooks)) continue;
      const before = slot.hooks.length;
      slot.hooks = slot.hooks.filter((h) => !(h && h[TAG]));
      removed += before - slot.hooks.length;
    }
    settings.hooks[event] = arr.filter((s) => Array.isArray(s.hooks) && s.hooks.length > 0);
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  writeSettings(settings);
  console.log('[woofy] removed ' + removed + ' tagged hook(s) from ' + SETTINGS_PATH);
}

run();
