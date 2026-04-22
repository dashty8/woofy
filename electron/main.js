const { app, BrowserWindow, screen, protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WebSocketServer } = require('ws');
const stateLib = require('../lib/state');

const PET_SIZE = 240;
const WS_PORT = 41415;
const CORNER_MARGIN = 16;
const STATE_DIR = path.join(os.homedir(), '.woofy');
const CLIPS_FILE = path.join(STATE_DIR, 'clips.json');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'woofy',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
]);

let win = null;
let wss = null;
let state = null;  // companion state — loaded on app-ready, saved on any mutation

function persist() {
  stateLib.save(state);
}

function pushState() {
  if (win && !win.isDestroyed()) win.webContents.send('state', state);
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: workArea.x + workArea.width - PET_SIZE - CORNER_MARGIN,
    y: workArea.y + workArea.height - PET_SIZE - CORNER_MARGIN,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('console-message', (_e, level, message, _line, _source) => {
    const levels = ['log', 'warn', 'error'];
    console.log(`[woofy:${levels[level] || 'log'}] ${message}`);
  });
  win.webContents.once('did-finish-load', () => {
    const pos = win.getPosition();
    console.log(`[woofy] window at x=${pos[0]} y=${pos[1]} size=${PET_SIZE}x${PET_SIZE}`);
    win.show();
    pushState();
  });
}

function startWsServer() {
  try {
    wss = new WebSocketServer({ port: WS_PORT });
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          handleEvent(msg);
        } catch {
          // ignore bad messages
        }
      });
    });
    console.log(`[woofy] ws server listening on ${WS_PORT}`);
  } catch (err) {
    console.error('[woofy] could not start ws server on ' + WS_PORT + ':', err.message);
  }
}

// Thought-bubble pools. Main picks a random line unless the incoming event carries its own
// message (e.g. Notification from Claude carrying the real permission message).
const BUBBLES = {
  hi:          ['woof!', 'hi!', 'hello there', '*tail wag*', 'hey friend'],
  done:        ['done!', 'all good!', 'nice job', 'yay', 'whew', '*tail wag*'],
  alert:       ['heads up!', 'hey!', 'look!', 'over here!', 'psst'],
  prompt:      ['hmm', 'watching', 'sniff sniff', 'on it', '...', '*tail wag*'],
  tool:        ['*tilts head*', 'watching', 'oh?', 'sniff', 'hmm'],
  bored:       ['...', '*yawns*', 'any crumbs?', 'still there?', 'zzz?', 'nap time?'],
  overwhelmed: ['woah!', 'easy boss', 'so much!', 'phew', '*spins*', 'slow down'],
  dormant:     ['zzz', 'mmm', '*soft snore*'],
  pet:         ['*wag wag*', 'more!', '*happy wiggle*', 'scritches!', '♥'],
  feed:        ['nom nom', '*chomp*', 'so good', 'yum', '🦴'],
  play:        ['yippee!', '*zoomies*', 'yes!', 'whee!', '*pounce*'],
  rest:        ['mmm', 'nap time', 'zzz', 'soft…'],
  test:        ['woof!']
};

function pickBubble(kind, explicit) {
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  const pool = BUBBLES[kind];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Activity tracking + bored/dormant timers + overwhelmed rate detection.
const BORED_AFTER_MS    = 3 * 60_000;   // 3 minutes of quiet → bored
const DORMANT_AFTER_MS  = 10 * 60_000;  // 10 minutes of quiet → dormant
const OVERWHELMED_WINDOW = 10_000;      // tool events in this rolling window
const OVERWHELMED_COUNT  = 5;           // threshold before overwhelmed fires
const OVERWHELMED_COOLDOWN = 20_000;    // don't fire again within this

let lastActivityAt = Date.now();
let currentMood = 'idle';  // 'idle' | 'bored' | 'dormant'
let toolTimestamps = [];
let lastOverwhelmedAt = 0;

// Wander state — window drifts along the bottom strip during idle activity.
let wanderTimer = null;
let wanderToken = 0;           // incremented on cancel to invalidate in-flight ticks
let wandering = false;
const WANDER_MIN_DELAY = 25_000;
const WANDER_MAX_DELAY = 70_000;
const WANDER_ACTIVITY_WINDOW = 120_000;  // only wander if activity in last 2 min
const WANDER_MIN_STEP = 120;
const WANDER_MAX_STEP = 320;
const WANDER_DUR_MIN = 1600;
const WANDER_DUR_MAX = 2600;

function noteActivity() {
  lastActivityAt = Date.now();
  if (currentMood !== 'idle' && win && !win.isDestroyed()) {
    currentMood = 'idle';
    win.webContents.send('notify', { kind: 'idle', message: null });
  }
}

function cancelWander(sendStop = true) {
  if (!wandering) return;
  wanderToken++;              // any in-flight tick sees mismatched token and bails
  wandering = false;
  if (sendStop && win && !win.isDestroyed()) {
    win.webContents.send('notify', { kind: 'walk-stop', message: null });
  }
}

function animateMoveWindow(x0, y0, x1, y1, duration, token, onDone) {
  const start = Date.now();
  const tick = () => {
    if (!win || win.isDestroyed()) return;
    if (token !== wanderToken) return;
    const t = Math.min(1, (Date.now() - start) / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const x = Math.round(x0 + (x1 - x0) * ease);
    const y = Math.round(y0 + (y1 - y0) * ease);
    win.setPosition(x, y);
    if (t < 1) setTimeout(tick, 16);
    else if (onDone) onDone();
  };
  tick();
}

function startWander() {
  if (wandering) return;
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  if (currentMood !== 'idle') return;
  if (Date.now() - lastActivityAt > WANDER_ACTIVITY_WINDOW) return;

  const [cx, cy] = win.getPosition();
  const { workArea } = screen.getPrimaryDisplay();
  const margin = 8;
  const minX = workArea.x + margin;
  const maxX = workArea.x + workArea.width - PET_SIZE - margin;
  const stepMag = WANDER_MIN_STEP + Math.random() * (WANDER_MAX_STEP - WANDER_MIN_STEP);
  const step = stepMag * (Math.random() < 0.5 ? -1 : 1);
  const tx = Math.max(minX, Math.min(maxX, cx + step));
  if (Math.abs(tx - cx) < 40) return;
  const direction = tx > cx ? 1 : -1;
  const duration = WANDER_DUR_MIN + Math.random() * (WANDER_DUR_MAX - WANDER_DUR_MIN);

  wandering = true;
  const myToken = ++wanderToken;
  win.webContents.send('notify', { kind: 'walk-start', direction, message: null });
  animateMoveWindow(cx, cy, tx, cy, duration, myToken, () => {
    if (myToken !== wanderToken) return;
    wandering = false;
    if (win && !win.isDestroyed()) {
      win.webContents.send('notify', { kind: 'walk-stop', message: null });
    }
  });
}

function scheduleWander() {
  if (wanderTimer) clearTimeout(wanderTimer);
  const delay = WANDER_MIN_DELAY + Math.random() * (WANDER_MAX_DELAY - WANDER_MIN_DELAY);
  wanderTimer = setTimeout(() => {
    wanderTimer = null;
    startWander();
    scheduleWander();
  }, delay);
}

function checkMoodTimers() {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  const idleMs = Date.now() - lastActivityAt;
  if (idleMs >= DORMANT_AFTER_MS && currentMood !== 'dormant') {
    currentMood = 'dormant';
    cancelWander(false);
    win.webContents.send('notify', { kind: 'dormant', message: pickBubble('dormant') });
  } else if (idleMs >= BORED_AFTER_MS && currentMood === 'idle') {
    currentMood = 'bored';
    cancelWander(false);
    win.webContents.send('notify', { kind: 'bored', message: pickBubble('bored') });
  }
}

function noteToolForBurst() {
  const now = Date.now();
  toolTimestamps.push(now);
  toolTimestamps = toolTimestamps.filter((t) => now - t < OVERWHELMED_WINDOW);
  if (toolTimestamps.length >= OVERWHELMED_COUNT && now - lastOverwhelmedAt > OVERWHELMED_COOLDOWN) {
    lastOverwhelmedAt = now;
    toolTimestamps = [];
    if (win && !win.isDestroyed()) {
      win.webContents.send('notify', { kind: 'overwhelmed', message: pickBubble('overwhelmed') });
    }
  }
}

function handleEvent(msg) {
  if (!win || win.isDestroyed()) return;
  switch (msg.type) {
    case 'hi':
      noteActivity();
      state = stateLib.onEvent(state, 'hi');
      persist(); pushState();
      win.webContents.send('notify', { kind: 'hi', message: pickBubble('hi') });
      break;
    case 'done':
      noteActivity();
      cancelWander();
      state = stateLib.onEvent(state, 'done');
      persist(); pushState();
      win.webContents.send('notify', { kind: 'done', message: pickBubble('done') });
      break;
    case 'alert':
      noteActivity();
      cancelWander();
      state = stateLib.onEvent(state, 'alert');
      persist(); pushState();
      win.webContents.send('notify', { kind: 'alert', message: pickBubble('alert', msg.message) });
      break;
    case 'prompt':
      noteActivity();
      state = stateLib.onEvent(state, 'prompt');
      persist(); pushState();
      win.webContents.send('notify', { kind: 'prompt', message: pickBubble('prompt') });
      break;
    case 'tool':
      noteActivity();
      noteToolForBurst();
      state = stateLib.onEvent(state, 'tool');
      persist(); pushState();
      if (Math.random() < 0.35) {
        win.webContents.send('notify', { kind: 'tool', message: pickBubble('tool') });
      } else {
        win.webContents.send('notify', { kind: 'tool', message: null });
      }
      break;
    case 'pet':
    case 'feed':
    case 'play':
    case 'rest':
      noteActivity();
      cancelWander();
      state = stateLib.applyAction(state, msg.type);
      persist(); pushState();
      win.webContents.send('notify', { kind: msg.type, message: pickBubble(msg.type) });
      break;
    case 'name':
      if (typeof msg.name === 'string' && msg.name.trim().length > 0 && msg.name.length < 30) {
        state = { ...state, name: msg.name.trim() };
        persist(); pushState();
      }
      break;
    case 'inject':
      if (typeof msg.value === 'boolean') {
        state = { ...state, injectMood: msg.value };
        persist(); pushState();
      }
      break;
    case 'test':
      win.webContents.send('notify', { kind: 'test', message: pickBubble('test') });
      break;
    case 'clip':
      if (typeof msg.name === 'string' && msg.name.length > 0) {
        win.webContents.send('play-clip', msg.name);
      }
      break;
    case 'wander':
      noteActivity();
      startWander();
      break;
  }
}

ipcMain.on('action', (_, type) => {
  if (!['pet', 'feed', 'play', 'rest'].includes(type)) return;
  handleEvent({ type });
});

ipcMain.on('clips-loaded', (_, names) => {
  if (!Array.isArray(names)) return;
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(CLIPS_FILE, JSON.stringify(names, null, 2));
    console.log('[woofy] saved ' + names.length + ' clip names to ' + CLIPS_FILE);
  } catch (err) {
    console.warn('[woofy] could not save clips list:', err.message);
  }
});

function registerProtocol() {
  protocol.handle('woofy', (request) => {
    try {
      const u = new URL(request.url);
      const rel = decodeURIComponent((u.hostname ? u.hostname + '/' : '') + u.pathname)
        .replace(/^\/+/, '')
        .replace(/\.\./g, '');
      const clean = rel.replace(/^assets\//, '');
      const abs = path.join(__dirname, 'assets', clean);
      if (!fs.existsSync(abs)) {
        return new Response('Not found: ' + clean, { status: 404 });
      }
      const data = fs.readFileSync(abs);
      const ext = path.extname(clean).toLowerCase();
      const mime =
        ext === '.json' ? 'application/json' :
        ext === '.glb'  ? 'model/gltf-binary' :
        ext === '.gltf' ? 'model/gltf+json' :
        ext === '.png'  ? 'image/png' :
        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
        'application/octet-stream';
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': mime, 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      return new Response('Protocol error: ' + err.message, { status: 500 });
    }
  });
}

function decayTick() {
  state = stateLib.decay(state);
  persist();
  pushState();
}

app.whenReady().then(() => {
  state = stateLib.load();
  state = stateLib.decay(state);  // catch up on time elapsed while app was closed
  persist();
  registerProtocol();
  createWindow();
  startWsServer();
  setInterval(checkMoodTimers, 30_000);
  setInterval(decayTick, 60_000);  // stat drift every minute
  scheduleWander();
});

app.on('window-all-closed', () => {
  if (wss) try { wss.close(); } catch {}
  if (process.platform !== 'darwin') app.quit();
});
