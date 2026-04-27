const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('woofy', {
  onNotify: (cb) => ipcRenderer.on('notify', (_, data) => cb(data)),
  onPlayClip: (cb) => ipcRenderer.on('play-clip', (_, name) => cb(name)),
  onState: (cb) => ipcRenderer.on('state', (_, s) => cb(s)),
  sendClips: (names) => ipcRenderer.send('clips-loaded', names),
  action: (type) => ipcRenderer.send('action', type),
  // Manual window drag — main keeps the initial position, renderer streams cumulative deltas.
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('drag-move', dx, dy),
  dragEnd: () => ipcRenderer.send('drag-end'),
  // Walk-to-clicked-position — opens a targeting overlay; pick fires walkToPick from the overlay.
  walkToStart: () => ipcRenderer.send('walk-to-start'),
  walkToPick: (x, y) => ipcRenderer.send('walk-to-pick', x, y),
  walkToCancel: () => ipcRenderer.send('walk-to-cancel'),
  // Manual shutdown — persists state then quits the app cleanly.
  quit: () => ipcRenderer.send('quit')
});
