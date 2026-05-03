import { useState, useEffect, useCallback, useRef } from 'react';
import { getActiveUser, updateUserStats } from '../utils/auth';
import { useTheme } from '../context/ThemeContext';
import './Minecraft.css';

const Minecraft = () => {
  const { playLaunchSound } = useTheme();
  const user = getActiveUser();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ stage: '', current: '', downloaded: 0, total: 0, stageText: '' });
  const [launching, setLaunching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ ram: 2048, javaArgs: '', username: '', fullscreen: false });
  const [isRunning, setIsRunning] = useState(false);
  const [livePlaytime, setLivePlaytime] = useState({ hours: 0, minutes: 0, totalSeconds: 0 });
  const progressRef = useRef(null);

  useEffect(() => {
    loadStatus();

    const unsubProgress = window.electron.onMinecraftDownloadProgress((data) => {
      setDownloadProgress({
        stage: data.stage,
        current: data.current || '',
        downloaded: data.downloaded || 0,
        total: data.total || 0,
        stageText: data.stageText || '',
      });
    });

    const unsubComplete = window.electron.onMinecraftDownloadComplete(() => {
      setDownloading(false);
      setDownloadProgress({ stage: '', current: '', downloaded: 0, total: 0, stageText: '' });
      loadStatus();
    });

    const unsubPlaytime = window.electron.onMinecraftPlaytime((data) => {
      setLivePlaytime(data);
    });

    const unsubLaunched = window.electron.onMinecraftLaunched(() => {
      setIsRunning(true);
    });

    const unsubExited = window.electron.onMinecraftExited(() => {
      setIsRunning(false);
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubPlaytime();
      unsubLaunched();
      unsubExited();
    };
  }, []);

  const loadStatus = async () => {
    const s = await window.electron.getMinecraftStatus();
    setStatus(s);
    setSettings(s.settings || { ram: 2048, javaArgs: '', username: user?.username || 'Player', fullscreen: false });
    if (s.playtime) setLivePlaytime(s.playtime);
    if (s.isRunning) setIsRunning(true);
    setLoading(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress({ stage: '', current: '', downloaded: 0, total: 0, stageText: 'Preparing...' });
    await window.electron.downloadMinecraft({ userId: user?.id });
  };

  const handleCancelDownload = () => {
    window.electron.cancelMinecraftDownload();
    setDownloading(false);
    setDownloadProgress({ stage: '', current: '', downloaded: 0, total: 0, stageText: '' });
  };

  const handleLaunch = async () => {
    setLaunching(true);
    await playLaunchSound();
    const result = await window.electron.launchMinecraft(settings.username || user?.username || 'Player', user?.id);
    setLaunching(false);

    if (result.success) {
      setIsRunning(true);
      if (status?.playtime?.totalSeconds === 0) {
        await updateUserStats(user.id, { games_played: 1 });
      }
    }
  };

  const handleSaveSettings = async () => {
    await window.electron.saveMinecraftSettings(settings);
    setSettingsOpen(false);
    loadStatus();
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatPlaytime = () => {
    const t = livePlaytime.totalSeconds || 0;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    return `${h}ч ${String(m).padStart(2, '0')}м`;
  };

  if (loading) {
    return (
      <div className="minecraft-page">
        <div className="mc-loading">
          <div className="mc-spinner" />
          <span>Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="minecraft-page">
      {/* Minecraft background with pixel art elements */}
      <div className="mc-bg">
        <div className="mc-bg-overlay" />
        <div className="mc-bg-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="mc-particle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s` }} />
          ))}
        </div>
      </div>

      <div className="mc-content">
        {/* Header */}
        <div className="mc-header glass">
          <div className="mc-logo-section">
            <div className="mc-block-icon">
              <span>M</span>
            </div>
            <div>
              <h1 className="mc-title">Minecraft</h1>
              <span className="mc-version-badge">1.8.9</span>
            </div>
          </div>
          <div className="mc-header-right">
            {status?.installed && (
              <div className="mc-playtime-display">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{formatPlaytime()}</span>
              </div>
            )}
            <button className="mc-settings-btn" onClick={() => setSettingsOpen(!settingsOpen)} title="Настройки">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {settingsOpen && (
          <div className="mc-settings-panel glass fade-in">
            <h3>Настройки Minecraft</h3>

            <div className="mc-setting-group">
              <label>Выделение RAM</label>
              <div className="mc-ram-slider">
                <input
                  type="range"
                  min="1024"
                  max="8192"
                  step="512"
                  value={settings.ram}
                  onChange={(e) => setSettings({ ...settings, ram: parseInt(e.target.value) })}
                />
                <span className="mc-ram-value">{settings.ram >= 1024 ? (settings.ram / 1024).toFixed(1) + ' GB' : settings.ram + ' MB'}</span>
              </div>
            </div>

            <div className="mc-setting-group">
              <label>Имя пользователя</label>
              <input
                type="text"
                className="mc-input"
                value={settings.username}
                onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                placeholder="Ваш никнейм..."
                maxLength={16}
              />
            </div>

            <div className="mc-setting-group">
              <label>Java аргументы (оптимизация)</label>
              <textarea
                className="mc-input mc-textarea"
                value={settings.javaArgs}
                onChange={(e) => setSettings({ ...settings, javaArgs: e.target.value })}
                rows={3}
                placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions..."
              />
            </div>

            <div className="mc-setting-group">
              <label className="mc-checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.fullscreen}
                  onChange={(e) => setSettings({ ...settings, fullscreen: e.target.checked })}
                />
                <span>Полноэкранный режим</span>
              </label>
            </div>

            <div className="mc-settings-actions">
              <button className="mc-btn mc-btn-secondary" onClick={() => setSettingsOpen(false)}>Отмена</button>
              <button className="mc-btn mc-btn-primary" onClick={handleSaveSettings}>Сохранить</button>
            </div>
          </div>
        )}

        {/* Main area */}
        <div className="mc-main glass fade-in fade-in-delay-1">
          {!status?.installed && !downloading ? (
            <div className="mc-not-installed">
              <div className="mc-download-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <h2>Minecraft 1.8.9</h2>
              <p>Скачайте игру, чтобы начать играть</p>
              <button className="mc-btn mc-btn-primary mc-btn-large" onClick={handleDownload}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Скачать Minecraft 1.8.9
              </button>
            </div>
          ) : downloading ? (
            <div className="mc-downloading">
              <h2>Загрузка Minecraft...</h2>
              <div className="mc-download-stage">{downloadProgress.stageText || 'Подготовка...'}</div>

              <div className="mc-progress-container">
                <div className="mc-progress-bar">
                  <div
                    className="mc-progress-fill"
                    style={{
                      width: `${downloadProgress.total > 0 ? (downloadProgress.downloaded / downloadProgress.total * 100) : 0}%`,
                    }}
                  />
                </div>
                {downloadProgress.total > 0 && (
                  <span className="mc-progress-text">
                    {formatSize(downloadProgress.downloaded)} / {formatSize(downloadProgress.total)}
                  </span>
                )}
              </div>

              {downloadProgress.current && (
                <div className="mc-current-file">{downloadProgress.current}</div>
              )}

              <button className="mc-btn mc-btn-danger" onClick={handleCancelDownload}>Отменить</button>
            </div>
          ) : status?.installed ? (
            <div className="mc-ready">
              <div className="mc-play-section">
                <div className="mc-version-info">
                  <span className="mc-version-tag">Release 1.8.9</span>
                  {isRunning && <span className="mc-running-badge">Запущено</span>}
                </div>

                {isRunning && (
                  <div className="mc-live-playtime">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>В игре: {formatPlaytime()}</span>
                  </div>
                )}

                <button
                  className={`mc-btn mc-btn-play ${isRunning ? 'mc-btn-disabled' : ''}`}
                  onClick={handleLaunch}
                  disabled={launching || isRunning}
                >
                  {launching ? (
                    <>
                      <div className="mc-btn-spinner" />
                      Запуск...
                    </>
                  ) : isRunning ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                      Игра запущена
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Играть
                    </>
                  )}
                </button>

                <div className="mc-info-row">
                  <span>Пользователь: <strong>{settings.username || user?.username || 'Player'}</strong></span>
                  <span>RAM: <strong>{settings.ram >= 1024 ? (settings.ram / 1024).toFixed(1) + ' GB' : settings.ram + ' MB'}</strong></span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Quick info cards */}
        {status?.installed && (
          <div className="mc-info-cards fade-in fade-in-delay-2">
            <div className="mc-info-card glass">
              <div className="mc-info-card-icon">📦</div>
              <div className="mc-info-card-label">Версия</div>
              <div className="mc-info-card-value">1.8.9</div>
            </div>
            <div className="mc-info-card glass">
              <div className="mc-info-card-icon">⚡</div>
              <div className="mc-info-card-label">RAM</div>
              <div className="mc-info-card-value">{settings.ram >= 1024 ? (settings.ram / 1024).toFixed(1) + ' GB' : settings.ram + ' MB'}</div>
            </div>
            <div className="mc-info-card glass">
              <div className="mc-info-card-icon">🕐</div>
              <div className="mc-info-card-label">Всего в игре</div>
              <div className="mc-info-card-value">{formatPlaytime()}</div>
            </div>
            <div className="mc-info-card glass">
              <div className="mc-info-card-icon">☕</div>
              <div className="mc-info-card-label">Java</div>
              <div className="mc-info-card-value">Auto</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Minecraft;
