const { app } = require('electron');
const path = require('path');
const fs = require('fs-extra');

const THEMES_DIR = path.join(app.getPath('userData'), 'themes');
const THEMES_INDEX_PATH = path.join(THEMES_DIR, 'themes_index.json');
const DEFAULT_THEME_ID = 'ilnaz-default';
const DEFAULT_SOUND_DIR = path.join(THEMES_DIR, 'default-sound');
const DEFAULT_SOUND_PATH = 'file://' + path.join(DEFAULT_SOUND_DIR, 'startgame.flac').replace(/\\/g, '/');

const DEFAULT_THEME = {
  id: DEFAULT_THEME_ID,
  name: 'ILNAZ Default',
  author: 'ILNAZ Launcher',
  version: '1.0',
  description: 'Пустое описание.',
  isBuiltIn: true,
  isDefault: true,
  createdAt: new Date().toISOString(),
  launcherTitle: 'ILNAZ GAMING LAUNCHER',
  colors: {
    bgPrimary: '#0a0a1a',
    bgSecondary: '#12122e',
    bgTertiary: '#1a1a3e',
    accentPrimary: '#7b2ff7',
    accentSecondary: '#00d4ff',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    textMuted: 'rgba(255, 255, 255, 0.4)',
    glassBg: 'rgba(255, 255, 255, 0.05)',
    glassBgHover: 'rgba(255, 255, 255, 0.1)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    glassBorderHover: 'rgba(255, 255, 255, 0.2)',
    success: '#00ff88',
    warning: '#ffaa00',
    danger: '#ff4466',
  },
  background: {
    type: 'gradient',
    value: 'radial-gradient(ellipse at 20% 80%, rgba(123, 47, 247, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(0, 212, 255, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(123, 47, 247, 0.05) 0%, transparent 70%)',
  },
  icon: null,
  soundPath: DEFAULT_SOUND_PATH,
};

function initThemes() {
  fs.ensureDirSync(THEMES_DIR);
  fs.ensureDirSync(DEFAULT_SOUND_DIR);

  // Copy default sound if not exists
  const defaultSoundFile = path.join(DEFAULT_SOUND_DIR, 'startgame.flac');
  if (!fs.existsSync(defaultSoundFile)) {
    try {
      const srcSound = path.join(app.getPath('userData'), '../../Documents/startgame.flac');
      if (fs.existsSync(srcSound)) {
        fs.copyFileSync(srcSound, defaultSoundFile);
      }
    } catch (e) {}
  }

  if (!fs.existsSync(THEMES_INDEX_PATH)) {
    fs.writeJSONSync(THEMES_INDEX_PATH, {
      activeThemeId: DEFAULT_THEME_ID,
      themes: [DEFAULT_THEME],
    });
  } else {
    const index = fs.readJSONSync(THEMES_INDEX_PATH);
    if (!index.themes.find(t => t.id === DEFAULT_THEME_ID)) {
      index.themes.unshift(DEFAULT_THEME);
      if (!index.activeThemeId) index.activeThemeId = DEFAULT_THEME_ID;
    }
    // Ensure default theme has soundPath
    const defaultTheme = index.themes.find(t => t.id === DEFAULT_THEME_ID);
    if (defaultTheme && (!defaultTheme.soundPath || defaultTheme.soundPath === null)) {
      defaultTheme.soundPath = DEFAULT_SOUND_PATH;
    }
    fs.writeJSONSync(THEMES_INDEX_PATH, index);
  }
}

function saveBase64ToFile(themeId, base64, fileName) {
  if (!base64) return null;
  const dir = path.join(THEMES_DIR, themeId);
  fs.ensureDirSync(dir);
  const filePath = path.join(dir, fileName);
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return filePath;
}

function fileToProtocol(filePath) {
  if (!filePath) return null;
  return 'file://' + filePath.replace(/\\/g, '/');
}

function processTheme(theme) {
  const result = { ...theme };
  if (theme.background?.type === 'image' && theme.background?.value) {
    if (theme.background.value.startsWith('data:')) {
      const filePath = saveBase64ToFile(theme.id, theme.background.value, 'background.' + getExtensionFromDataUri(theme.background.value));
      if (filePath) {
        result.background = { ...theme.background, value: fileToProtocol(filePath) };
      }
    }
  }
  if (theme.icon && theme.icon.startsWith('data:')) {
    const filePath = saveBase64ToFile(theme.id, theme.icon, 'icon.' + getExtensionFromDataUri(theme.icon));
    if (filePath) {
      result.icon = fileToProtocol(filePath);
    }
  }
  // Handle sound file: if it's a data URI (audio), save to file
  if (theme.soundPath && theme.soundPath.startsWith('data:')) {
    const ext = theme.soundPath.match(/^data:audio\/(\w+);/);
    const soundExt = ext ? (ext[1] === 'flac' ? 'flac' : ext[1] === 'mpeg' ? 'mp3' : 'wav') : 'mp3';
    const filePath = saveBase64ToFile(theme.id, theme.soundPath, 'launch-sound.' + soundExt);
    if (filePath) {
      result.soundPath = fileToProtocol(filePath);
    }
  }
  return result;
}

function getExtensionFromDataUri(dataUri) {
  const match = dataUri.match(/^data:image\/(\w+);/);
  return match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'png';
}

function getIndex() {
  initThemes();
  return fs.readJSONSync(THEMES_INDEX_PATH);
}

function saveIndex(index) {
  fs.writeJSONSync(THEMES_INDEX_PATH, index);
}

function getThemeById(themeId) {
  const index = getIndex();
  const theme = index.themes.find(t => t.id === themeId);
  if (!theme) return null;
  return processTheme(theme);
}

function getAllThemes() {
  const index = getIndex();
  return index.themes.map(t => processTheme(t));
}

function getActiveTheme() {
  const index = getIndex();
  return getThemeById(index.activeThemeId) || DEFAULT_THEME;
}

function createTheme(themeData) {
  const index = getIndex();
  const newId = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const theme = {
    id: newId,
    name: themeData.name || 'Моя тема',
    author: themeData.author || 'Пользователь',
    version: themeData.version || '1.0',
    description: themeData.description || '',
    isBuiltIn: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    launcherTitle: themeData.launcherTitle || 'ILNAZ GAMING LAUNCHER',
    colors: { ...DEFAULT_THEME.colors, ...(themeData.colors || {}) },
    background: { ...(themeData.background || { type: 'gradient', value: '' }) },
    icon: themeData.icon || null,
    soundPath: themeData.soundPath || null,
  };
  index.themes.push(theme);
  saveIndex(index);

  // Process: save base64 to files and return paths
  const processed = processTheme(theme);

  // Update index with file paths instead of base64
  const themeIdx = index.themes.findIndex(t => t.id === newId);
  if (themeIdx !== -1) {
    index.themes[themeIdx] = {
      ...theme,
      background: processed.background,
      icon: processed.icon,
    };
    saveIndex(index);
  }

  return processed;
}

function updateTheme(themeId, updates) {
  const index = getIndex();
  const themeIdx = index.themes.findIndex(t => t.id === themeId);
  if (themeIdx === -1) return null;
  const existing = index.themes[themeIdx];

  const updated = {
    ...existing,
    ...updates,
    colors: { ...existing.colors, ...(updates.colors || {}) },
    background: { ...existing.background, ...(updates.background || {}) },
    soundPath: updates.soundPath !== undefined ? updates.soundPath : existing.soundPath,
  };
  index.themes[themeIdx] = updated;
  saveIndex(index);

  return processTheme(updated);
}

function deleteTheme(themeId) {
  if (themeId === DEFAULT_THEME_ID) return { success: false, error: 'Нельзя удалить встроенную тему' };
  const index = getIndex();
  const theme = index.themes.find(t => t.id === themeId);
  if (!theme) return { success: false, error: 'Тема не найдена' };
  if (theme.isBuiltIn) return { success: false, error: 'Нельзя удалить встроенную тему' };
  index.themes = index.themes.filter(t => t.id !== themeId);
  if (index.activeThemeId === themeId) {
    index.activeThemeId = DEFAULT_THEME_ID;
  }
  // Delete theme directory (with saved images)
  const themeDir = path.join(THEMES_DIR, themeId);
  if (fs.existsSync(themeDir)) {
    fs.removeSync(themeDir);
  }
  // Delete .ilnztheme file if exists
  const themeFilePath = path.join(THEMES_DIR, `${themeId}.ilnztheme`);
  if (fs.existsSync(themeFilePath)) {
    fs.removeSync(themeFilePath);
  }
  saveIndex(index);
  return { success: true };
}

function setActiveTheme(themeId) {
  const theme = getThemeById(themeId);
  if (!theme) return { success: false, error: 'Тема не найдена' };
  const index = getIndex();
  index.activeThemeId = themeId;
  saveIndex(index);
  return { success: true, theme };
}

function exportTheme(themeId) {
  const index = getIndex();
  const theme = index.themes.find(t => t.id === themeId);
  if (!theme) return null;
  // For export, we need to re-read the image files as base64
  const exportData = { ...theme };
  if (theme.background?.type === 'image' && theme.background?.value?.startsWith('file://')) {
    try {
      const filePath = theme.background.value.replace('file://', '');
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1);
      exportData.background.value = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`;
    } catch (e) {}
  }
  if (theme.icon && theme.icon.startsWith('file://')) {
    try {
      const filePath = theme.icon.replace('file://', '');
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1);
      exportData.icon = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`;
    } catch (e) {}
  }
  if (theme.soundPath && theme.soundPath.startsWith('file://')) {
    try {
      const filePath = theme.soundPath.replace('file://', '');
      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1);
      const mimeType = ext === 'flac' ? 'audio/flac' : ext === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      exportData.soundPath = `data:${mimeType};base64,${buf.toString('base64')}`;
    } catch (e) {}
  }
  return {
    name: exportData.name,
    author: exportData.author,
    version: exportData.version,
    description: exportData.description,
    launcherTitle: exportData.launcherTitle,
    colors: exportData.colors,
    background: exportData.background,
    icon: exportData.icon,
    soundPath: exportData.soundPath,
  };
}

async function importTheme(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const themeData = JSON.parse(content);

    if (!themeData.name || !themeData.colors) {
      return { success: false, error: 'Неверный формат .ilnztheme файла' };
    }

    const index = getIndex();
    const existing = index.themes.find(t => t.name === themeData.name);
    if (existing) {
      return { success: false, error: `Тема с именем "${themeData.name}" уже существует` };
    }

    const theme = createTheme({
      name: themeData.name,
      author: themeData.author || 'Импорт',
      version: themeData.version || '1.0',
      description: themeData.description || '',
      launcherTitle: themeData.launcherTitle || 'ILNAZ GAMING LAUNCHER',
      colors: themeData.colors,
      background: themeData.background || { type: 'gradient', value: '' },
      icon: themeData.icon || null,
      soundPath: themeData.soundPath || null,
    });

    return { success: true, theme };
  } catch (e) {
    return { success: false, error: `Ошибка импорта: ${e.message}` };
  }
}

module.exports = {
  initThemes,
  getAllThemes,
  getActiveTheme,
  getThemeById,
  createTheme,
  updateTheme,
  deleteTheme,
  setActiveTheme,
  exportTheme,
  importTheme,
  DEFAULT_THEME_ID,
};
