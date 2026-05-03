const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const MC_DIR = path.join(app.getPath('userData'), 'minecraft');
const MC_SETTINGS_PATH = path.join(MC_DIR, 'mc_settings.json');
const MC_AUTH_PATH = path.join(MC_DIR, 'auth.json');
const MC_ACCOUNTS_PATH = path.join(MC_DIR, 'accounts.json');
const MC_VERSIONS_PATH = path.join(MC_DIR, 'versions');

// Microsoft OAuth config
const MS_CLIENT_ID = '00000000402b5328';
const MS_REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const MS_SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';

const DEFAULT_SETTINGS = {
  ram: 2048,
  javaArgs: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M',
  username: 'Player',
  fullscreen: false,
  selectedVersion: '1.8.9',
  optifine: true,
};

let downloadState = { downloading: false, progress: 0, total: 0, current: '', stage: '', cancelled: false, version: '' };
let minecraftProcess = null;
let playTimer = null;
let totalPlaySeconds = 0;
let onMinecraftExit = null;

function getSettings() {
  try {
    if (fs.existsSync(MC_SETTINGS_PATH)) return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(MC_SETTINGS_PATH, 'utf8')) };
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
  fs.writeFileSync(MC_SETTINGS_PATH, JSON.stringify(s, null, 2));
}

function getAuth() {
  try {
    if (fs.existsSync(MC_AUTH_PATH)) return JSON.parse(fs.readFileSync(MC_AUTH_PATH, 'utf8'));
  } catch (e) {}
  return null;
}

function saveAuth(auth) {
  fs.writeFileSync(MC_AUTH_PATH, JSON.stringify(auth, null, 2));
}

function clearAuth() {
  if (fs.existsSync(MC_AUTH_PATH)) fs.unlinkSync(MC_AUTH_PATH);
}

// Multi-account system
function getAccounts() {
  try {
    if (fs.existsSync(MC_ACCOUNTS_PATH)) return JSON.parse(fs.readFileSync(MC_ACCOUNTS_PATH, 'utf8'));
  } catch (e) {}
  return [];
}

function saveAccounts(accounts) {
  fs.writeFileSync(MC_ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
}

function getActiveAccount() {
  const accounts = getAccounts();
  return accounts.find(a => a.active) || null;
}

function setActiveAccount(accountId) {
  let accounts = getAccounts();
  accounts = accounts.map(a => ({ ...a, active: a.id === accountId }));
  saveAccounts(accounts);
}

function addAccount(account) {
  const accounts = getAccounts();
  const existing = accounts.findIndex(a => a.username === account.username);
  const newId = Date.now().toString();
  if (existing >= 0) {
    accounts[existing] = { ...account, id: accounts[existing].id, active: accounts[existing].active };
  } else {
    accounts.push({ ...account, id: newId, active: false });
  }
  saveAccounts(accounts);
  return existing >= 0 ? accounts[existing].id : newId;
}

function removeAccount(accountId) {
  let accounts = getAccounts();
  const wasActive = accounts.find(a => a.id === accountId)?.active;
  accounts = accounts.filter(a => a.id !== accountId);
  if (wasActive && accounts.length > 0) {
    accounts[0].active = true;
  }
  saveAccounts(accounts);
}

function syncActiveAccountToAuth() {
  const active = getActiveAccount();
  if (active) {
    saveAuth(active);
  }
}

function getOfflineUUID(username) {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function formatUUID(id) {
  if (!id) return id;
  if (id.includes('-')) return id;
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;
}

function getVersionDir(version) {
  return path.join(MC_VERSIONS_PATH, version);
}

function getInstalledVersions() {
  if (!fs.existsSync(MC_VERSIONS_PATH)) return [];
  const versions = [];
  const entries = fs.readdirSync(MC_VERSIONS_PATH, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const jarPath = path.join(MC_VERSIONS_PATH, entry.name, `${entry.name}.jar`);
      if (fs.existsSync(jarPath)) {
        const jsonPath = path.join(MC_VERSIONS_PATH, entry.name, `${entry.name}.json`);
        let type = 'release';
        if (fs.existsSync(jsonPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            type = data.type || 'release';
          } catch (e) {}
        }
        const playtimeFile = path.join(MC_VERSIONS_PATH, entry.name, 'playtime.json');
        let playtime = { hours: 0, minutes: 0, totalSeconds: 0 };
        if (fs.existsSync(playtimeFile)) {
          try { playtime = JSON.parse(fs.readFileSync(playtimeFile, 'utf8')); } catch (e) {}
        }
        versions.push({ id: entry.name, type, playtime });
      }
    }
  }
  return versions.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
}

function deleteVersion(version) {
  const versionDir = getVersionDir(version);
  if (fs.existsSync(versionDir)) {
    fs.removeSync(versionDir);
    const settings = getSettings();
    if (settings.selectedVersion === version) {
      const remaining = getInstalledVersions();
      const newVersion = remaining.length > 0 ? remaining[0].id : '1.8.9';
      saveSettings({ ...settings, selectedVersion: newVersion });
    }
    return { success: true };
  }
  return { success: false, error: 'Версия не найдена' };
}

async function reinstallVersion(version, onProgress) {
  deleteVersion(version);
  return downloadMinecraft(version, onProgress);
}

function getPlaytimeForVersion(version) {
  const ptFile = path.join(MC_VERSIONS_PATH, version, 'playtime.json');
  try {
    if (fs.existsSync(ptFile)) return JSON.parse(fs.readFileSync(ptFile, 'utf8'));
  } catch (e) {}
  return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
}

function savePlaytimeForVersion(version) {
  const total = totalPlaySeconds;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ptFile = path.join(MC_VERSIONS_PATH, version, 'playtime.json');
  fs.ensureDirSync(path.dirname(ptFile));
  fs.writeFileSync(ptFile, JSON.stringify({ hours, minutes, seconds, totalSeconds: total }));
}

function getStatus() {
  const settings = getSettings();
  const auth = getAuth();
  const installedVersions = getInstalledVersions();
  const selectedVersion = settings.selectedVersion || '1.8.9';
  const versionInstalled = installedVersions.some(v => v.id === selectedVersion);
  const accounts = getAccounts();

  return {
    installed: versionInstalled,
    isRunning: minecraftProcess !== null,
    version: selectedVersion,
    installedVersions: installedVersions.map(v => v.id),
    settings,
    playtime: getPlaytimeForVersion(selectedVersion),
    playSeconds: totalPlaySeconds,
    downloading: downloadState.downloading,
    progress: downloadState.progress,
    total: downloadState.total,
    current: downloadState.current,
    stage: downloadState.stage,
    auth: auth ? { loggedIn: true, username: auth.username, xuid: auth.xuid, type: auth.type || 'microsoft' } : null,
    accounts,
    activeAccountId: accounts.find(a => a.active)?.id || null,
  };
}

async function fetchAvailableVersions() {
  const manifest = await fetchJSON('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  return manifest.versions.map(v => ({ id: v.id, type: v.type, url: v.url, releaseTime: v.releaseTime }));
}

async function microsoftLogin(mainWindow) {
  return new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 600,
      parent: mainWindow,
      modal: true,
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    let authDone = false;

    authWindow.on('closed', () => {
      if (!authDone) resolve({ success: false, error: 'Авторизация отменена' });
    });

    authWindow.webContents.on('did-navigate', async (_event, url) => {
      if (url.includes('code=') || url.includes('access_token=')) {
        if (authDone) return;
        authDone = true;
        authWindow.close();

        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          if (!code) throw new Error('No code received');

          const mcAuth = await authenticateMicrosoft(code);
          const account = { ...mcAuth, type: 'microsoft' };
          const accountId = addAccount(account);
          setActiveAccount(accountId);
          saveAuth(account);
          resolve({ success: true, username: mcAuth.username });
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      }
    });

    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${MS_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(MS_REDIRECT_URI)}&scope=${encodeURIComponent(MS_SCOPE)}`;
    authWindow.loadURL(authUrl);
    authWindow.show();
  });
}

async function authenticateMicrosoft(code) {
  const msToken = await fetchJSON('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${MS_CLIENT_ID}&redirect_uri=${encodeURIComponent(MS_REDIRECT_URI)}&code=${code}&grant_type=authorization_code`,
  });

  const msAccessToken = msToken.access_token;

  const xblResponse = await fetchJSON('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });

  const xblToken = xblResponse.Token;
  const userHash = xblResponse.DisplayClaims.xui[0].uhs;

  const xstsResponse = await fetchJSON('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  });

  const xstsToken = xstsResponse.Token;
  const xuid = xstsResponse.DisplayClaims.xui[0].xid;

  const mcResponse = await fetchJSON('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` }),
  });

  const mcAccessToken = mcResponse.access_token;

  const ownership = await fetchJSON('https://api.minecraftservices.com/entitlements/mcstore', {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });

  if (!ownership.items || ownership.items.length === 0) {
    throw new Error('У вас нет лицензии Minecraft');
  }

  const profile = await fetchJSON('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });

  return {
    type: 'microsoft',
    accessToken: mcAccessToken,
    username: profile.name,
    uuid: profile.id,
    xuid: xuid,
    userHash: userHash,
    xstsToken: xstsToken,
    expiresAt: Date.now() + (mcResponse.expires_in * 1000),
  };
}

async function microsoftLogout() {
  clearAuth();
  return { success: true };
}

function offlineLogin(username) {
  const uuid = getOfflineUUID(username);
  const account = {
    type: 'offline',
    username,
    uuid,
    accessToken: '0',
    id: Date.now().toString(),
    active: false,
  };

  const accounts = getAccounts();
  const existing = accounts.findIndex(a => a.username === username && a.type === 'offline');
  if (existing >= 0) {
    accounts[existing] = { ...account, id: accounts[existing].id, active: false };
    saveAccounts(accounts);
    setActiveAccount(accounts[existing].id);
  } else {
    accounts.push({ ...account, active: false });
    saveAccounts(accounts);
    setActiveAccount(account.id);
  }

  saveAuth(account);
  return { success: true, username };
}

async function elybyLogin(username, password) {
  const clientToken = crypto.randomUUID();
  const requestBody = JSON.stringify({
    agent: { name: 'Minecraft', version: 1 },
    username,
    password,
    clientToken,
  });

  const loginData = await new Promise((resolve, reject) => {
    const urlObj = new URL('https://authserver.ely.by/auth/authenticate');
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Host': urlObj.host,
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (data.trim().startsWith('{')) {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            reject(new Error(`ely.by returned non-JSON response (HTTP ${res.statusCode})`));
          }
        } catch (e) {
          reject(new Error(`ely.by response parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`ely.by request failed: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('ely.by timeout')); });
    req.write(requestBody);
    req.end();
  });

  const { statusCode, data } = loginData;

  if (statusCode >= 400 || data.error) {
    throw new Error(data.errorMessage || data.error || `Ошибка ely.by (HTTP ${statusCode})`);
  }

  if (!data.accessToken) {
    throw new Error('Сервер ely.by не вернул токен. Проверьте логин и пароль.');
  }

  const selectedProfile = data.selectedProfile;
  if (!selectedProfile) {
    throw new Error('Профиль Minecraft не найден для этого аккаунта ely.by');
  }

  let skinUrl = null;
  try {
    const skinRes = await new Promise((resolve, reject) => {
      const skinReq = https.get(`https://api.ely.by/v2/accounts/${username}/skin/1.8`, { timeout: 10000 }, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
      });
      skinReq.on('error', () => resolve(null));
      skinReq.on('timeout', () => { skinReq.destroy(); resolve(null); });
    });
    if (skinRes && skinRes.url) skinUrl = skinRes.url;
  } catch (e) {}

  const account = {
    type: 'elyby',
    username: selectedProfile.name,
    uuid: selectedProfile.id,
    accessToken: data.accessToken,
    clientId: data.clientToken || clientToken,
    skinUrl,
    expiresAt: Date.now() + (24 * 60 * 60 * 1000),
  };

  const accountId = addAccount(account);
  setActiveAccount(accountId);
  saveAuth(account);

  return { success: true, username: account.username };
}

async function removeAccountHandler(accountId) {
  removeAccount(accountId);
  syncActiveAccountToAuth();
  return { success: true };
}

async function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000,
    };
    const req = protocol.request(reqOptions, (res) => {
      if ((res.statusCode === 302 || res.statusCode === 301) && res.headers.location) {
        fetchHTML(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function getOptifineJarPath(version) {
  return path.join(MC_DIR, 'libraries', 'optifine', `OptiFine_${version}.jar`);
}

function isOptifineInstalled(version) {
  return fs.existsSync(getOptifineJarPath(version));
}

async function checkOptifineAvailable(version) {
  try {
    const html = await fetchHTML(`https://optifine.net/adloadx?f=OptiFine_${version}.jar`);
    const match = html.match(/action=["'](\/downloadx\?f=[^"']+)["']/);
    if (match) return { available: true, downloadUrl: `https://optifine.net${match[1]}` };
    return { available: false };
  } catch (e) {
    return { available: false };
  }
}

async function downloadOptifine(version, onProgress) {
  const optifineJarPath = getOptifineJarPath(version);
  await fs.ensureDir(path.dirname(optifineJarPath));

  if (onProgress) onProgress('Checking OptiFine availability...', 0, 0);

  const check = await checkOptifineAvailable(version);
  if (!check.available) {
    throw new Error(`OptiFine не найден для версии ${version}`);
  }

  if (onProgress) onProgress('Downloading OptiFine...', 0, 0);

  // OptiFine требует реферер и правильные headers
  await new Promise((resolve, reject) => {
    const urlObj = new URL(check.downloadUrl);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `https://optifine.net/adloadx?f=OptiFine_${version}.jar`,
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 60000,
    };

    const req = protocol.request(reqOptions, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Следующий редирект - реальная ссылка на скачивание
        const redirectUrl = res.headers.location;
        if (redirectUrl && redirectUrl.includes('adfoc')) {
          // AdFly защита - пробуем обойти
          fetchHTML(redirectUrl).then((html) => {
            // Извлекаем skip URL
            const skipMatch = html.match(/var link = ["']([^"']+)["']/);
            if (skipMatch) {
              downloadOptifineFromUrl(skipMatch[1], optifineJarPath, onProgress).then(resolve).catch(reject);
            } else {
              reject(new Error('Не удалось обойти защиту OptiFine'));
            }
          }).catch(reject);
        } else if (redirectUrl) {
          downloadOptifineFromUrl(redirectUrl, optifineJarPath, onProgress).then(resolve).catch(reject);
        } else {
          reject(new Error('No redirect URL'));
        }
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const stream = fs.createWriteStream(optifineJarPath);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total > 0) onProgress('Downloading OptiFine...', downloaded, total);
      });
      stream.on('finish', () => { stream.close(); resolve(); });
      stream.on('error', reject);
      res.pipe(stream);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OptiFine download timeout')); });
    req.end();
  });

  if (!fs.existsSync(optifineJarPath) || fs.statSync(optifineJarPath).size === 0) {
    fs.removeSync(optifineJarPath);
    throw new Error('OptiFine download failed');
  }

  return { success: true };
}

async function downloadOptifineFromUrl(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 60000,
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadOptifineFromUrl(res.headers.location, dest, onProgress).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const stream = fs.createWriteStream(dest);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && total > 0) onProgress('Downloading OptiFine...', downloaded, total);
      });
      stream.on('finish', () => { stream.close(); resolve(); });
      stream.on('error', reject);
      res.pipe(stream);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function removeOptifine(version) {
  const optifineJarPath = getOptifineJarPath(version);
  if (fs.existsSync(optifineJarPath)) {
    fs.removeSync(optifineJarPath);
  }
}

async function downloadFile(url, dest, onProgress) {
  await fs.ensureDir(path.dirname(dest));

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    let attempts = 0;
    const maxAttempts = 3;

    function tryDownload() {
      attempts++;
      const req = protocol.get(url, { headers: { 'User-Agent': 'ILNAZ-Launcher/0.1.0' }, timeout: 30000 }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          tryRedirect(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const stream = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          if (downloadState.cancelled) { stream.destroy(); reject(new Error('Cancelled')); return; }
          downloaded += chunk.length;
          if (onProgress && total > 0) onProgress(downloaded, total);
        });
        stream.on('finish', () => { stream.close(); resolve(); });
        stream.on('error', reject);
        res.pipe(stream);
      });
      req.on('error', () => { if (attempts < maxAttempts) setTimeout(tryDownload, 2000 * attempts); else reject(new Error('Download failed')); });
      req.on('timeout', () => { req.destroy(); if (attempts < maxAttempts) setTimeout(tryDownload, 2000 * attempts); else reject(new Error('Timeout')); });
    }

    function tryRedirect(redirectUrl) {
      const redirReq = protocol.get(redirectUrl, { headers: { 'User-Agent': 'ILNAZ-Launcher/0.1.0' }, timeout: 30000 }, (res) => {
        let downloaded = 0;
        const stream = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          if (downloadState.cancelled) { stream.destroy(); reject(new Error('Cancelled')); return; }
          downloaded += chunk.length;
          if (onProgress) onProgress(downloaded, parseInt(res.headers['content-length'] || '0', 10));
        });
        stream.on('finish', () => { stream.close(); resolve(); });
        res.pipe(stream);
      });
      redirReq.on('error', reject);
    }

    tryDownload();
  });
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(destDir, true);
      resolve();
    } catch (e) { reject(e); }
  });
}

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    };

    const req = protocol.request(reqOptions, (res) => {
      if ((res.statusCode === 302 || res.statusCode === 301) && res.headers.location) {
        fetchJSON(res.headers.location, options).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function downloadMinecraft(version, onProgress) {
  downloadState = { downloading: true, progress: 0, total: 0, current: '', stage: 'Fetching manifest...', cancelled: false, version };
  await fs.ensureDir(MC_DIR);

  try {
    const manifest = await fetchJSON('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    let versionInfo = manifest.versions.find(v => v.id === version);

    if (!versionInfo) {
      const types = ['release', 'snapshot', 'old_beta', 'old_alpha'];
      for (const type of types) {
        const v = manifest.versions.find(v => v.id === version && v.type === type);
        if (v) { versionInfo = v; break; }
      }
    }

    if (!versionInfo) throw new Error(`Minecraft ${version} not found`);

    downloadState.stage = 'Loading version info...';
    const versionData = await fetchJSON(versionInfo.url);

    const clientDownload = versionData.downloads?.client;
    if (!clientDownload) throw new Error('No client download URL found');
    const jarDir = getVersionDir(version);
    await fs.ensureDir(jarDir);
    const jarPath = path.join(jarDir, `${version}.jar`);
    const jsonPath = path.join(jarDir, `${version}.json`);

    // Save version.json for classpath/natives parsing
    await fs.writeJSON(jsonPath, versionData, { spaces: 2 });

    if (!fs.existsSync(jarPath) || fs.statSync(jarPath).size !== clientDownload.size) {
      downloadState.stage = 'Downloading Minecraft...';
      downloadState.current = 'minecraft.jar';
      await downloadFile(clientDownload.url, jarPath, (dl, total) => onProgress?.('jar', dl, total));
    }

    const assetsIndex = versionData.assetIndex?.id || version.split('.').slice(0, 2).join('.');
    const assetsDir = path.join(MC_DIR, 'assets');
    const objectsDir = path.join(assetsDir, 'objects');
    const indexesDir = path.join(assetsDir, 'indexes');
    await fs.ensureDir(objectsDir);
    await fs.ensureDir(indexesDir);

    const indexPath = path.join(indexesDir, `${assetsIndex}.json`);
    if (!fs.existsSync(indexPath) && versionData.assetIndex?.url) {
      downloadState.stage = 'Downloading assets index...';
      await downloadFile(versionData.assetIndex.url, indexPath, (dl, total) => onProgress?.('assets-index', dl, total));
    }

    if (fs.existsSync(indexPath)) {
      const assetIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const assetObjects = Object.entries(assetIndex.objects || {});

      for (let i = 0; i < assetObjects.length; i++) {
        if (downloadState.cancelled) throw new Error('Cancelled');
        const [assetName, assetInfo] = assetObjects[i];
        const hash = assetInfo.hash;
        const subDir = hash.substring(0, 2);
        const objectPath = path.join(objectsDir, subDir, hash);

        if (!fs.existsSync(objectPath)) {
          downloadState.stage = `Downloading assets... (${i + 1}/${assetObjects.length})`;
          downloadState.current = assetName;
          await downloadFile(`https://resources.download.minecraft.net/${subDir}/${hash}`, objectPath, (dl, total) => onProgress?.('asset', dl, total, i, assetObjects.length));
        }
      }
    }

    const librariesDir = path.join(MC_DIR, 'libraries');
    const nativesDir = path.join(MC_DIR, 'natives');
    await fs.ensureDir(librariesDir);
    await fs.ensureDir(nativesDir);

    const libraries = versionData.libraries || [];
    const isLinux = process.platform === 'linux';
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    for (let i = 0; i < libraries.length; i++) {
      if (downloadState.cancelled) throw new Error('Cancelled');
      const lib = libraries[i];

      if (lib.rules) {
        const osRule = lib.rules.find(r => r.os);
        if (osRule) {
          const osName = osRule.os.name;
          const allow = (osName === 'linux' && isLinux) || (osName === 'windows' && isWindows) || (osName === 'osx' && isMac);
          const action = osRule.action;
          if ((action === 'allow' && !allow) || (action === 'disallow' && allow)) {
            const hasAllowAll = lib.rules.some(r => r.action === 'allow' && !r.os);
            const hasDisallowThis = lib.rules.some(r => r.action === 'disallow' && r.os && ((r.os.name === 'linux' && isLinux) || (r.os.name === 'windows' && isWindows) || (r.os.name === 'osx' && isMac)));
            if (!hasAllowAll || hasDisallowThis) continue;
          }
        }
      }

      const artifact = lib.downloads?.artifact;
      if (!artifact) continue;

      const libPath = path.join(librariesDir, artifact.path);
      await fs.ensureDir(path.dirname(libPath));

      if (!fs.existsSync(libPath) || fs.statSync(libPath).size !== artifact.size) {
        downloadState.stage = `Downloading libraries... (${i + 1}/${libraries.length})`;
        downloadState.current = artifact.path.split('/').pop();
        try { await downloadFile(artifact.url, libPath, (dl, total) => onProgress?.('lib', dl, total, i, libraries.length)); }
        catch (e) { console.warn(`Failed to download lib ${artifact.path}: ${e.message}`); }
      }

      const natives = lib.downloads?.classifiers;
      if (natives) {
        let nativesJar = null;
        if (isLinux && natives['natives-linux']) nativesJar = natives['natives-linux'];
        else if (isWindows && natives['natives-windows']) nativesJar = natives['natives-windows'];
        else if (isMac && natives['natives-osx']) nativesJar = natives['natives-osx'];
        else if (isMac && natives['natives-macos']) nativesJar = natives['natives-macos'];

        if (nativesJar) {
          const nativesJarPath = path.join(librariesDir, nativesJar.path);
          await fs.ensureDir(path.dirname(nativesJarPath));
          if (!fs.existsSync(nativesJarPath)) {
            try { await downloadFile(nativesJar.url, nativesJarPath); }
            catch (e) { console.warn(`Failed to download natives: ${e.message}`); }
          }
          if (fs.existsSync(nativesJarPath)) {
            try { await extractZip(nativesJarPath, nativesDir); }
            catch (e) { console.warn(`Failed to extract natives: ${e.message}`); }
          }
        }
      }
    }

    // Download OptiFine if enabled
    const settings = getSettings();
    if (settings.optifine) {
      try {
        downloadState.stage = 'Checking OptiFine...';
        const optifineAvailable = await checkOptifineAvailable(version);
        if (optifineAvailable.available) {
          const optifineJarPath = getOptifineJarPath(version);
          if (!fs.existsSync(optifineJarPath)) {
            downloadState.stage = 'Downloading OptiFine...';
            await downloadOptifine(version, (stage, dl, total) => onProgress?.('optifine', dl, total));
          }
        }
      } catch (e) {
        console.warn('[MC] OptiFine download skipped:', e.message);
      }
    }

    downloadState = { downloading: false, progress: 0, total: 0, current: '', stage: 'Done!', version: '' };
    onProgress?.('done', 0, 0);
    return { success: true };
  } catch (err) {
    downloadState = { downloading: false, progress: 0, total: 0, current: '', stage: `Error: ${err.message}`, version: '' };
    return { success: false, error: err.message };
  }
}

function findJava() {
  return new Promise((resolve) => {
    if (process.platform === 'linux') {
      const candidates = [
        '/usr/lib/jvm/java-8-openjdk/jre/bin/java',
        '/usr/lib/jvm/java-8-oracle/jre/bin/java',
        '/usr/lib/jvm/jre-1.8.0-openjdk/bin/java',
        '/usr/lib/jvm/java-1.8.0-openjdk/jre/bin/java',
        '/usr/lib/jvm/java-8-openjdk-amd64/jre/bin/java',
        '/usr/lib/jvm/java-8-openjdk-i386/jre/bin/java',
        '/usr/lib/jvm/default-runtime/bin/java',
        '/usr/bin/java',
        'java',
      ];

      let found = null;
      let checked = 0;

      function checkNext() {
        if (checked >= candidates.length) {
          resolve(found || 'java');
          return;
        }
        const candidate = candidates[checked];
        checked++;
        const child = spawn(candidate, ['-version'], { shell: true });
        child.on('error', () => checkNext());
        child.on('exit', (code) => {
          if (code === 0 && !found) {
            found = candidate;
          }
          checkNext();
        });
      }

      checkNext();
    } else if (process.platform === 'win32') {
      resolve('javaw');
    } else {
      resolve('java');
    }
  });
}

function getJavaVersion(javaPath) {
  return new Promise((resolve) => {
    const child = spawn(javaPath, ['-version'], { shell: true });
    let output = '';
    child.stderr.on('data', (d) => output += d.toString());
    child.stdout.on('data', (d) => output += d.toString());
    child.on('close', () => {
      const match = output.match(/version "([^"]+)"/);
      if (match) {
        const ver = match[1];
        const major = parseInt(ver.split('.')[0], 10);
        resolve(major === 1 ? parseInt(ver.split('.')[1], 10) : major);
      } else {
        resolve(8);
      }
    });
    child.on('error', () => resolve(8));
  });
}

function needsJavaVersion(version) {
  const parts = version.split('.');
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);

  if (major === 1 && minor <= 15) return '1.8';
  if (major === 1 && minor === 16) return '1.8';
  if (major === 1 && minor === 17) return '17';
  if (major === 1 && minor >= 18) return '17';
  if (major >= 2) return '17';
  return '1.8';
}

const JAVA_DOWNLOADS = {
  '1.8': {
    linux: {
      url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u462-b08/OpenJDK8U-jre_x64_linux_hotspot_8u462b08.tar.gz',
      ext: 'tar.gz',
    },
    win32: {
      url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u462-b08/OpenJDK8U-jre_x64_windows_hotspot_8u462b08.zip',
      ext: 'zip',
    },
    darwin: {
      url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u462-b08/OpenJDK8U-jre_x64_mac_hotspot_8u462b08.tar.gz',
      ext: 'tar.gz',
    },
  },
  '17': {
    linux: {
      url: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jre_x64_linux_hotspot_17.0.14_7.tar.gz',
      ext: 'tar.gz',
    },
    win32: {
      url: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jre_x64_windows_hotspot_17.0.14_7.zip',
      ext: 'zip',
    },
    darwin: {
      url: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jre_x64_mac_hotspot_17.0.14_7.tar.gz',
      ext: 'tar.gz',
    },
  },
};

function getJavaDir(javaVersion) {
  if (javaVersion === '1.8' || javaVersion === '8') return path.join(MC_DIR, 'jre');
  return path.join(MC_DIR, 'jre17');
}

function getJavaExecutable(javaVersion) {
  const dir = getJavaDir(javaVersion);
  if (javaVersion === '1.8' || javaVersion === '8') {
    if (process.platform === 'win32') return path.join(dir, 'bin', 'javaw.exe');
    if (process.platform === 'darwin') return path.join(dir, 'Contents', 'Home', 'bin', 'java');
    return path.join(dir, 'bin', 'java');
  }
  if (process.platform === 'win32') return path.join(dir, 'bin', 'javaw.exe');
  if (process.platform === 'darwin') return path.join(dir, 'Contents', 'Home', 'bin', 'java');
  return path.join(dir, 'bin', 'java');
}

function isJavaDownloaded(javaVersion) {
  const exe = getJavaExecutable(javaVersion);
  return fs.existsSync(exe);
}

async function downloadJava(javaVersion, onProgress) {
  const platform = process.platform;
  const dl = JAVA_DOWNLOADS[javaVersion]?.[platform];
  if (!dl) throw new Error(`No Java ${javaVersion} download for ${platform}`);

  const dest = getJavaDir(javaVersion);
  await fs.ensureDir(dest);

  const label = `Java ${javaVersion}`;
  const archivePath = path.join(MC_DIR, `java_archive_${javaVersion.replace('.', '')}`);

  if (onProgress) onProgress(`Downloading ${label}...`, 0, 0);
  await downloadFile(dl.url, archivePath, onProgress ? (stage, dlb, total) => {
    if (stage === 'download') onProgress(`Downloading ${label}...`, dlb, total);
  } : null);

  if (onProgress) onProgress(`Extracting ${label}...`, 0, 0);

  if (dl.ext === 'zip') {
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(dest, true);
    const entries = fs.readdirSync(dest).filter(e => e.startsWith('jdk') || e.startsWith('temurin') || e.startsWith('jdk-'));
    if (entries.length > 0) {
      const src = path.join(dest, entries[0]);
      const files = fs.readdirSync(dest).filter(e => e !== entries[0]);
      for (const f of files) fs.removeSync(path.join(dest, f));
      const tempDest = path.join(dest, '_temp_move');
      fs.renameSync(src, tempDest);
      for (const f of fs.readdirSync(tempDest)) {
        fs.renameSync(path.join(tempDest, f), path.join(dest, f));
      }
      fs.removeSync(tempDest);
    }
  } else {
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', archivePath, '-C', dest]);
      tar.on('close', (code) => code === 0 ? resolve() : reject(new Error('tar failed')));
    });
    const entries = fs.readdirSync(dest).filter(e => e.startsWith('jdk') || e.startsWith('temurin') || e.startsWith('jdk-') || e.endsWith('.jdk'));
    if (entries.length > 0) {
      const src = path.join(dest, entries[0]);
      const files = fs.readdirSync(dest).filter(e => e !== entries[0]);
      for (const f of files) fs.removeSync(path.join(dest, f));
      if (entries[0].endsWith('.jdk')) {
        fs.renameSync(src, path.join(dest, entries[0].replace(/\.jdk$/, '.app')));
      } else {
        const tempDest = path.join(dest, '_temp_move');
        fs.renameSync(src, tempDest);
        for (const f of fs.readdirSync(tempDest)) {
          fs.renameSync(path.join(tempDest, f), path.join(dest, f));
        }
        fs.removeSync(tempDest);
      }
    }
  }

  fs.removeSync(archivePath);

  const exe = getJavaExecutable(javaVersion);
  if (!fs.existsSync(exe)) {
    throw new Error(`${label} extraction failed: executable not found`);
  }

  if (platform !== 'win32') {
    fs.chmodSync(exe, '755');
  }
}

async function downloadJava8(onProgress) {
  return downloadJava('1.8', onProgress);
}

function isJava8Downloaded() {
  return isJavaDownloaded('1.8');
}

async function ensureVersionJson(version) {
  const versionDir = getVersionDir(version);
  const jsonPath = path.join(versionDir, `${version}.json`);
  if (fs.existsSync(jsonPath)) return true;

  try {
    const manifest = await fetchJSON('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    const versionInfo = manifest.versions.find(v => v.id === version);
    if (!versionInfo || !versionInfo.url) return false;
    const versionData = await fetchJSON(versionInfo.url);
    await fs.writeJSON(jsonPath, versionData, { spaces: 2 });
    return true;
  } catch (e) {
    console.error('[MC] Failed to fetch version.json:', e.message);
    return false;
  }
}

async function buildClasspath(version) {
  const versionDir = getVersionDir(version);
  const jsonPath = path.join(versionDir, `${version}.json`);
  const jarPath = path.join(versionDir, `${version}.jar`);
  const separator = process.platform === 'win32' ? ';' : ':';

  if (!fs.existsSync(jsonPath)) {
    await ensureVersionJson(version);
  }

  if (!fs.existsSync(jsonPath)) {
    return [jarPath].join(separator);
  }

  try {
    const versionData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const librariesDir = path.join(MC_DIR, 'libraries');
    const jars = [jarPath];

    const libraries = versionData.libraries || [];
    const isLinux = process.platform === 'linux';
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    for (const lib of libraries) {
      if (lib.rules) {
        let shouldInclude = false;
        let hasOsRule = false;
        for (const rule of lib.rules) {
          if (rule.os) {
            hasOsRule = true;
            const osName = rule.os.name;
            const matchesOS = (osName === 'linux' && isLinux) || (osName === 'windows' && isWindows) || (osName === 'osx' && isMac);
            if (rule.action === 'allow' && matchesOS) shouldInclude = true;
            if (rule.action === 'disallow' && matchesOS) shouldInclude = false;
          } else if (rule.action === 'allow') {
            shouldInclude = true;
          }
        }
        if (hasOsRule && !shouldInclude) continue;
        if (!hasOsRule && !shouldInclude) continue;
      }

      const artifact = lib.downloads?.artifact;
      if (!artifact) continue;

      const libPath = path.join(librariesDir, artifact.path);
      if (fs.existsSync(libPath)) {
        jars.push(libPath);
      }
    }

    return jars.join(separator);
  } catch (e) {
    console.error('[MC] buildClasspath error:', e.message);
    return [jarPath].join(separator);
  }
}

async function extractNativesForVersion(version) {
  const versionDir = getVersionDir(version);
  const jsonPath = path.join(versionDir, `${version}.json`);
  const nativesDir = path.join(MC_DIR, 'natives');

  if (!fs.existsSync(jsonPath)) {
    await ensureVersionJson(version);
  }
  if (!fs.existsSync(jsonPath)) return;

  fs.ensureDirSync(nativesDir);

  try {
    const versionData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const librariesDir = path.join(MC_DIR, 'libraries');
    const libraries = versionData.libraries || [];
    const isLinux = process.platform === 'linux';
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    for (const lib of libraries) {
      const classifiers = lib.downloads?.classifiers;
      if (!classifiers) continue;

      let nativesJar = null;
      if (isLinux && classifiers['natives-linux']) nativesJar = classifiers['natives-linux'];
      else if (isWindows && classifiers['natives-windows']) nativesJar = classifiers['natives-windows'];
      else if (isMac && classifiers['natives-osx']) nativesJar = classifiers['natives-osx'];
      else if (isMac && classifiers['natives-macos']) nativesJar = classifiers['natives-macos'];

      if (!nativesJar) continue;

      const nativesJarPath = path.join(librariesDir, nativesJar.path);
      if (!fs.existsSync(nativesJarPath)) continue;

      try {
        const zip = new AdmZip(nativesJarPath);
        zip.getEntries().forEach(entry => {
          if (!entry.isDirectory && !entry.entryName.startsWith('META-INF')) {
            zip.extractEntryTo(entry, nativesDir, false, true);
          }
        });
      } catch (e) {
        console.warn('[MC] Failed to extract natives from', nativesJarPath, e.message);
      }
    }
  } catch (e) {
    console.warn('[MC] Failed to parse version JSON for natives:', e.message);
  }
}

async function launchMinecraft(version, onProcessStart) {
  try {
    const settings = getSettings();
    const auth = getActiveAccount() || getAuth();

    const versionDir = getVersionDir(version);
    const jarPath = path.join(versionDir, `${version}.jar`);
    if (!fs.existsSync(jarPath)) {
      return { success: false, error: `Minecraft ${version} не установлен.` };
    }

    console.log('[MC] === LAUNCH START ===');
    console.log('[MC] Version:', version);
    console.log('[MC] Auth:', auth ? `${auth.type}/${auth.username}` : 'offline');

    const requiredJava = needsJavaVersion(version);
    console.log('[MC] Required Java:', requiredJava);

    if (requiredJava === '1.8' && !isJavaDownloaded('1.8')) {
      console.log('[MC] Downloading Java 8...');
      try { await downloadJava('1.8', (s) => console.log('[MC] Java 8:', s)); }
      catch (e) { return { success: false, error: `Не удалось скачать Java 8: ${e.message}` }; }
    }

    if (requiredJava === '17' && !isJavaDownloaded('17')) {
      console.log('[MC] Downloading Java 17...');
      try { await downloadJava('17', (s) => console.log('[MC] Java 17:', s)); }
      catch (e) { return { success: false, error: `Не удалось скачать Java 17: ${e.message}` }; }
    }

    let javaPath;
    if (requiredJava === '1.8') javaPath = getJavaExecutable('1.8');
    else if (requiredJava === '17') javaPath = getJavaExecutable('17');
    else javaPath = await findJava();

    if (!fs.existsSync(javaPath)) {
      return { success: false, error: `Java не найдена: ${javaPath}` };
    }

    const effectiveJavaVersion = requiredJava === '1.8' ? 8 : (requiredJava === '17' ? 17 : await getJavaVersion(javaPath));

    const nativesDir = path.join(MC_DIR, 'natives');

    fs.ensureDirSync(nativesDir);
    const entries = fs.readdirSync(nativesDir);
    for (const e of entries) {
      const p = path.join(nativesDir, e);
      if (fs.statSync(p).isDirectory()) fs.removeSync(p);
      else fs.unlinkSync(p);
    }

    await extractNativesForVersion(version);

    await ensureVersionJson(version);
    let classpath = await buildClasspath(version);
    console.log('[MC] Classpath entries:', classpath.split(':').length);

    // Add OptiFine to classpath if enabled and installed
    const useOptifine = settings.optifine !== false;
    const optifineJarPath = getOptifineJarPath(version);
    if (useOptifine && fs.existsSync(optifineJarPath)) {
      console.log('[MC] OptiFine enabled for', version);
      const separator = process.platform === 'win32' ? ';' : ':';
      classpath += separator + optifineJarPath;
    }

    const gameDir = MC_DIR;
    const assetsDir = path.join(MC_DIR, 'assets');

    const effectiveUsername = auth ? auth.username : (settings.username || 'Player');
    const rawUuid = auth ? auth.uuid : getOfflineUUID(effectiveUsername);
    const effectiveUuid = formatUUID(rawUuid);
    const effectiveToken = auth ? auth.accessToken : '0';
    const userType = auth ? (auth.type === 'offline' ? 'mojang' : 'msa') : 'mojang';

    const versionParts = version.split('.');
    const vMajor = parseInt(versionParts[0], 10);
    const vMinor = parseInt(versionParts[1], 10);
    const assetsIndex = (vMajor === 1 && vMinor < 7) ? 'pre-1.7' : versionParts.slice(0, 2).join('.');

    const args = [
      '-Xmx' + settings.ram + 'M',
      '-Xms' + settings.ram + 'M',
      '-Djava.library.path=' + nativesDir,
      '-cp', classpath,
      'net.minecraft.client.main.Main',
      '--username', effectiveUsername,
      '--version', version,
      '--gameDir', gameDir,
      '--assetsDir', assetsDir,
      '--assetIndex', assetsIndex,
      '--uuid', effectiveUuid,
      '--accessToken', effectiveToken,
      '--userType', userType,
    ];

    if (effectiveJavaVersion >= 9) {
      const idx = args.indexOf('net.minecraft.client.main.Main');
      args.splice(idx, 0, '--add-opens', 'java.base/java.lang=ALL-UNNAMED');
    }

    if (vMajor >= 2 || (vMajor === 1 && vMinor >= 16)) {
      args.push('--clientId', auth?.xuid || '0', '--xuid', auth?.xuid || '');
    }

    if (settings.fullscreen) args.push('--fullscreen');

    console.log('[MC] Java:', javaPath);
    console.log('[MC] Natives:', nativesDir);
    console.log('[MC] Assets:', assetsDir);
    console.log('[MC] UUID:', effectiveUuid);
    console.log('[MC] Args:', args.join('\n  '));

    let spawnError = null;
    let earlyExit = null;
    const child = spawn(javaPath, args, { cwd: gameDir, env: process.env, detached: true });

    let mcOutput = '';

    child.stdout?.on('data', (data) => {
      mcOutput += data.toString();
      console.log('[MC OUT]', data.toString().trim());
    });
    child.stderr?.on('data', (data) => {
      mcOutput += data.toString();
      console.log('[MC ERR]', data.toString().trim());
    });
    child.on('error', (err) => {
      spawnError = err;
      console.error('[MC] Spawn error:', err.message);
    });

    child.on('exit', (code) => {
      if (playTimer) clearInterval(playTimer);
      savePlaytimeForVersion(version);
      minecraftProcess = null;
      console.log('[MC] Exit code:', code);
      console.log('[MC] Full output:', mcOutput);
      earlyExit = code;
      if (onMinecraftExit) { onMinecraftExit(); onMinecraftExit = null; }
    });

    await new Promise((resolve) => setTimeout(resolve, 4000));

    if (spawnError) return { success: false, error: `Не удалось запустить Java: ${spawnError.message}` };
    if (earlyExit !== null) {
      let err = `Minecraft закрылся с кодом ${earlyExit}.`;
      if (mcOutput.includes('UnsupportedClassVersionError')) err += ' Неправильная Java.';
      if (mcOutput.includes('Unable to access address of buffer')) err += ' Попробуйте Java 8.';
      if (mcOutput.includes('NoClassDefFoundError') || mcOutput.includes('ClassNotFoundException')) err += ' Библиотеки не найдены. Переустановите версию.';
      if (mcOutput.includes('Could not find or load main class')) err += ' Ошибка classpath. Переустановите версию.';
      return { success: false, error: err };
    }

    minecraftProcess = child;
    const existingPlaytime = getPlaytimeForVersion(version);
    totalPlaySeconds = existingPlaytime.totalSeconds || 0;

    playTimer = setInterval(() => {
      totalPlaySeconds++;
      savePlaytimeForVersion(version);
      if (onProcessStart) onProcessStart(totalPlaySeconds);
    }, 1000);

    child.unref();
    console.log('[MC] === LAUNCH SUCCESS ===');
    return { success: true, pid: child.pid };
  } catch (err) {
    console.error('[MC Launch Error]', err.message, err.stack);
    return { success: false, error: err.message };
  }
}

function cancelDownload() { downloadState.cancelled = true; }
function isMinecraftRunning() { return minecraftProcess !== null; }
function setOnExit(cb) { onMinecraftExit = cb; }

module.exports = {
  getStatus,
  getInstalledVersions,
  fetchAvailableVersions,
  downloadMinecraft,
  launchMinecraft,
  cancelDownload,
  saveSettings,
  getSettings,
  getPlaytimeForVersion,
  isMinecraftRunning,
  setOnExit,
  microsoftLogin,
  microsoftLogout,
  getOfflineUUID,
  getAccounts,
  getActiveAccount,
  setActiveAccount,
  addAccount,
  removeAccount,
  syncActiveAccountToAuth,
  elybyLogin,
  offlineLogin,
  downloadJava8,
  isJava8Downloaded,
  downloadJava17: (onProgress) => downloadJava('17', onProgress),
  isJava17Downloaded: () => isJavaDownloaded('17'),
  deleteVersion,
  reinstallVersion,
  isOptifineInstalled,
  downloadOptifine,
  removeOptifine,
  checkOptifineAvailable,
};
