#!/usr/bin/env node
// Claude Code Notification hook — fires when Claude is waiting on user input or tool permission.

const { notify } = require('../lib/notify');

let buf = '';
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', async () => {
  let message;
  try {
    const parsed = JSON.parse(buf || '{}');
    message = typeof parsed.message === 'string' ? parsed.message : undefined;
  } catch {}
  await notify({ type: 'alert', message });
  process.exit(0);
});
