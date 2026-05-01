const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs-extra');
const Client = require('discord-rpc');
const mc = require('./minecraft');

let mainWindow;
let rpcClient;
const DISCORD_CLIENT_ID = '1499874663642173461';

const INI_GAMES_PATH = path.join(app.getPath('userData'), 'games.json');
const startTime = new Date();

// Track current presence state
let currentPresence = { status: 'online', details: 'В главном меню', playingGame: false };
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
    frame: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
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

function updatePresence(status, details, isPlayingGame = false) {
  currentPresence = { status, details, playingGame: isPlayingGame };
  if (!rpcClient || !rpcClient.user) return;

  if (isPlayingGame) {
    const playtime = mc.getPlaytime();
    const elapsed = Math.floor(playtime.totalSeconds || 0);
    const startTs = new Date(Date.now() - elapsed * 1000);

    rpcClient.setActivity({
      details: details,
      state: `1.8.9 | ${playtime.hours}ч ${String(playtime.minutes).padStart(2, '0')}м`,
      startTimestamp: startTs,
      largeImageKey: 'minecraft_logo',
      largeImageText: 'Minecraft 1.8.9',
      smallImageKey: 'ilnaz_logo',
      smallImageText: 'ILNAZ GAMING LAUNCHER',
      instance: false,
      buttons: [
        { label: 'ILNAZ Launcher', url: 'https://ilnaz-launcher.onrender.com' }
      ],
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
  updatePresence(status, details, false);
  return { success: true };
});

// Minecraft IPC handlers
ipcMain.handle('get-minecraft-status', () => mc.getStatus());

ipcMain.handle('download-minecraft', async (_event, userData) => {
  let currentStageText = '';
  const result = await mc.downloadMinecraft((stage, dl, total, currentIdx, totalItems) => {
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

ipcMain.handle('launch-minecraft', async (_event, username, userId) => {
  if (mc.isMinecraftRunning()) return { success: false, error: 'Already running' };

  mc.setOnExit(() => {
    mainWindow.webContents.send('minecraft-exited', {});
    updatePresence('online', 'В главном меню', false);
  });

  const result = await mc.launchMinecraft(username, (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    updatePresence('online', `Играет в Minecraft ${hours}ч ${minutes}м`, true);
  });

  if (result.success) {
    updatePresence('online', 'Играет в Minecraft', true);
    if (userId && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('minecraft-launched', { userId });
    }
  }

  return result;
});

ipcMain.handle('save-minecraft-settings', (_event, settings) => {
  mc.saveSettings(settings);
  return { success: true };
});

// Game IPC
ipcMain.handle('get-games', () => getGames());

ipcMain.handle('import-game', async (_event, filePath, type) => {
  const games = getGames();
  let game;
  if (type === 'desktop') {
    game = await parseDesktopEntry(filePath);
    game.filePath = filePath;
  } else {
    game = { name: path.basename(filePath), exec: filePath, filePath, icon: '', source: 'executable' };
  }
  game.id = Date.now().toString();
  game.addedAt = new Date().toISOString();
  games.push(game);
  saveGames(games);
  return game;
});

ipcMain.handle('remove-game', (_event, gameId) => {
  const games = getGames().filter(g => g.id !== gameId);
  saveGames(games);
  return true;
});

ipcMain.handle('launch-game', async (_event, game) => {
  return new Promise((resolve) => {
    const child = spawn(game.exec, { shell: true, detached: true });
    child.unref();
    resolve({ success: true, pid: child.pid });
  });
});

ipcMain.handle('select-game-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Game Files', extensions: ['desktop', 'exe', 'sh'] }] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-game-desktop', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Desktop Entries', extensions: ['desktop'] }] });
  return result.canceled ? null : result.filePaths[0];
});

// Window controls
ipcMain.handle('close-app', () => app.quit());
ipcMain.handle('minimize-app', () => mainWindow.minimize());
ipcMain.handle('maximize-app', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

// App lifecycle
app.whenReady().then(() => {
  initDiscordRPC();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
