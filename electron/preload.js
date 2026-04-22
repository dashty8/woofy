const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('woofy', {
  onNotify: (cb) => ipcRenderer.on('notify', (_, data) => cb(data)),
  onPlayClip: (cb) => ipcRenderer.on('play-clip', (_, name) => cb(name)),
  onState: (cb) => ipcRenderer.on('state', (_, s) => cb(s)),
  sendClips: (names) => ipcRenderer.send('clips-loaded', names),
  action: (type) => ipcRenderer.send('action', type)
});
