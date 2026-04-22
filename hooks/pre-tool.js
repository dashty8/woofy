#!/usr/bin/env node
// Claude Code PreToolUse hook — fires before each tool call.

const { notify } = require('../lib/notify');

let buf = '';
process.stdin.on('data', (d) => { buf += d; });
process.stdin.on('end', async () => {
  try { JSON.parse(buf || '{}'); } catch {}
  await notify({ type: 'tool' });
  process.exit(0);
});
