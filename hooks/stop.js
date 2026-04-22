#!/usr/bin/env node
// Claude Code Stop hook — fires when Claude finishes a turn.

const { notify } = require('../lib/notify');

let buf = '';
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', async () => {
  try {
    // Payload is JSON but we don't need anything from it for a simple "done" bark.
    JSON.parse(buf || '{}');
  } catch {}
  await notify({ type: 'done' });
  process.exit(0);
});
