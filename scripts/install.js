// Merges woofy's Stop + Notification hooks into ~/.claude/settings.json.
// Each managed hook is tagged with __woofy__ so uninstall can find and strip it.

const fs = require('fs');
const os = require('os');
const path = require('path');

const TAG = '__woofy__';
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const ROOT = path.resolve(__dirname, '..');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); }
  catch { return {}; }
}

function writeSettings(data) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

function normalizeHooks(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
  return settings.hooks;
}

function upsertHook(hooksEntry, hook) {
  if (!Array.isArray(hooksEntry)) return [hook];
  // Replace any existing __woofy__-tagged entry with the fresh one; keep others.
  const filtered = hooksEntry.filter((h) => !isWoofyTagged(h));
  return [...filtered, hook];
}

function isWoofyTagged(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry[TAG]) return true;
  if (Array.isArray(entry.hooks)) {
    return entry.hooks.some((h) => h && typeof h === 'object' && h[TAG]);
  }
  return false;
}

function hookCmd(name) {
  return {
    type: 'command',
    command: `node "${path.join(ROOT, 'hooks', name)}"`,
    [TAG]: true
  };
}

const managed = [
  { event: 'SessionStart',      matcher: '', hook: hookCmd('session-start.js') },
  { event: 'UserPromptSubmit',  matcher: '', hook: hookCmd('user-prompt.js') },
  { event: 'PreToolUse',        matcher: '', hook: hookCmd('pre-tool.js') },
  { event: 'Stop',              matcher: '', hook: hookCmd('stop.js') },
  { event: 'Notification',      matcher: '', hook: hookCmd('notification.js') }
];

function run() {
  const settings = readSettings();
  const hooks = normalizeHooks(settings);

  for (const m of managed) {
    if (!Array.isArray(hooks[m.event])) hooks[m.event] = [];
    // Find an entry whose matcher matches; create a new one if none.
    let slot = hooks[m.event].find((e) => (e.matcher || '') === m.matcher);
    if (!slot) {
      slot = { matcher: m.matcher, hooks: [] };
      hooks[m.event].push(slot);
    }
    if (!Array.isArray(slot.hooks)) slot.hooks = [];
    slot.hooks = upsertHook(slot.hooks, m.hook);
  }

  writeSettings(settings);
  console.log('[woofy] installed hooks (SessionStart, UserPromptSubmit, PreToolUse, Stop, Notification) in ' + SETTINGS_PATH);
}

run();
