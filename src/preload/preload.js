const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('water', {
  onShow: (cb) => ipcRenderer.on('popup:show', (_e, payload) => cb(payload)),
  yes: () => ipcRenderer.invoke('reminder:yes'),
  snooze: () => ipcRenderer.invoke('reminder:snooze'),
  closePopup: () => ipcRenderer.send('popup:close'),
  setInteractive: (on) => ipcRenderer.send('popup:interactive', !!on),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
});
