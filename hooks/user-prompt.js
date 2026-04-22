#!/usr/bin/env node
// Claude Code UserPromptSubmit hook — fires each time the user submits a prompt.

const { notify } = require('../lib/notify');

let buf = '';
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', async () => {
  try { JSON.parse(buf || '{}'); } catch {}
  await notify({ type: 'prompt' });
  process.exit(0);
});
