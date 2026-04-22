#!/usr/bin/env node
// Claude Code SessionStart hook — fires when Claude starts a session.
// If woofy isn't running, spawn it detached. Then send a 'hi' event.

const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { notify } = require('../lib/notify');

const WS_PORT = 41415;
const ROOT = path.resolve(__dirname, '..');

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(300);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.once('error', () => resolve(false));
    sock.connect(port, '127.0.0.1');
  });
}

function launchWoofy() {
  try {
    const electronBin = require('electron');
    const child = spawn(electronBin, [ROOT], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } catch {
    // Silent — hooks must never fail Claude startup.
  }
}

let buf = '';
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', async () => {
  try { JSON.parse(buf || '{}'); } catch {}
  const running = await portOpen(WS_PORT);
  if (!running) {
    launchWoofy();
    // Give the window a moment to come up, then send hi.
    setTimeout(async () => {
      await notify({ type: 'hi' });
      process.exit(0);
    }, 2500);
  } else {
    await notify({ type: 'hi' });
    process.exit(0);
  }
});
