const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getGames: () => ipcRenderer.invoke('get-games'),
  importGame: (filePath, type) => ipcRenderer.invoke('import-game', filePath, type),
  removeGame: (gameId) => ipcRenderer.invoke('remove-game', gameId),
  launchGame: (game) => ipcRenderer.invoke('launch-game', game),
  selectGameFile: () => ipcRenderer.invoke('select-game-file'),
  selectGameDesktop: () => ipcRenderer.invoke('select-game-desktop'),
  closeApp: () => ipcRenderer.invoke('close-app'),
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
  maximizeApp: () => ipcRenderer.invoke('maximize-app'),
  setDiscordPresence: (status, details) => ipcRenderer.invoke('set-discord-presence', status, details),
  getMinecraftStatus: () => ipcRenderer.invoke('get-minecraft-status'),
  downloadMinecraft: (userData) => ipcRenderer.invoke('download-minecraft', userData),
  cancelMinecraftDownload: () => ipcRenderer.invoke('cancel-minecraft-download'),
  launchMinecraft: (username, userId) => ipcRenderer.invoke('launch-minecraft', username, userId),
  saveMinecraftSettings: (settings) => ipcRenderer.invoke('save-minecraft-settings', settings),
  onMinecraftDownloadProgress: (cb) => ipcRenderer.on('minecraft-download-progress', (_e, data) => cb(data)),
  onMinecraftDownloadComplete: (cb) => ipcRenderer.on('minecraft-download-complete', (_e, data) => cb(data)),
  onMinecraftPlaytime: (cb) => ipcRenderer.on('minecraft-playtime', (_e, data) => cb(data)),
  onMinecraftLaunched: (cb) => ipcRenderer.on('minecraft-launched', (_e, data) => cb(data)),
});
