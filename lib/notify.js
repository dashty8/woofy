// Fire-and-forget WS client. Silent if woofy isn't running — hooks should never fail.

const WebSocket = require('ws');

const WS_PORT = 41415;

function notify(msg) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      const ws = new WebSocket('ws://127.0.0.1:' + WS_PORT);
      ws.on('open', () => {
        try { ws.send(JSON.stringify(msg)); } catch {}
        try { ws.close(); } catch {}
        finish();
      });
      ws.on('error', finish);
      ws.on('close', finish);
      setTimeout(() => { try { ws.close(); } catch {} finish(); }, 500);
    } catch {
      finish();
    }
  });
}

module.exports = { notify };
