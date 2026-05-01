const { app } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const MC_DIR = path.join(app.getPath('userData'), 'minecraft');
const VERSION = '1.8.9';
const ASSETS_INDEX = '1.8';
const MC_SETTINGS_PATH = path.join(MC_DIR, 'mc_settings.json');
const JAVA_PATH_FILE = path.join(MC_DIR, 'java_path.txt');

const DEFAULT_SETTINGS = {
  ram: 2048,
  javaArgs: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M',
  username: 'Player',
  fullscreen: false,
};

let downloadState = { downloading: false, progress: 0, total: 0, current: '', stage: '', cancelled: false };
let minecraftProcess = null;
let playTimer = null;
let totalPlaySeconds = 0;
let onMinecraftExit = null;

function getSettings() {
  try {
    if (fs.existsSync(MC_SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(MC_SETTINGS_PATH, 'utf8')) };
    }
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
  fs.writeFileSync(MC_SETTINGS_PATH, JSON.stringify(s, null, 2));
}

function getStatus() {
  if (!fs.existsSync(MC_DIR)) return { installed: false, isRunning: false };
  const jarPath = path.join(MC_DIR, 'versions', VERSION, `${VERSION}.jar`);
  const nativesDir = path.join(MC_DIR, 'natives');
  const installed = fs.existsSync(jarPath) && fs.existsSync(nativesDir);
  const settings = getSettings();
  const playtime = getPlaytime();
  return {
    installed,
    isRunning: minecraftProcess !== null,
    version: VERSION,
    settings,
    playtime,
    playSeconds: totalPlaySeconds,
    downloading: downloadState.downloading,
    progress: downloadState.progress,
    total: downloadState.total,
    current: downloadState.current,
    stage: downloadState.stage,
  };
}

function getPlaytime() {
  const ptFile = path.join(MC_DIR, 'playtime.json');
  try {
    if (fs.existsSync(ptFile)) {
      const d = JSON.parse(fs.readFileSync(ptFile, 'utf8'));
      return d;
    }
  } catch (e) {}
  return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
}

function savePlaytime() {
  const total = totalPlaySeconds;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const data = { hours, minutes, seconds, totalSeconds: total };
  fs.writeFileSync(path.join(MC_DIR, 'playtime.json'), JSON.stringify(data));
}

function updatePlaytimeUI(window) {
  if (!window || window.isDestroyed()) return;
  const total = totalPlaySeconds;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  window.webContents.send('minecraft-playtime', { hours, minutes, totalSeconds: total });
}

async function downloadFile(url, dest, onProgress) {
  const destDir = path.dirname(dest);
  await fs.ensureDir(destDir);

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const options = {
      headers: { 'User-Agent': 'ILNAZ-Launcher/0.1.0' },
      timeout: 30000,
    };

    let attempts = 0;
    const maxAttempts = 3;

    function tryDownload() {
      attempts++;
      const req = protocol.get(url, options, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          tryDownloadRedirect(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const stream = fs.createWriteStream(dest);

        res.on('data', (chunk) => {
          if (downloadState.cancelled) {
            stream.destroy();
            reject(new Error('Download cancelled'));
            return;
          }
          downloaded += chunk.length;
          if (onProgress && total > 0) {
            onProgress(downloaded, total);
          }
        });

        stream.on('finish', () => {
          stream.close();
          resolve();
        });

        stream.on('error', (err) => {
          reject(err);
        });

        res.pipe(stream);
      });

      req.on('error', (err) => {
        if (attempts < maxAttempts) {
          setTimeout(tryDownload, 2000 * attempts);
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(tryDownload, 2000 * attempts);
        } else {
          reject(new Error('Download timeout'));
        }
      });
    }

    function tryDownloadRedirect(redirectUrl) {
      const redirReq = protocol.get(redirectUrl, options, (res) => {
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const stream = fs.createWriteStream(dest);

        res.on('data', (chunk) => {
          if (downloadState.cancelled) {
            stream.destroy();
            reject(new Error('Download cancelled'));
            return;
          }
          downloaded += chunk.length;
          if (onProgress && total > 0) {
            onProgress(downloaded, total);
          }
        });

        stream.on('finish', () => {
          stream.close();
          resolve();
        });

        res.pipe(stream);
      });

      redirReq.on('error', (err) => reject(err));
      redirReq.on('timeout', () => {
        redirReq.destroy();
        reject(new Error('Redirect timeout'));
      });
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
    } catch (e) {
      reject(e);
    }
  });
}

async function downloadMinecraft(onProgress) {
  downloadState = { downloading: true, progress: 0, total: 0, current: '', stage: 'Fetching manifest...', cancelled: false };
  await fs.ensureDir(MC_DIR);

  try {
    // Step 1: Get version manifest
    const manifest = await fetchJSON('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
    const versionInfo = manifest.versions.find(v => v.id === VERSION && v.type === 'release');
    if (!versionInfo) throw new Error(`Minecraft ${VERSION} not found in manifest`);

    // Step 2: Get version details
    downloadState.stage = 'Loading version info...';
    const versionData = await fetchJSON(versionInfo.url);

    // Step 3: Download minecraft.jar
    const clientDownload = versionData.downloads?.client;
    if (!clientDownload) throw new Error('No client download URL found');

    const jarDir = path.join(MC_DIR, 'versions', VERSION);
    await fs.ensureDir(jarDir);
    const jarPath = path.join(jarDir, `${VERSION}.jar`);

    if (!fs.existsSync(jarPath) || fs.statSync(jarPath).size !== clientDownload.size) {
      downloadState.stage = 'Downloading Minecraft...';
      downloadState.current = 'minecraft.jar';
      await downloadFile(clientDownload.url, jarPath, (dl, total) => {
        onProgress?.('jar', dl, total);
      });
    }

    // Step 4: Download assets index
    const assetsDir = path.join(MC_DIR, 'assets');
    const objectsDir = path.join(assetsDir, 'objects');
    const indexesDir = path.join(assetsDir, 'indexes');
    await fs.ensureDir(objectsDir);
    await fs.ensureDir(indexesDir);

    const assetsIndexData = versionData.assetIndex;
    const indexPath = path.join(indexesDir, `${ASSETS_INDEX}.json`);

    if (!fs.existsSync(indexPath)) {
      downloadState.stage = 'Downloading assets index...';
      downloadState.current = 'assets index';
      await downloadFile(assetsIndexData.url, indexPath, (dl, total) => {
        onProgress?.('assets-index', dl, total);
      });
    }

    // Step 5: Download assets (objects)
    const assetIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const assetObjects = Object.entries(assetIndex.objects || {});

    for (let i = 0; i < assetObjects.length; i++) {
      if (downloadState.cancelled) throw new Error('Download cancelled');
      const [assetName, assetInfo] = assetObjects[i];
      const hash = assetInfo.hash;
      const subDir = hash.substring(0, 2);
      const objectPath = path.join(objectsDir, subDir, hash);

      if (!fs.existsSync(objectPath)) {
        downloadState.stage = `Downloading assets... (${i + 1}/${assetObjects.length})`;
        downloadState.current = assetName;
        await downloadFile(
          `https://resources.download.minecraft.net/${subDir}/${hash}`,
          objectPath,
          (dl, total) => onProgress?.('asset', dl, total, i, assetObjects.length)
        );
      }
    }

    // Step 6: Download libraries
    const librariesDir = path.join(MC_DIR, 'libraries');
    const nativesDir = path.join(MC_DIR, 'natives');
    await fs.ensureDir(librariesDir);
    await fs.ensureDir(nativesDir);

    const libraries = versionData.libraries || [];
    const isLinux = process.platform === 'linux';
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    for (let i = 0; i < libraries.length; i++) {
      if (downloadState.cancelled) throw new Error('Download cancelled');
      const lib = libraries[i];

      // Check rules for OS compatibility
      if (lib.rules) {
        const osRule = lib.rules.find(r => r.os);
        if (osRule) {
          const osName = osRule.os.name;
          const allow = (osName === 'linux' && isLinux) || (osName === 'windows' && isWindows) || (osName === 'osx' && isMac);
          const action = osRule.action;
          if ((action === 'allow' && !allow) || (action === 'disallow' && allow)) {
            // Skip this library if rules don't match, unless there's an allow-all rule
            const hasAllowAll = lib.rules.some(r => r.action === 'allow' && !r.os);
            const hasDisallowThis = lib.rules.some(r => r.action === 'disallow' && r.os &&
              ((r.os.name === 'linux' && isLinux) || (r.os.name === 'windows' && isWindows) || (r.os.name === 'osx' && isMac)));
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
        try {
          await downloadFile(artifact.url, libPath, (dl, total) => {
            onProgress?.('lib', dl, total, i, libraries.length);
          });
        } catch (e) {
          console.warn(`Failed to download lib ${artifact.path}: ${e.message}`);
        }
      }

      // Extract natives
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
            try {
              await downloadFile(nativesJar.url, nativesJarPath);
            } catch (e) {
              console.warn(`Failed to download natives ${nativesJar.path}: ${e.message}`);
            }
          }

          if (fs.existsSync(nativesJarPath)) {
            try {
              await extractZip(nativesJarPath, nativesDir);
            } catch (e) {
              console.warn(`Failed to extract natives: ${e.message}`);
            }
          }
        }
      }
    }

    downloadState = { downloading: false, progress: 0, total: 0, current: '', stage: 'Done!' };
    onProgress?.('done', 0, 0);
    return { success: true };
  } catch (err) {
    downloadState = { downloading: false, progress: 0, total: 0, current: '', stage: `Error: ${err.message}` };
    return { success: false, error: err.message };
  }
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const req = protocol.get(url, { headers: { 'User-Agent': 'ILNAZ-Launcher/0.1.0' }, timeout: 30000 }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function findJava() {
  return new Promise((resolve) => {
    if (process.platform === 'linux') {
      const candidates = [
        '/usr/bin/java',
        '/usr/lib/jvm/default/bin/java',
        '/usr/lib/jvm/default-runtime/bin/java',
      ];
      // Try java -version first
      const child = spawn('java', ['-version'], { shell: true });
      child.on('error', () => {
        // Try candidates
        for (const c of candidates) {
          if (fs.existsSync(c)) { resolve(c); return; }
        }
        resolve('java'); // Fallback to PATH
      });
      child.on('exit', (code) => {
        if (code === 0) resolve('java');
        else {
          for (const c of candidates) {
            if (fs.existsSync(c)) { resolve(c); return; }
          }
          resolve('java');
        }
      });
    } else if (process.platform === 'win32') {
      resolve('javaw');
    } else {
      resolve('java');
    }
  });
}

function buildClasspath() {
  const librariesDir = path.join(MC_DIR, 'libraries');
  const jarPath = path.join(MC_DIR, 'versions', VERSION, `${VERSION}.jar`);
  const separator = process.platform === 'win32' ? ';' : ':';
  const jars = [jarPath];

  function collectJars(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) collectJars(fullPath);
      else if (entry.name.endsWith('.jar') && !entry.name.startsWith('natives')) jars.push(fullPath);
    }
  }

  collectJars(librariesDir);
  return jars.join(separator);
}

async function launchMinecraft(username, onProcessStart) {
  const settings = getSettings();
  const javaPath = await findJava();
  const classpath = buildClasspath();
  const nativesDir = path.join(MC_DIR, 'natives');
  const gameDir = MC_DIR;
  const assetsDir = path.join(MC_DIR, 'assets');
  const fakeUuid = crypto.randomUUID();
  const fakeToken = '0';

  const args = [
    '-Xmx' + settings.ram + 'M',
    '-Xms' + settings.ram + 'M',
    '-Djava.library.path=' + nativesDir,
    '-cp', classpath,
    '-Dfml.ignoreInvalidMinecraftCertificates=true',
    'net.minecraft.client.main.Main',
    '--username', username || settings.username || 'Player',
    '--version', VERSION,
    '--gameDir', gameDir,
    '--assetsDir', assetsDir,
    '--assetIndex', ASSETS_INDEX,
    '--uuid', fakeUuid,
    '--accessToken', fakeToken,
    '--userProperties', '{}',
    '--userType', 'legacy',
  ];

  if (settings.fullscreen) args.push('--fullscreen');

  if (settings.javaArgs) {
    const extraArgs = settings.javaArgs.split(' ').filter(a => a);
    args.splice(1, 0, ...extraArgs);
  }

  const child = spawn(javaPath, args, {
    cwd: gameDir,
    env: process.env,
    detached: true,
  });

  child.stdout?.on('data', (data) => console.log('[MC]', data.toString().trim()));
  child.stderr?.on('data', (data) => console.log('[MC]', data.toString().trim()));

  child.on('error', (err) => console.error('[MC] Error:', err.message));

  child.on('exit', (code) => {
    if (playTimer) clearInterval(playTimer);
    savePlaytime();
    minecraftProcess = null;
    console.log('[MC] Process exited with code', code);
    if (onMinecraftExit) {
      onMinecraftExit();
      onMinecraftExit = null;
    }
  });

  minecraftProcess = child;
  totalPlaySeconds = getPlaytime().totalSeconds || 0;

  playTimer = setInterval(() => {
    totalPlaySeconds++;
    savePlaytime();
    if (onProcessStart) onProcessStart(totalPlaySeconds);
  }, 1000);

  child.unref();
  return { success: true, pid: child.pid };
}

function cancelDownload() {
  downloadState.cancelled = true;
}

function getMinecraftProcess() {
  return minecraftProcess;
}

function isMinecraftRunning() {
  return minecraftProcess !== null;
}

function setOnExit(cb) {
  onMinecraftExit = cb;
}

module.exports = {
  getStatus,
  downloadMinecraft,
  launchMinecraft,
  cancelDownload,
  saveSettings,
  getSettings,
  getPlaytime,
  isMinecraftRunning,
  getMinecraftProcess,
  updatePlaytimeUI,
  setOnExit,
};
