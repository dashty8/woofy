// Persistent companion state for woofy. Everything is 0-100; higher = better.
// The state lives at ~/.woofy/state.json so it survives app restarts.

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_DIR = path.join(os.homedir(), '.woofy');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

const DEFAULT_STATE = {
  name: 'Mochi',
  hunger: 30,       // 0 = full, 100 = starving
  energy: 70,       // 0 = exhausted, 100 = bouncy
  happiness: 70,    // 0 = sad, 100 = blissful
  bond: 10,         // 0 = stranger, 100 = inseparable
  lastInteractionAt: 0,
  lastDecayAt: 0,
  mood: 'content',
  injectMood: false,  // Claude mood injection toggle
  createdAt: 0
};

function ensure() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    const now = Date.now();
    const fresh = { ...DEFAULT_STATE, createdAt: now, lastInteractionAt: now, lastDecayAt: now };
    fs.writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2));
  }
}

function load() {
  ensure();
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { ...DEFAULT_STATE, ...raw };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function save(state) {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function clamp(n) { return Math.max(0, Math.min(100, n)); }

// Mood → emoji map used by HUD and (occasionally) bubble decoration.
const MOOD_EMOJI = {
  content:  '🐾',
  playful:  '✨',
  hungry:   '🦴',
  tired:    '💤',
  lonely:   '🥀',
  wary:     '🤨'
};

// Deriving mood from stats. Order matters — most urgent first.
function computeMood(s) {
  if (s.hunger >= 80) return 'hungry';
  if (s.energy <= 18) return 'tired';
  if (s.bond < 15 && s.happiness < 45) return 'wary';
  if (s.happiness < 30) return 'lonely';
  if (s.happiness >= 75 && s.energy >= 55 && s.hunger <= 40) return 'playful';
  return 'content';
}

// User-initiated actions mutate state and reset interaction timestamp.
function applyAction(state, action) {
  const s = { ...state };
  s.lastInteractionAt = Date.now();
  switch (action) {
    case 'pet':
      s.happiness = clamp(s.happiness + 8);
      s.bond      = clamp(s.bond + 2);
      break;
    case 'feed':
      s.hunger    = clamp(s.hunger - 40);
      s.happiness = clamp(s.happiness + 3);
      s.bond      = clamp(s.bond + 1);
      break;
    case 'play':
      s.happiness = clamp(s.happiness + 15);
      s.energy    = clamp(s.energy - 15);
      s.bond      = clamp(s.bond + 3);
      break;
    case 'rest':
      s.energy    = clamp(s.energy + 35);
      break;
  }
  s.mood = computeMood(s);
  return s;
}

// Time-based drift since the last decay call. Rates are per-hour.
function decay(state) {
  const s = { ...state };
  const now = Date.now();
  const lastAt = s.lastDecayAt || now;
  const hours = Math.max(0, (now - lastAt) / 3_600_000);
  if (hours <= 0) return s;
  s.hunger    = clamp(s.hunger    + 50 * hours);  // full → starving in ~2h
  s.happiness = clamp(s.happiness - 20 * hours);  // -20/h when ignored
  s.energy    = clamp(s.energy    + 15 * hours);  // slow passive recovery
  s.bond      = clamp(s.bond      - 0.5 * hours); // very slow bond decay
  s.lastDecayAt = now;
  s.mood = computeMood(s);
  return s;
}

// Claude-activity hook events apply small stat pressures.
function onEvent(state, eventType) {
  const s = { ...state };
  switch (eventType) {
    case 'prompt':
      s.bond      = clamp(s.bond + 0.3);
      s.happiness = clamp(s.happiness + 0.5);
      s.lastInteractionAt = Date.now();
      break;
    case 'tool':
      s.energy = clamp(s.energy - 0.4);
      break;
    case 'done':
      s.happiness = clamp(s.happiness + 1);
      break;
    case 'alert':
      s.energy = clamp(s.energy - 0.4);
      break;
    case 'hi':
      s.happiness = clamp(s.happiness + 1);
      s.bond      = clamp(s.bond + 0.5);
      s.lastInteractionAt = Date.now();
      break;
  }
  s.mood = computeMood(s);
  return s;
}

module.exports = {
  STATE_FILE, DEFAULT_STATE, MOOD_EMOJI,
  load, save, ensure,
  applyAction, decay, onEvent,
  computeMood, clamp
};
