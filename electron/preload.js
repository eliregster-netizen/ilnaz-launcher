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
});
