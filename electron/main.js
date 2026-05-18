const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs-extra');
const Client = require('discord-rpc');
const mc = require('./minecraft');
const themes = require('./themes');
const https = require('https');
const http = require('http');
const gameCatalog = require('./game-catalog');

let mainWindow;
let rpcClient;
const DISCORD_CLIENT_ID = '1499874663642173461';

const INI_GAMES_PATH = path.join(app.getPath('userData'), 'games.json');
const startTime = new Date();

// Track current presence state
let currentPresence = { status: 'online', details: 'В главном меню', playingGame: false, playingMusic: false, musicTrack: null };
let minecraftPlayInterval = null;

function getGames() {
  if (!fs.existsSync(INI_GAMES_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(INI_GAMES_PATH, 'utf8')); } catch (e) { return []; }
}

function saveGames(games) {
  fs.writeFileSync(INI_GAMES_PATH, JSON.stringify(games, null, 2));
}

async function parseDesktopEntry(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const name = content.match(/Name=(.+)/)?.[1]?.trim() || 'Unknown Game';
  const exec = content.match(/Exec=(.+)/)?.[1]?.trim() || '';
  const icon = content.match(/Icon=(.+)/)?.[1]?.trim() || '';
  return { name, exec, icon, source: 'desktop' };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      webviewTag: true,
      allowpopups: true
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow.show());

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }
}

// Discord RPC
function initDiscordRPC() {
  rpcClient = new Client.Client({ transport: 'ipc' });

  rpcClient.on('ready', () => {
    console.log('Discord RPC connected');
    updatePresence(currentPresence.status, currentPresence.details, currentPresence.playingGame);
  });

  rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch(err => {
    console.log('Discord RPC not available:', err.message);
  });
}

function updatePresence(status, details, isPlayingGame = false, isPlayingMusic = false, musicTrack = null) {
  currentPresence = { status, details, playingGame: isPlayingGame, playingMusic: isPlayingMusic, musicTrack };
  if (!rpcClient || !rpcClient.user) return;

  if (isPlayingGame) {
    const settings = mc.getSettings();
    const version = settings.selectedVersion || '1.8.9';
    const playtime = mc.getPlaytimeForVersion(version);
    const elapsed = Math.floor(playtime.totalSeconds || 0);
    const startTs = new Date(Date.now() - elapsed * 1000);

    rpcClient.setActivity({
      details: 'Играет в Minecraft',
      state: version,
      startTimestamp: startTs,
      largeImageKey: 'minecraft_logo',
      largeImageText: `Minecraft ${version}`,
      smallImageKey: 'ilnaz_logo',
      smallImageText: 'ILNAZ GAMING LAUNCHER',
      instance: false,
      buttons: [
        { label: 'ILNAZ Launcher', url: 'https://ilnaz-launcher.onrender.com' }
      ],
    });
  } else if (isPlayingMusic && musicTrack) {
    const trackUrl = musicTrack.cover || 'https://ilnaz-launcher.onrender.com/logo.png';
    rpcClient.setActivity({
      details: musicTrack.name || 'Неизвестный трек',
      startTimestamp: startTime,
      largeImageKey: trackUrl,
      largeImageText: musicTrack.name || 'Музыка',
      smallImageKey: 'ilnaz_logo',
      smallImageText: 'ILNAZ GAMING LAUNCHER',
      instance: false,
    });
  } else {
    rpcClient.setActivity({
      details: details,
      state: status === 'online' ? 'В сети' : status === 'idle' ? 'Неактивен' : status === 'do_not_disturb' ? 'Не беспокоить' : 'Не в сети',
      startTimestamp: startTime,
      largeImageKey: 'ilnaz_logo',
      largeImageText: 'ILNAZ GAMING LAUNCHER',
      smallImageKey: status === 'online' ? 'status_online' : status === 'idle' ? 'status_idle' : status === 'do_not_disturb' ? 'status_dnd' : 'status_offline',
      smallImageText: status === 'online' ? 'В сети' : status === 'idle' ? 'Неактивен' : status === 'do_not_disturb' ? 'Не беспокоить' : 'Не в сети',
      instance: false,
      buttons: [
        { label: 'Открыть ILNAZ Launcher', url: 'https://ilnaz-launcher.onrender.com' }
      ],
    });
  }
}

ipcMain.handle('set-discord-presence', (_event, status, details) => {
  if (mc.isMinecraftRunning()) return { success: false };
  updatePresence(status, details, false, false, null);
  return { success: true };
});

ipcMain.handle('set-music-presence', (_event, trackInfo) => {
  if (!trackInfo) {
    updatePresence(currentPresence.status, currentPresence.details, false, false, null);
    return { success: true };
  }
  const musicTrack = {
    name: trackInfo.name || 'Неизвестный трек',
    author: trackInfo.author || 'Неизвестно'
  };
  updatePresence(currentPresence.status, currentPresence.details, false, true, musicTrack);
  return { success: true };
});

// Minecraft IPC handlers
ipcMain.handle('get-minecraft-status', () => mc.getStatus());
ipcMain.handle('get-minecraft-versions', () => mc.getInstalledVersions());
ipcMain.handle('fetch-minecraft-versions', async () => {
  try {
    return { success: true, versions: await mc.fetchAvailableVersions() };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('download-minecraft', async (_event, { version }) => {
  let currentStageText = '';
  const result = await mc.downloadMinecraft(version, (stage, dl, total, currentIdx, totalItems) => {
    currentStageText = mc.getStatus().stage;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('minecraft-download-progress', {
        stage,
        downloaded: dl,
        total,
        currentIdx,
        totalItems,
        stageText: currentStageText,
      });
    }
  });

  if (result.success && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('minecraft-download-complete', { success: true });
  }

  return result;
});

ipcMain.handle('cancel-minecraft-download', () => {
  mc.cancelDownload();
  return { success: true };
});

ipcMain.handle('launch-minecraft', async (_event, version, userId) => {
  try {
    if (mc.isMinecraftRunning()) return { success: false, error: 'Already running' };

    mc.setOnExit(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('minecraft-exited', {});
      }
      updatePresence('online', 'В главном меню', false);
    });

    const result = await mc.launchMinecraft(version, () => {
      updatePresence('online', 'Играет в Minecraft', true);
    });

    if (result.success) {
      updatePresence('online', 'Играет в Minecraft', true);
      mainWindow.webContents.send('minecraft-launched', {});
    }

    return result;
  } catch (err) {
    console.error('[MC Launch Error]', err.message, err.stack);
  return { success: false, error: err.message };
  }
});

// ===== WINDOW CONTROL IPC HANDLERS =====
ipcMain.handle('close-app', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('minimize-app', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-app', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

// ===== GAME CATALOG IPC HANDLERS =====
// Загрузка игры из каталога
ipcMain.handle('download-catalog-game', async (_event, { gameId, os }) => {
  const progressCallback = (downloaded, total, stage) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('catalog-download-progress', {
        gameId,
        downloaded,
        total,
        percent: total > 0 ? (downloaded / total * 100) : 0,
        stage
      });
    }
  };
  
  try {
    // First, get the game data from catalog.json
    const fs = require('fs-extra');
    const path = require('path');
    
    let catalogPath;
    if (app.isPackaged) {
      catalogPath = path.join(app.getPath('userData'), 'catalog.json');
      if (!await fs.pathExists(catalogPath)) {
        catalogPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'catalog.json');
      }
      if (!await fs.pathExists(catalogPath)) {
        catalogPath = path.join(process.resourcesPath, 'app', 'dist', 'catalog.json');
      }
    } else {
      catalogPath = path.join(__dirname, '..', 'public', 'catalog.json');
    }
    
    console.log('[download-catalog-game] Reading catalog from:', catalogPath);
    
    if (!await fs.pathExists(catalogPath)) {
      throw new Error(`Catalog file not found at ${catalogPath}`);
    }
    
    const catalog = await fs.readJson(catalogPath);
    const gameData = catalog.find(g => g.id === gameId);
    
    if (!gameData) {
      throw new Error(`Game ${gameId} not found in catalog`);
    }
    
    // Pass gameData to downloadGame
    const result = await gameCatalog.downloadGame(gameData, os, progressCallback);
    
    if (result.success && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('catalog-download-complete', { gameId });
    }
    return result;
  } catch (err) {
    console.error('[download-catalog-game] Error:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('catalog-download-error', { gameId, error: err.message });
    }
    throw err;
  }
});

// Отмена загрузки (упрощённо)
ipcMain.on('cancel-catalog-download', (_event, { gameId }) => {
  console.log('Cancel download for game:', gameId);
  // В реальной реализации нужно хранить активные загрузки и отменять их
});

// ===== MISSING HANDLERS =====

// Загрузка списка игр из games.json
ipcMain.handle('get-games', async () => {
  const fs = require('fs-extra');
  const path = require('path');
  const gamesPath = path.join(app.getPath('userData'), 'games.json');
  
  try {
    if (await fs.pathExists(gamesPath)) {
      const content = await fs.readFile(gamesPath, 'utf8');
      return JSON.parse(content);
    }
    return [];
  } catch (err) {
    console.error('[get-games] Error:', err.message);
    return [];
  }
});

// Проверка наличия Java 8 для Minecraft
ipcMain.handle('is-java8-downloaded', async () => {
  const fs = require('fs-extra');
  const path = require('path');
  
  // Путь к Java 8 в директории Minecraft
  const java8Path = path.join(app.getPath('userData'), '.minecraft', 'java8');
  
  try {
    const exists = await fs.pathExists(java8Path);
    return exists;
  } catch (err) {
    console.error('[is-java8-downloaded] Error:', err.message);
    return false;
  }
});

// ===== Theme IPC handlers =====
ipcMain.handle('get-themes', async () => {
  try {
    return themes.getAllThemes();
  } catch (err) {
    console.error('[get-themes] Error:', err.message);
    return [];
  }
});

ipcMain.handle('get-active-theme', async () => {
  try {
    return themes.getActiveTheme();
  } catch (err) {
    console.error('[get-active-theme] Error:', err.message);
    return themes.getThemeById(themes.DEFAULT_THEME_ID) || null;
  }
});

ipcMain.handle('set-active-theme', async (_event, themeId) => {
  try {
    return themes.setActiveTheme(themeId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('create-theme', async (_event, themeData) => {
  try {
    const theme = themes.createTheme(themeData);
    return { success: true, theme };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-theme', async (_event, themeId, updates) => {
  try {
    const theme = themes.updateTheme(themeId, updates);
    if (!theme) return { success: false, error: 'Тема не найдена' };
    return { success: true, theme };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-theme', async (_event, themeId) => {
  try {
    return themes.deleteTheme(themeId);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-theme', async (_event, themeId) => {
  try {
    const data = themes.exportTheme(themeId);
    if (!data) return { success: false, error: 'Тема не найдена' };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('import-theme-file', async (_event, filePath) => {
  try {
    return await themes.importTheme(filePath);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-theme-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите файл темы',
      filters: [
        { name: 'Темы ILNAZ', extensions: ['ilnztheme'] },
        { name: 'Все файлы', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (err) {
    console.error('[select-theme-file] Error:', err.message);
    return null;
  }
});

ipcMain.handle('save-theme-file', async (_event, themeData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить тему',
      defaultPath: `${themeData.name || 'theme'}.ilnztheme`,
      filters: [
        { name: 'Темы ILNAZ', extensions: ['ilnztheme'] },
        { name: 'Все файлы', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePath) {
      await fs.writeJson(result.filePath, themeData, { spaces: 2 });
      return { success: true };
    }
    return { success: false, error: 'Отменено пользователем' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Проверка Java 17 (для новых версий Minecraft)
ipcMain.handle('is-java17-downloaded', async () => {
  const fs = require('fs-extra');
  const path = require('path');
  
  const java17Path = path.join(app.getPath('userData'), '.minecraft', 'java17');
  
  try {
    const exists = await fs.pathExists(java17Path);
    return exists;
  } catch (err) {
    console.error('[is-java17-downloaded] Error:', err.message);
    return false;
  }
});

// Выбор игры через диалог (для импорта)
ipcMain.handle('select-game-desktop', async () => {
  const { dialog } = require('electron');
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите исполняемый файл игры',
      filters: [
        { name: 'Executable', extensions: ['exe', 'AppImage', 'sh', 'bat', 'cmd'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false, canceled: true };
  } catch (err) {
    console.error('[select-game-desktop] Error:', err.message);
    return { success: false, error: err.message };
  }
});

// Установка прокси для запросов
ipcMain.handle('set-proxy', async (_event, proxyUrl) => {
  try {
    if (mainWindow && mainWindow.webContents) {
      await mainWindow.webContents.session.setProxy({
        proxyRules: proxyUrl || '',
      });
      console.log('[set-proxy] Proxy set to:', proxyUrl || 'none');
      return { success: true };
    }
    return { success: false, error: 'Window not available' };
  } catch (err) {
    console.error('[set-proxy] Error:', err.message);
    return { success: false, error: err.message };
  }
});

// Чтение catalog.json для Каталога
ipcMain.handle('get-catalog-json', async () => {
  const fs = require('fs-extra');
  const path = require('path');
  
  let catalogPath;
  
  if (app.isPackaged) {
    // In production, try userData first (where we save changes), then resources
    catalogPath = path.join(app.getPath('userData'), 'catalog.json');
    if (!await fs.pathExists(catalogPath)) {
      catalogPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'catalog.json');
    }
    if (!await fs.pathExists(catalogPath)) {
      catalogPath = path.join(process.resourcesPath, 'app', 'dist', 'catalog.json');
    }
  } else {
    // In development
    catalogPath = path.join(__dirname, '..', 'public', 'catalog.json');
  }
  
  try {
    console.log('[get-catalog-json] Reading from:', catalogPath);
    if (await fs.pathExists(catalogPath)) {
      const data = await fs.readJson(catalogPath);
      return { success: true, games: data };
    }
    return { success: false, error: 'catalog.json not found at ' + catalogPath };
  } catch (err) {
    console.error('[get-catalog-json] Error:', err.message);
    return { success: false, error: err.message };
  }
});

// ===== CATALOG MANAGEMENT (Owner/Admin only) =====
ipcMain.handle('save-catalog-json', async (_event, catalogData) => {
  const fs = require('fs-extra');
  const path = require('path');
  
  // In production, save to userData directory
  const catalogPath = app.isPackaged 
    ? path.join(app.getPath('userData'), 'catalog.json')
    : path.join(__dirname, '..', 'public', 'catalog.json');
  
  try {
    await fs.writeJson(catalogPath, catalogData, { spaces: 2 });
    console.log('[save-catalog-json] Catalog saved to:', catalogPath);
    return { success: true };
  } catch (err) {
    console.error('[save-catalog-json] Error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('add-catalog-game', async (_event, game) => {
  const fs = require('fs-extra');
  const path = require('path');
  
  const catalogPath = app.isPackaged 
    ? path.join(app.getPath('userData'), 'catalog.json')
    : path.join(__dirname, '..', 'public', 'catalog.json');
  
  try {
    let catalog = [];
    if (await fs.pathExists(catalogPath)) {
      catalog = await fs.readJson(catalogPath);
    }
    
    // Check if game with same id already exists
    if (catalog.find(g => g.id === game.id)) {
      return { success: false, error: 'Game with this ID already exists' };
    }
    
    catalog.push(game);
    await fs.writeJson(catalogPath, catalog, { spaces: 2 });
    console.log('[add-catalog-game] Game added:', game.name);
    return { success: true };
  } catch (err) {
    console.error('[add-catalog-game] Error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-catalog-game', async (_event, gameId, updates) => {
  const fs = require('fs-extra');
  const path = require('path');
  
  const catalogPath = app.isPackaged 
    ? path.join(app.getPath('userData'), 'catalog.json')
    : path.join(__dirname, '..', 'public', 'catalog.json');
  
  try {
    let catalog = [];
    if (await fs.pathExists(catalogPath)) {
      catalog = await fs.readJson(catalogPath);
    }
    
    const index = catalog.findIndex(g => g.id === gameId);
    if (index === -1) {
      return { success: false, error: 'Game not found' };
    }
    
    catalog[index] = { ...catalog[index], ...updates };
    await fs.writeJson(catalogPath, catalog, { spaces: 2 });
    console.log('[update-catalog-game] Game updated:', gameId);
    return { success: true };
  } catch (err) {
    console.error('[update-catalog-game] Error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-catalog-game', async (_event, gameId) => {
  const fs = require('fs-extra');
  const path = require('path');
  
  const catalogPath = app.isPackaged 
    ? path.join(app.getPath('userData'), 'catalog.json')
    : path.join(__dirname, '..', 'public', 'catalog.json');
  
  try {
    let catalog = [];
    if (await fs.pathExists(catalogPath)) {
      catalog = await fs.readJson(catalogPath);
    }
    
    const newCatalog = catalog.filter(g => g.id !== gameId);
    await fs.writeJson(catalogPath, newCatalog, { spaces: 2 });
    console.log('[delete-catalog-game] Game deleted:', gameId);
    return { success: true };
  } catch (err) {
    console.error('[delete-catalog-game] Error:', err.message);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  themes.initThemes();
  initDiscordRPC();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
