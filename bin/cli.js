#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');
const { spawn } = require('child_process');
const { notify } = require('../lib/notify');
const stateLib = require('../lib/state');

const ROOT = path.resolve(__dirname, '..');
const CLIPS_FILE = path.join(os.homedir(), '.woofy', 'clips.json');
const cmd = process.argv[2];

function sanitizeName(raw) {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
  return trimmed.slice(0, 20);
}

async function maybeFirstRunNamePrompt() {
  if (fs.existsSync(stateLib.STATE_FILE)) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    stateLib.ensure();
    return;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
  console.log('');
  console.log('     ╱|、');
  console.log('    (˙ ∆ ˙)   Welcome to woofy!');
  console.log('    /づ づ     A new puppy has arrived.');
  console.log('');
  let name = '';
  while (!name) {
    const answer = await ask('  What will you call them?  ');
    name = sanitizeName(answer);
    if (!name) console.log('     (please enter at least one character)');
  }
  rl.close();
  stateLib.ensure();
  const s = stateLib.load();
  s.name = name;
  stateLib.save(s);
  console.log('');
  console.log('  ✓ ' + name + ' is so excited to meet you!');
  console.log('');
  console.log('  Try these once they\'re up:');
  console.log('    woofy pet     give scritches');
  console.log('    woofy feed    fill their bowl');
  console.log('    woofy play    play fetch');
  console.log('    woofy stats   see how they\'re doing');
  console.log('    woofy help    all commands');
  console.log('');
  console.log('  Launching...');
  console.log('');
}

function start(detached) {
  const electron = require('electron');
  const args = [ROOT];
  const child = spawn(electron, args, {
    cwd: ROOT,
    detached,
    stdio: detached ? 'ignore' : 'inherit'
  });
  if (detached) {
    child.unref();
    console.log('woofy started in background (PID ' + child.pid + ')');
  }
}

async function fire(kind, message) {
  const type = kind === 'alert' ? 'alert' : kind === 'test' ? 'test' : 'done';
  await notify({ type, message });
  console.log('sent ' + type + (message ? ' "' + message + '"' : ''));
}

function loadClips() {
  try { return JSON.parse(fs.readFileSync(CLIPS_FILE, 'utf8')); }
  catch { return null; }
}

function listAnims(filter) {
  const names = loadClips();
  if (!names) {
    console.error('No clips file at ' + CLIPS_FILE + '. Is woofy running?');
    process.exit(1);
  }
  const q = (filter || '').toLowerCase();
  const out = q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
  console.log(out.join('\n'));
  console.log('---');
  console.log(out.length + ' of ' + names.length + ' clip(s)' + (q ? ' matching "' + filter + '"' : ''));
}

async function playAnim(name) {
  if (!name) {
    console.error('Usage: woofy anim <clip-name or substring>');
    process.exit(1);
  }
  await notify({ type: 'clip', name });
  console.log('sent clip "' + name + '"');
}

async function doAction(type) {
  await notify({ type });
  console.log('sent ' + type);
}

async function doName(name) {
  if (!name) { console.error('Usage: woofy name <name>'); process.exit(1); }
  await notify({ type: 'name', name });
  console.log('named ' + name);
}

function showStats() {
  const s = stateLib.load();
  const lines = [
    'Name:      ' + s.name,
    'Mood:      ' + s.mood,
    'Happiness: ' + Math.round(s.happiness) + '/100',
    'Hunger:    ' + Math.round(s.hunger) + '/100  (fullness: ' + Math.round(100 - s.hunger) + ')',
    'Energy:    ' + Math.round(s.energy) + '/100',
    'Bond:      ' + Math.round(s.bond) + '/100'
  ];
  console.log(lines.join('\n'));
}

function help() {
  console.log([
    'woofy — a 3D puppy in the corner that barks when Claude is done or needs you.',
    '',
    'Commands:',
    '  woofy                   start in foreground',
    '  woofy start             start detached in background',
    '  woofy pet               pet the dog',
    '  woofy feed              feed the dog',
    '  woofy play              play with the dog',
    '  woofy rest              tell the dog to rest',
    '  woofy name <name>       rename the dog',
    '  woofy stats             print current stats from ~/.woofy/state.json',
    '  woofy bark              send a test bark to a running woofy',
    '  woofy alert [msg]       send a test alert bark with optional message',
    '  woofy wander            trigger an immediate bottom-strip wander',
    '  woofy anims [filter]    list animation clips (optional substring filter)',
    '  woofy anim <name>       play a specific clip by exact name or substring',
    '  woofy install           install Claude Code hooks into ~/.claude/settings.json',
    '  woofy uninstall         remove the hooks',
    '  woofy help              show this'
  ].join('\n'));
}

(async () => {
  switch (cmd) {
    case undefined:
    case 'foreground':
      await maybeFirstRunNamePrompt();
      start(false);
      break;
    case 'start':
      await maybeFirstRunNamePrompt();
      start(true);
      break;
    case 'bark':
      await fire('done');
      break;
    case 'alert':
      await fire('alert', process.argv.slice(3).join(' ') || undefined);
      break;
    case 'test':
      await fire('test');
      break;
    case 'anim':
      await playAnim(process.argv.slice(3).join(' '));
      break;
    case 'anims':
    case 'clips':
      listAnims(process.argv[3]);
      break;
    case 'wander':
      await notify({ type: 'wander' });
      console.log('sent wander');
      break;
    case 'pet':
    case 'feed':
    case 'play':
    case 'rest':
      await doAction(cmd);
      break;
    case 'name':
      await doName(process.argv.slice(3).join(' '));
      break;
    case 'stats':
      showStats();
      break;
    case 'install':
      await maybeFirstRunNamePrompt();
      require('../scripts/install');
      break;
    case 'uninstall':
      require('../scripts/uninstall');
      break;
    case 'help':
    case '-h':
    case '--help':
      help();
      break;
    default:
      console.error('unknown command: ' + cmd);
      help();
      process.exit(1);
  }
})();
