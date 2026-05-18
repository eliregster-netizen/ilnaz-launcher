const { net, app } = require('electron');
const fs = require('fs-extra');
const path = require('path');

// Получить данные игры по ID (из catalog.json)
async function getGameById(gameId) {
  try {
    // Use the SAME path as in main.js get-catalog-json handler
    let catalogPath;
    
    if (app && app.isPackaged) {
      // In packaged app, try userData first, then app resource
      catalogPath = path.join(app.getPath('userData'), 'catalog.json');
      if (!await fs.pathExists(catalogPath)) {
        catalogPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'catalog.json');
      }
      if (!await fs.pathExists(catalogPath)) {
        catalogPath = path.join(process.resourcesPath, 'app', 'dist', 'catalog.json');
      }
    } else {
      // In development
      catalogPath = path.join(__dirname, '../public/catalog.json');
    }
    
    console.log('[game-catalog] Reading catalog from:', catalogPath);
    
    if (await fs.pathExists(catalogPath)) {
      const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
      const game = catalog.find(g => g.id === gameId);
      if (!game) {
        console.error('[game-catalog] Game not found:', gameId);
        console.log('[game-catalog] Available games:', catalog.map(g => g.id));
      }
      return game;
    } else {
      console.error('[game-catalog] Catalog file not found at:', catalogPath);
    }
  } catch (e) { 
    console.error('[game-catalog] Catalog read error:', e); 
  }
  return null;
}

// Загрузка игры с прогрессом
async function downloadGame(gameData, os, progressCallback) {
  if (!gameData) throw new Error('Game data is required');
  
  const url = gameData.sources?.[os];
  if (!url) throw new Error(`No download source for ${os}`);
  
  // Создаём временную папку
  const tempDir = path.join(app.getPath('userData'), 'temp-downloads');
  await fs.ensureDir(tempDir);
  
  const fileName = path.basename(url) || `game_${gameId}`;
  const filePath = path.join(tempDir, fileName);
  
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    let fileStream;
    let downloaded = 0;
    let total = 0;
    
    request.on('response', (response) => {
      total = parseInt(response.headers['content-length'] || '0', 10);
      fileStream = fs.createWriteStream(filePath);
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        fileStream.write(chunk);
        if (progressCallback && total > 0) {
          progressCallback(downloaded, total, 'Загрузка...');
        }
      });
      
      response.on('end', async () => {
        fileStream.end();
        progressCallback?.(downloaded, total, 'Завершено');
        
        try {
          // Распаковываем если нужно
          const finalPath = await extractIfNeeded(filePath, gameData, os);
          
          // Добавляем в библиотеку
          const games = getGames();
          games.push({
            id: gameId,
            name: gameData.name,
            exec: finalPath, // путь к исполняемому (упростим)
            filePath: finalPath,
            icon: gameData.cover,
            source: 'catalog'
          });
          saveGames(games);
          
          resolve({ success: true, path: finalPath });
        } catch (err) {
          reject(err);
        }
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.end();
  });
}

// Распаковка архивов (упрощённая версия)
async function extractIfNeeded(filePath, gameData, os) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.gz' || ext === '.tar.gz') {
    // Для Linux .tar.gz - упрощённо, в реальности нужно использовать tar модуль
    return filePath; // пока оставляем как есть
  } else if (ext === '.zip') {
    // Для .zip - нужно распаковать
    return filePath; // упрощённо
  } else if (ext === '.exe') {
    // Windows - просто запускаем .exe
    return filePath;
  } else if (ext === '.dmg') {
    // macOS - просто монтируем .dmg
    return filePath;
  }
  return filePath;
}

module.exports = { downloadGame };
