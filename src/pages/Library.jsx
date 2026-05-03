import { useState, useEffect } from 'react';
import GameCard from '../components/GameCard/GameCard';
import { getActiveUser, updateUserStats } from '../utils/auth';
import { useTheme } from '../context/ThemeContext';
import minelogo from '../assets/minelogo.png';
import './Library.css';

const Library = () => {
  const { playLaunchSound } = useTheme();
  const [tab, setTab] = useState('games');
  const [games, setGames] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [mcStatus, setMcStatus] = useState(null);
  const [mcLoading, setMcLoading] = useState(true);
  const [mcDownloading, setMcDownloading] = useState(false);
  const [mcDownloadProgress, setMcDownloadProgress] = useState({ stageText: '', downloaded: 0, total: 0, current: '' });
  const [mcLaunching, setMcLaunching] = useState(false);
  const [mcSettingsOpen, setMcSettingsOpen] = useState(false);
  const [mcAuthOpen, setMcAuthOpen] = useState(false);
  const [mcAuthLoading, setMcAuthLoading] = useState(false);
  const [mcSettings, setMcSettings] = useState({ ram: 2048, javaArgs: '', username: '', fullscreen: false });
  const [mcIsRunning, setMcIsRunning] = useState(false);
  const [mcLivePlaytime, setMcLivePlaytime] = useState({ hours: 0, minutes: 0, totalSeconds: 0 });
  const [mcVersions, setMcVersions] = useState([]);
  const [mcSelectedVersion, setMcSelectedVersion] = useState('');
  const [mcVersionSelectorOpen, setMcVersionSelectorOpen] = useState(false);
  const [mcAccounts, setMcAccounts] = useState([]);
  const [mcAccountsOpen, setMcAccountsOpen] = useState(false);
  const [mcElybyLoginOpen, setMcElybyLoginOpen] = useState(false);
  const [mcElybyUsername, setMcElybyUsername] = useState('');
  const [mcElybyPassword, setMcElybyPassword] = useState('');
  const [mcElybyLoading, setMcElybyLoading] = useState(false);
  const [mcOfflineLoginOpen, setMcOfflineLoginOpen] = useState(false);
  const [mcOfflineUsername, setMcOfflineUsername] = useState('');
  const [mcJava8Downloaded, setMcJava8Downloaded] = useState(false);
  const [mcJava8Downloading, setMcJava8Downloading] = useState(false);
  const [mcJava17Downloaded, setMcJava17Downloaded] = useState(false);
  const [mcJava17Downloading, setMcJava17Downloading] = useState(false);
  const [mcAccountSelectorOpen, setMcAccountSelectorOpen] = useState(false);
  const [mcVersionActionsOpen, setMcVersionActionsOpen] = useState(null);

  const user = getActiveUser();

  useEffect(() => {
    loadGames();
    loadMcStatus();
    loadMcVersions();
    checkJava();

    const unsubProgress = window.electron.onMinecraftDownloadProgress((data) => {
      setMcDownloadProgress({
        stageText: data.stageText || '',
        downloaded: data.downloaded || 0,
        total: data.total || 0,
        current: data.current || '',
      });
    });

    const unsubComplete = window.electron.onMinecraftDownloadComplete(() => {
      setMcDownloading(false);
      setMcDownloadProgress({ stageText: '', downloaded: 0, total: 0, current: '' });
      loadMcStatus();
      loadMcVersions();
    });

    const unsubPlaytime = window.electron.onMinecraftPlaytime((data) => {
      setMcLivePlaytime(data);
    });

    const unsubLaunched = window.electron.onMinecraftLaunched(() => {
      setMcIsRunning(true);
    });

    const unsubExited = window.electron.onMinecraftExited(() => {
      setMcIsRunning(false);
    });

    const unsubJava8Progress = window.electron.onJava8DownloadProgress((data) => {
      console.log('[Java8]', data);
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubPlaytime();
      unsubLaunched();
      unsubExited();
      unsubJava8Progress();
    };
  }, []);

  const loadGames = async () => {
    const loaded = await window.electron.getGames();
    const minecraftGames = (await window.electron.getMinecraftVersions()).map(v => ({
      id: `mc-${v.id}`,
      name: `Minecraft ${v.id}`,
      exec: 'minecraft',
      filePath: 'minecraft',
      icon: minelogo,
      source: 'minecraft',
      version: v.id,
      playtime: v.playtime,
    }));
    setGames([...loaded, ...minecraftGames]);
  };

  const loadMcStatus = async () => {
    const s = await window.electron.getMinecraftStatus();
    setMcStatus(s);
    setMcSettings(s.settings || { ram: 2048, javaArgs: '', username: user?.username || 'Player', fullscreen: false, optifine: true });
    if (s.playtime) setMcLivePlaytime(s.playtime);
    if (s.isRunning) setMcIsRunning(true);
    if (s.auth) {
      setMcSettings({ ...s.settings, username: s.auth.username || s.settings?.username || '' });
    }
    if (s.version) setMcSelectedVersion(s.version);
    if (s.accounts) setMcAccounts(s.accounts);
    setMcLoading(false);
  };

  const loadMcVersions = async () => {
    const versions = await window.electron.getMinecraftVersions();
    setMcVersions(versions.map(v => v.id));
  };

  const checkJava = async () => {
    const j8 = await window.electron.isJava8Downloaded();
    setMcJava8Downloaded(j8);
    const j17 = await window.electron.isJava17Downloaded();
    setMcJava17Downloaded(j17);
  };

  const handleDownloadJava8 = async () => {
    setMcJava8Downloading(true);
    const result = await window.electron.downloadJava8();
    setMcJava8Downloading(false);
    if (result.success) setMcJava8Downloaded(true);
  };

  const handleDownloadJava17 = async () => {
    setMcJava17Downloading(true);
    const result = await window.electron.downloadJava17();
    setMcJava17Downloading(false);
    if (result.success) setMcJava17Downloaded(true);
  };

  const importGame = async () => {
    const filePath = await window.electron.selectGameDesktop();
    if (!filePath) {
      const exePath = await window.electron.selectGameFile();
      if (exePath) {
        await window.electron.importGame(exePath, 'executable');
        loadGames();
      }
    } else {
      await window.electron.importGame(filePath, 'desktop');
      loadGames();
    }
  };

  const launchGame = async (game) => {
    if (game.source === 'minecraft' && game.version) {
      setMcLaunching(true);
      await playLaunchSound();
      const result = await window.electron.launchMinecraft(game.version, user?.id);
      setMcLaunching(false);
      if (result.success) {
        setMcIsRunning(true);
        const pt = game.playtime || { totalSeconds: 0 };
        if (pt.totalSeconds === 0) {
          await updateUserStats(user.id, { games_played: 1 });
        }
      }
    } else {
      await playLaunchSound();
      await window.electron.launchGame(game);
    }
  };

  const removeGame = async (id) => {
    if (id.startsWith('mc-')) {
      alert('Для удаления версии Minecraft используйте вкладку Minecraft');
      return;
    }
    await window.electron.removeGame(id);
    loadGames();
  };

  const handleMcDownload = async () => {
    setMcDownloading(true);
    setMcDownloadProgress({ stageText: 'Preparing...', downloaded: 0, total: 0, current: '' });
    await window.electron.downloadMinecraft(mcSelectedVersion);
  };

  const handleMcCancelDownload = () => {
    window.electron.cancelMinecraftDownload();
    setMcDownloading(false);
    setMcDownloadProgress({ stageText: '', downloaded: 0, total: 0, current: '' });
  };

  const handleMcLaunch = async () => {
    const version = mcSelectedVersion || mcStatus?.version || '1.8.9';
    setMcLaunching(true);
    await playLaunchSound();
    const result = await window.electron.launchMinecraft(version, user?.id);
    setMcLaunching(false);

    if (result.success) {
      setMcIsRunning(true);
      const pt = mcStatus?.playtime || { totalSeconds: 0 };
      if (pt.totalSeconds === 0) {
        await updateUserStats(user.id, { games_played: 1 });
      }
    }
  };

  const handleMcSaveSettings = async () => {
    await window.electron.saveMinecraftSettings({ ...mcSettings, selectedVersion: mcSelectedVersion });
    setMcSettingsOpen(false);
    loadMcStatus();
  };

  const handleMcChangeVersion = async (version) => {
    setMcSelectedVersion(version);
    await window.electron.saveMinecraftSettings({ ...mcSettings, selectedVersion: version });
    loadMcStatus();
  };

  const handleMcOpenVersionSelector = () => {
    setMcVersionSelectorOpen(true);
  };

  const handleMcOpenAccounts = () => {
    setMcAccountsOpen(true);
  };

  const handleMcSetActiveAccount = async (accountId) => {
    await window.electron.setMinecraftActiveAccount(accountId);
    setMcAccountsOpen(false);
    setMcAuthOpen(false);
    loadMcStatus();
  };

  const handleMcRemoveAccount = async (accountId) => {
    await window.electron.removeMinecraftAccount(accountId);
    loadMcStatus();
  };

  const handleElybyLogin = async () => {
    if (!mcElybyUsername.trim()) return;
    setMcElybyLoading(true);
    const result = await window.electron.elybyLogin(mcElybyUsername.trim(), mcElybyPassword);
    setMcElybyLoading(false);

    if (result.success) {
      setMcElybyLoginOpen(false);
      setMcElybyUsername('');
      setMcElybyPassword('');
      loadMcStatus();
    } else {
      alert(result.error || 'Ошибка авторизации ely.by');
    }
  };

  const handleMicrosoftLogin = async () => {
    setMcAuthLoading(true);
    const result = await window.electron.microsoftLogin();
    setMcAuthLoading(false);

    if (result.success) {
      setMcAuthOpen(false);
      loadMcStatus();
    } else {
      alert(result.error || 'Ошибка авторизации');
    }
  };

  const handleMicrosoftLogout = async () => {
    await window.electron.microsoftLogout();
    loadMcStatus();
  };

  const handleOfflineLogin = async () => {
    if (!mcOfflineUsername.trim()) return;
    const result = await window.electron.offlineLogin(mcOfflineUsername.trim());
    if (result.success) {
      setMcOfflineLoginOpen(false);
      setMcOfflineUsername('');
      loadMcStatus();
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatPlaytime = () => {
    const t = mcLivePlaytime.totalSeconds || 0;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    return `${h}ч ${String(m).padStart(2, '0')}м`;
  };

  const filteredGames = games.filter((game) => {
    if (filter !== 'all' && game.source !== filter) return false;
    if (search && !game.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const popularVersions = ['1.21.4', '1.20.4', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9', '1.7.10'];

  return (
    <div className={`library-page fade-in ${tab === 'minecraft' ? 'mc-active' : ''}`}>
      <div className="mc-bg">
        <div className="mc-bg-overlay" />
        <div className="mc-bg-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="mc-particle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${3 + Math.random() * 4}s` }} />
          ))}
        </div>
      </div>

      <div className="library-tabs glass">
        <button className={`tab-btn ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Игры
        </button>
        <button className={`tab-btn ${tab === 'minecraft' ? 'active' : ''}`} onClick={() => setTab('minecraft')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Minecraft
        </button>
      </div>

      <div className={`games-tab-content ${tab !== 'games' ? 'hidden' : ''}`}>
        <div className="library-header glass">
          <div className="header-left">
            <h1 className="page-title">Библиотека</h1>
            <span className="games-count">{games.length} игр</span>
          </div>
          <button className="import-btn" onClick={importGame}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Импорт игры
          </button>
        </div>

        <div className="library-controls glass fade-in fade-in-delay-1">
          <input
            className="search-input"
            placeholder="Поиск игр..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filter-buttons">
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Все</button>
            <button className={`filter-btn ${filter === 'desktop' ? 'active' : ''}`} onClick={() => setFilter('desktop')}>.desktop</button>
            <button className={`filter-btn ${filter === 'executable' ? 'active' : ''}`} onClick={() => setFilter('executable')}>Бинарники</button>
            <button className={`filter-btn ${filter === 'minecraft' ? 'active' : ''}`} onClick={() => setFilter('minecraft')}>Minecraft</button>
          </div>
        </div>

        <div className="library-content fade-in fade-in-delay-2">
          {filteredGames.length === 0 ? (
            <div className="empty-library">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <p>{games.length === 0 ? 'Библиотека пуста' : 'Игры не найдены'}</p>
              <span className="empty-hint">
                {games.length === 0 ? 'Импортируйте свою первую игру!' : 'Попробуйте изменить фильтры'}
              </span>
            </div>
          ) : (
            <div className="games-grid">
              {filteredGames.map((game) => (
                <GameCard key={game.id} game={game} onLaunch={launchGame} onRemove={removeGame} onSettings={(g) => { setMcSelectedVersion(g.version); setTab('minecraft'); setTimeout(() => setMcSettingsOpen(true), 100); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === 'minecraft' && (
        <div className="minecraft-section">
          <div className="mc-content">
            <div className="mc-header glass">
              <div className="mc-logo-section">
                <div className="mc-block-icon"><img src={minelogo} alt="Minecraft" /></div>
                <div>
                  <h1 className="mc-title">Minecraft</h1>
                  <button className="mc-version-selector-btn" onClick={handleMcOpenVersionSelector}>
                    <span className="mc-version-badge">{mcSelectedVersion || 'Выбрать версию'}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mc-header-right">
                <button className="mc-back-btn" onClick={() => setTab('games')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Игры
                </button>
                {mcStatus?.auth?.loggedIn ? (
                  <button className="mc-account-switcher" onClick={handleMcOpenAccounts}>
                    <span>{mcStatus.auth.username}</span>
                    <span className="mc-auth-account-type" style={{ padding: '1px 4px', fontSize: '10px' }}>{mcStatus.auth.type === 'elyby' ? 'ely.by' : mcStatus.auth.type === 'microsoft' ? 'MS' : 'Off'}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                ) : (
                  <button className="mc-auth-btn mc-login-btn" onClick={() => setMcAuthOpen(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Войти в аккаунт
                  </button>
                )}

                {mcStatus?.installed && (
                  <div className="mc-playtime-display">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{formatPlaytime()}</span>
                  </div>
                )}
                <button className="mc-settings-btn" onClick={() => setMcSettingsOpen(!mcSettingsOpen)} title="Настройки">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>
            </div>

            {mcAuthOpen && (
              <div className="mc-auth-modal-overlay" onClick={() => setMcAuthOpen(false)}>
                <div className="mc-auth-modal glass" onClick={(e) => e.stopPropagation()}>
                  <h3>Авторизация</h3>
                  <p className="mc-auth-desc">Выберите способ входа или существующий аккаунт</p>

                  {mcAccounts.length > 0 && (
                    <div className="mc-auth-accounts-list">
                      <div className="mc-auth-section-label">Ваши аккаунты</div>
                      {mcAccounts.map(acc => (
                        <button key={acc.id} className={`mc-auth-account-item ${acc.active ? 'active' : ''}`} onClick={() => handleMcSetActiveAccount(acc.id)}>
                          <span className="mc-auth-account-name">{acc.username}</span>
                          <span className="mc-auth-account-type">{acc.type === 'elyby' ? 'ely.by' : acc.type === 'microsoft' ? 'Microsoft' : 'Offline'}</span>
                          {acc.active && <span className="mc-auth-account-badge">Активен</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mc-auth-section-label">Войти в аккаунт</div>

                  <div className="mc-auth-options">
                    <button className="mc-auth-option-btn" onClick={handleMicrosoftLogin} disabled={mcAuthLoading}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                        <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                        <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
                        <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
                        <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
                      </svg>
                      <span>{mcAuthLoading ? 'Подключение...' : 'Войти через Microsoft'}</span>
                    </button>

                    <button className="mc-auth-option-btn mc-auth-option-elyby" onClick={() => { setMcAuthOpen(false); setMcElybyLoginOpen(true); }}>
                      <span className="mc-auth-option-elyby-icon">🔷</span>
                      <span>Войти через ely.by</span>
                    </button>

                    <button className="mc-auth-option-btn mc-auth-option-offline" onClick={() => { setMcAuthOpen(false); setMcOfflineLoginOpen(true); setMcOfflineUsername(user?.username || 'Player'); }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                      </svg>
                      <span>Играть оффлайн</span>
                    </button>
                  </div>

                  <button className="mc-auth-cancel" onClick={() => setMcAuthOpen(false)}>Отмена</button>
                </div>
              </div>
            )}

            {mcElybyLoginOpen && (
              <div className="mc-auth-modal-overlay" onClick={() => { setMcElybyLoginOpen(false); setMcElybyUsername(''); setMcElybyPassword(''); }}>
                <div className="mc-auth-modal glass" onClick={(e) => e.stopPropagation()}>
                  <h3>Вход через ely.by</h3>
                  <p className="mc-auth-desc">Введите логин и пароль от ely.by для скинов и пиратских серверов</p>

                  <div className="mc-elyby-form">
                    <input className="mc-input" type="text" placeholder="Логин ely.by" value={mcElybyUsername} onChange={(e) => setMcElybyUsername(e.target.value)} />
                    <input className="mc-input" type="password" placeholder="Пароль" value={mcElybyPassword} onChange={(e) => setMcElybyPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleElybyLogin(); }} />
                  </div>

                  <div className="mc-settings-actions">
                    <button className="mc-btn mc-btn-secondary" onClick={() => { setMcElybyLoginOpen(false); setMcElybyUsername(''); setMcElybyPassword(''); }}>Отмена</button>
                    <button className="mc-btn mc-btn-primary" onClick={handleElybyLogin} disabled={mcElybyLoading || !mcElybyUsername.trim()}>
                      {mcElybyLoading ? 'Вход...' : 'Войти'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mcOfflineLoginOpen && (
              <div className="mc-auth-modal-overlay" onClick={() => { setMcOfflineLoginOpen(false); setMcOfflineUsername(''); }}>
                <div className="mc-auth-modal glass" onClick={(e) => e.stopPropagation()}>
                  <h3>Оффлайн режим</h3>
                  <p className="mc-auth-desc">Введите никнейм для игры без лицензии</p>

                  <div className="mc-elyby-form">
                    <input className="mc-input" type="text" placeholder="Никнейм" value={mcOfflineUsername} onChange={(e) => setMcOfflineUsername(e.target.value)} maxLength={16} onKeyDown={(e) => { if (e.key === 'Enter') handleOfflineLogin(); }} />
                  </div>

                  <div className="mc-settings-actions">
                    <button className="mc-btn mc-btn-secondary" onClick={() => { setMcOfflineLoginOpen(false); setMcOfflineUsername(''); }}>Отмена</button>
                    <button className="mc-btn mc-btn-primary" onClick={handleOfflineLogin} disabled={!mcOfflineUsername.trim()}>
                      Играть
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mcVersionSelectorOpen && (
              <div className="mc-auth-modal-overlay" onClick={() => setMcVersionSelectorOpen(false)}>
                <div className="mc-version-modal glass" onClick={(e) => e.stopPropagation()}>
                  <h3>Выбор версии Minecraft</h3>
                  <p className="mc-auth-desc">Выберите версию для скачивания или переключения</p>

                  <div className="mc-version-list">
                    <div className="mc-version-section-label">Популярные версии</div>
                    {popularVersions.map(v => (
                      <div key={v} className={`mc-version-row ${mcVersions.includes(v) ? 'installed' : ''} ${mcSelectedVersion === v ? 'selected' : ''}`}>
                        <button className="mc-version-item-btn" onClick={() => { setMcSelectedVersion(v); setMcVersionSelectorOpen(false); handleMcChangeVersion(v); }}>
                          <span className="mc-version-item-name">{v}</span>
                          {mcVersions.includes(v) && <span className="mc-version-item-badge">Установлено</span>}
                        </button>
                        {mcVersions.includes(v) && (
                          <div className="mc-version-actions">
                            <button className="mc-version-action-btn reinstall" onClick={() => { setMcVersionActionsOpen(v); }} title="Переустановить">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                              </svg>
                            </button>
                            <button className="mc-version-action-btn delete" onClick={() => { if (confirm(`Удалить Minecraft ${v}?`)) { window.electron.deleteMinecraftVersion(v); setMcSelectedVersion(popularVersions.find(pv => mcVersions.includes(pv)) || '1.8.9'); handleMcChangeVersion(popularVersions.find(pv => mcVersions.includes(pv)) || '1.8.9'); setMcVersionSelectorOpen(false); loadMcStatus(); loadMcVersions(); } }} title="Удалить">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button className="mc-auth-cancel" onClick={() => setMcVersionSelectorOpen(false)}>Закрыть</button>
                </div>
              </div>
            )}

            {mcVersionActionsOpen && (
              <div className="mc-auth-modal-overlay" onClick={() => setMcVersionActionsOpen(null)}>
                <div className="mc-auth-modal glass" onClick={(e) => e.stopPropagation()}>
                  <h3>Minecraft {mcVersionActionsOpen}</h3>
                  <p className="mc-auth-desc">Переустановить версию? Это удалит текущие файлы и скачает заново.</p>

                  <div className="mc-settings-actions">
                    <button className="mc-btn mc-btn-secondary" onClick={() => setMcVersionActionsOpen(null)}>Отмена</button>
                    <button className="mc-btn mc-btn-danger" onClick={async () => { setMcVersionActionsOpen(null); setMcVersionSelectorOpen(false); setMcDownloading(true); setMcDownloadProgress({ stageText: 'Подготовка...', downloaded: 0, total: 0, current: '' }); const result = await window.electron.reinstallMinecraftVersion(mcVersionActionsOpen); setMcDownloading(false); if (result.success) { loadMcStatus(); loadMcVersions(); } else { alert(result.error || 'Ошибка переустановки'); } }}>Переустановить</button>
                  </div>
                </div>
              </div>
            )}

            {mcAccountSelectorOpen && (
              <div className="mc-auth-modal-overlay" onClick={() => setMcAccountSelectorOpen(false)}>
                <div className="mc-auth-modal glass" onClick={(e) => e.stopPropagation()}>
                  <h3>Выбор аккаунта</h3>
                  <p className="mc-auth-desc">Выберите аккаунт для игры или добавьте новый</p>

                  {mcAccounts.length > 0 && (
                    <div className="mc-auth-accounts-list">
                      {mcAccounts.map(acc => (
                        <button key={acc.id} className={`mc-auth-account-item ${acc.active ? 'active' : ''}`} onClick={() => { handleMcSetActiveAccount(acc.id); setMcAccountSelectorOpen(false); }}>
                          <span className="mc-auth-account-name">{acc.username}</span>
                          <span className="mc-auth-account-type">{acc.type === 'elyby' ? 'ely.by' : acc.type === 'microsoft' ? 'Microsoft' : 'Offline'}</span>
                          {acc.active && <span className="mc-auth-account-badge">Активен</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mc-auth-section-label">Добавить аккаунт</div>

                  <div className="mc-auth-options">
                    <button className="mc-auth-option-btn" onClick={() => { setMcAccountSelectorOpen(false); setMcAuthOpen(true); }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <rect x="1" y="1" width="10" height="10" fill="#f25022" />
                        <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
                        <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
                        <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
                      </svg>
                      <span>Microsoft</span>
                    </button>

                    <button className="mc-auth-option-btn mc-auth-option-elyby" onClick={() => { setMcAccountSelectorOpen(false); setMcElybyLoginOpen(true); }}>
                      <span className="mc-auth-option-elyby-icon">🔷</span>
                      <span>ely.by</span>
                    </button>

                    <button className="mc-auth-option-btn mc-auth-option-offline" onClick={() => { setMcAccountSelectorOpen(false); setMcOfflineLoginOpen(true); setMcOfflineUsername(user?.username || 'Player'); }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                      </svg>
                      <span>Оффлайн</span>
                    </button>
                  </div>

                  <button className="mc-auth-cancel" onClick={() => setMcAccountSelectorOpen(false)}>Закрыть</button>
                </div>
              </div>
            )}

            {mcSettingsOpen && (
              <div className="mc-settings-panel glass fade-in">
                <h3>Настройки Minecraft</h3>

                <div className="mc-setting-group">
                  <label>Аккаунт</label>
                  <button className="mc-account-switch-btn" onClick={() => { setMcSettingsOpen(false); setMcAccountSelectorOpen(true); }}>
                    {mcStatus?.auth?.username || 'Не выбран'} ({mcStatus?.auth?.type === 'elyby' ? 'ely.by' : mcStatus?.auth?.type === 'microsoft' ? 'MS' : 'Offline'})
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>

                <div className="mc-setting-group">
                  <label>Выделение RAM</label>
                  <div className="mc-ram-slider">
                    <input type="range" min="1024" max="8192" step="512" value={mcSettings.ram} onChange={(e) => setMcSettings({ ...mcSettings, ram: parseInt(e.target.value) })} />
                    <span className="mc-ram-value">{mcSettings.ram >= 1024 ? (mcSettings.ram / 1024).toFixed(1) + ' GB' : mcSettings.ram + ' MB'}</span>
                  </div>
                </div>

                {!mcStatus?.auth?.loggedIn && (
                  <div className="mc-setting-group">
                    <label>Имя пользователя (оффлайн)</label>
                    <input type="text" className="mc-input" value={mcSettings.username} onChange={(e) => setMcSettings({ ...mcSettings, username: e.target.value })} placeholder="Ваш никнейм..." maxLength={16} />
                  </div>
                )}

                <div className="mc-setting-group">
                  <label>Java аргументы (оптимизация)</label>
                  <textarea className="mc-input mc-textarea" value={mcSettings.javaArgs} onChange={(e) => setMcSettings({ ...mcSettings, javaArgs: e.target.value })} rows={3} placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions..." />
                </div>

                <div className="mc-setting-group">
                  <label className="mc-checkbox-label">
                    <input type="checkbox" checked={mcSettings.fullscreen} onChange={(e) => setMcSettings({ ...mcSettings, fullscreen: e.target.checked })} />
                    <span>Полноэкранный режим</span>
                  </label>
                </div>

                <div className="mc-setting-group">
                  <label>Java 8 {mcJava8Downloaded ? 'установлена ✓' : 'не установлена'}</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Для Minecraft 1.16 и ниже</span>
                  {!mcJava8Downloaded && (
                    <button className="mc-btn mc-btn-secondary" onClick={handleDownloadJava8} disabled={mcJava8Downloading} style={{ width: '100%', marginTop: '8px' }}>
                      {mcJava8Downloading ? 'Скачивание...' : 'Скачать Java 8'}
                    </button>
                  )}
                </div>

                <div className="mc-setting-group">
                  <label>Java 17 {mcJava17Downloaded ? 'установлена ✓' : 'не установлена'}</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Для Minecraft 1.18 и выше</span>
                  {!mcJava17Downloaded && (
                    <button className="mc-btn mc-btn-secondary" onClick={handleDownloadJava17} disabled={mcJava17Downloading} style={{ width: '100%', marginTop: '8px' }}>
                      {mcJava17Downloading ? 'Скачивание...' : 'Скачать Java 17'}
                    </button>
                  )}
                </div>

                <div className="mc-setting-group">
                  <label className="mc-checkbox-label">
                    <input type="checkbox" checked={mcSettings.optifine !== false} onChange={(e) => setMcSettings({ ...mcSettings, optifine: e.target.checked })} />
                    <span>Установить OptiFine при скачивании версии</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Оптимизация и улучшение графики</span>
                </div>

                <div className="mc-settings-actions">
                  <button className="mc-btn mc-btn-secondary" onClick={() => setMcSettingsOpen(false)}>Отмена</button>
                  <button className="mc-btn mc-btn-primary" onClick={handleMcSaveSettings}>Сохранить</button>
                </div>
              </div>
            )}

            <div className="mc-main glass fade-in fade-in-delay-1">
              {mcLoading ? (
                <div className="mc-loading">
                  <div className="mc-spinner" />
                  <span>Загрузка...</span>
                </div>
              ) : !mcStatus?.installed && !mcDownloading ? (
                <div className="mc-not-installed">
                  <div className="mc-download-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <h2>Minecraft {mcSelectedVersion || '1.8.9'}</h2>
                  <p>Скачайте игру, чтобы начать играть</p>
                  {mcStatus?.auth?.loggedIn && (
                    <p className="mc-auth-note">Вход выполнен как: <strong>{mcStatus.auth.username}</strong></p>
                  )}
                  <button className="mc-btn mc-btn-primary mc-btn-large" onClick={handleMcDownload}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Скачать Minecraft {mcSelectedVersion || '1.8.9'}
                  </button>
                </div>
              ) : mcDownloading ? (
                <div className="mc-downloading">
                  <h2>Загрузка Minecraft...</h2>
                  <div className="mc-download-stage">{mcDownloadProgress.stageText || 'Подготовка...'}</div>
                  <div className="mc-progress-container">
                    <div className="mc-progress-bar">
                      <div className="mc-progress-fill" style={{ width: `${mcDownloadProgress.total > 0 ? (mcDownloadProgress.downloaded / mcDownloadProgress.total * 100) : 0}%` }} />
                    </div>
                    {mcDownloadProgress.total > 0 && (
                      <span className="mc-progress-text">{formatSize(mcDownloadProgress.downloaded)} / {formatSize(mcDownloadProgress.total)}</span>
                    )}
                  </div>
                  {mcDownloadProgress.current && <div className="mc-current-file">{mcDownloadProgress.current}</div>}
                  <button className="mc-btn mc-btn-danger" onClick={handleMcCancelDownload}>Отменить</button>
                </div>
              ) : mcStatus?.installed ? (
                <div className="mc-ready">
                  <div className="mc-play-section">
                    <div className="mc-version-info">
                      <span className="mc-version-tag">Release {mcStatus?.version || mcSelectedVersion}</span>
                      {mcIsRunning && <span className="mc-running-badge">Запущено</span>}
                      {mcStatus?.auth?.loggedIn && <span className="mc-license-badge">Лицензия</span>}
                    </div>

                    {mcIsRunning && (
                      <div className="mc-live-playtime">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>В игре: {formatPlaytime()}</span>
                      </div>
                    )}

                    <button className={`mc-btn mc-btn-play ${mcIsRunning ? 'mc-btn-disabled' : ''}`} onClick={handleMcLaunch} disabled={mcLaunching || mcIsRunning}>
                      {mcLaunching ? (
                        <><div className="mc-btn-spinner" /> Запуск...</>
                      ) : mcIsRunning ? (
                        <><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> Игра запущена</>
                      ) : (
                        <><svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><polygon points="5 3 19 12 5 21 5 3" /></svg> Играть</>
                      )}
                    </button>

                    <div className="mc-info-row">
                      <span>Пользователь: <strong>{mcStatus?.auth?.username || mcSettings.username || user?.username || 'Player'}</strong></span>
                      <span>RAM: <strong>{mcSettings.ram >= 1024 ? (mcSettings.ram / 1024).toFixed(1) + ' GB' : mcSettings.ram + ' MB'}</strong></span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {mcStatus?.installed && (
              <div className="mc-info-cards fade-in fade-in-delay-2">
                <div className="mc-info-card glass">
                  <div className="mc-info-card-icon">📦</div>
                  <div className="mc-info-card-label">Версия</div>
                  <div className="mc-info-card-value">{mcStatus?.version || mcSelectedVersion}</div>
                </div>
                <div className="mc-info-card glass">
                  <div className="mc-info-card-icon">⚡</div>
                  <div className="mc-info-card-label">RAM</div>
                  <div className="mc-info-card-value">{mcSettings.ram >= 1024 ? (mcSettings.ram / 1024).toFixed(1) + ' GB' : mcSettings.ram + ' MB'}</div>
                </div>
                <div className="mc-info-card glass">
                  <div className="mc-info-card-icon">🕐</div>
                  <div className="mc-info-card-label">Всего в игре</div>
                  <div className="mc-info-card-value">{formatPlaytime()}</div>
                </div>
                <div className="mc-info-card glass">
                  <div className="mc-info-card-icon"></div>
                  <div className="mc-info-card-label">Java</div>
                  <div className="mc-info-card-value">Auto</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
