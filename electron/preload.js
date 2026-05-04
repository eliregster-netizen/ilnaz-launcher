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
  setAlwaysOnTop: (value) => ipcRenderer.invoke('set-always-on-top', value),
  setDiscordPresence: (status, details) => ipcRenderer.invoke('set-discord-presence', status, details),
  getMinecraftStatus: () => ipcRenderer.invoke('get-minecraft-status'),
  getMinecraftVersions: () => ipcRenderer.invoke('get-minecraft-versions'),
  fetchMinecraftVersions: () => ipcRenderer.invoke('fetch-minecraft-versions'),
  downloadMinecraft: (version) => ipcRenderer.invoke('download-minecraft', { version }),
  cancelMinecraftDownload: () => ipcRenderer.invoke('cancel-minecraft-download'),
  launchMinecraft: (version, userId) => ipcRenderer.invoke('launch-minecraft', version, userId),
  saveMinecraftSettings: (settings) => ipcRenderer.invoke('save-minecraft-settings', settings),
  onMinecraftDownloadProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('minecraft-download-progress', handler);
    return () => ipcRenderer.removeListener('minecraft-download-progress', handler);
  },
  onMinecraftDownloadComplete: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('minecraft-download-complete', handler);
    return () => ipcRenderer.removeListener('minecraft-download-complete', handler);
  },
  onMinecraftPlaytime: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('minecraft-playtime', handler);
    return () => ipcRenderer.removeListener('minecraft-playtime', handler);
  },
  onMinecraftLaunched: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('minecraft-launched', handler);
    return () => ipcRenderer.removeListener('minecraft-launched', handler);
  },
  onMinecraftExited: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('minecraft-exited', handler);
    return () => ipcRenderer.removeListener('minecraft-exited', handler);
  },
  microsoftLogin: () => ipcRenderer.invoke('microsoft-login'),
  microsoftLogout: () => ipcRenderer.invoke('microsoft-logout'),
  elybyLogin: (username, password) => ipcRenderer.invoke('elyby-login', username, password),
  offlineLogin: (username) => ipcRenderer.invoke('offline-login', username),
  getMinecraftAccounts: () => ipcRenderer.invoke('get-minecraft-accounts'),
  setMinecraftActiveAccount: (accountId) => ipcRenderer.invoke('set-minecraft-active-account', accountId),
  removeMinecraftAccount: (accountId) => ipcRenderer.invoke('remove-minecraft-account', accountId),
  downloadJava8: () => ipcRenderer.invoke('download-java8'),
  isJava8Downloaded: () => ipcRenderer.invoke('is-java8-downloaded'),
  downloadJava17: () => ipcRenderer.invoke('download-java17'),
  isJava17Downloaded: () => ipcRenderer.invoke('is-java17-downloaded'),
  deleteMinecraftVersion: (version) => ipcRenderer.invoke('delete-minecraft-version', version),
  reinstallMinecraftVersion: (version) => ipcRenderer.invoke('reinstall-minecraft-version', version),
  isOptifineInstalled: (version) => ipcRenderer.invoke('is-optifine-installed', version),
  checkOptifineAvailable: (version) => ipcRenderer.invoke('check-optifine-available', version),
  downloadOptifine: (version) => ipcRenderer.invoke('download-optifine', version),
  removeOptifine: (version) => ipcRenderer.invoke('remove-optifine', version),
  onJava8DownloadProgress: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on('java8-download-progress', handler);
    return () => ipcRenderer.removeListener('java8-download-progress', handler);
  },
  getThemes: () => ipcRenderer.invoke('get-themes'),
  getActiveTheme: () => ipcRenderer.invoke('get-active-theme'),
  setActiveTheme: (themeId) => ipcRenderer.invoke('set-active-theme', themeId),
  createTheme: (themeData) => ipcRenderer.invoke('create-theme', themeData),
  updateTheme: (themeId, updates) => ipcRenderer.invoke('update-theme', themeId, updates),
  deleteTheme: (themeId) => ipcRenderer.invoke('delete-theme', themeId),
  exportTheme: (themeId) => ipcRenderer.invoke('export-theme', themeId),
  importThemeFile: (filePath) => ipcRenderer.invoke('import-theme-file', filePath),
  selectThemeFile: () => ipcRenderer.invoke('select-theme-file'),
  saveThemeFile: (themeData) => ipcRenderer.invoke('save-theme-file', themeData),
});
