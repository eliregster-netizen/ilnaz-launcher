const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs-extra');

let mainWindow;

const INI_GAMES_PATH = path.join(app.getPath('userData'), 'games.json');

function getGames() {
  if (!fs.existsSync(INI_GAMES_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(INI_GAMES_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('get-games', () => getGames());

ipcMain.handle('import-game', async (_event, filePath, type) => {
  const games = getGames();
  let game;

  if (type === 'desktop') {
    game = await parseDesktopEntry(filePath);
    game.filePath = filePath;
  } else {
    game = {
      name: path.basename(filePath),
      exec: filePath,
      filePath: filePath,
      icon: '',
      source: 'executable',
    };
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
    const cmd = game.exec;
    const child = spawn(cmd, { shell: true, detached: true });
    child.unref();
    resolve({ success: true, pid: child.pid });
  });
});

ipcMain.handle('select-game-file', async (_event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Game Files', extensions: ['desktop', 'exe', 'sh'] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-game-desktop', async (_event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Desktop Entries', extensions: ['desktop'] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('close-app', () => {
  app.quit();
});

ipcMain.handle('minimize-app', () => {
  mainWindow.minimize();
});

ipcMain.handle('maximize-app', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
