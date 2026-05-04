import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { getServerUrl, setServerUrl } from '../../config';
import './SettingsPage.css';

const ICONS = {
  behavior: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  updates: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  ),
  ui: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
    </svg>
  ),
  java: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M8 2v4M16 2v4" /><path d="M4 10h16" /><path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M9 15l2-2 2 2" />
    </svg>
  ),
  ram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M4 6h16v12H4z" /><path d="M8 6V4h8v2" /><path d="M8 18v2h8v-2" /><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  server: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
      <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><circle cx="6" cy="6" r="1" fill="currentColor" /><circle cx="6" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
};

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'client', label: 'Клиент' },
  { id: 'games', label: 'Игры' },
  { id: 'network', label: 'Сеть' },
];

const SettingsPage = () => {
  const { settings, updateGroup } = useSettings();

  const [activeCategory, setActiveCategory] = useState('all');
  const [serverInput, setServerInput] = useState(getServerUrl());
  const [editingServer, setEditingServer] = useState(false);

  const handleSaveServerUrl = () => {
    if (serverInput.trim()) setServerUrl(serverInput.trim().replace(/\/+$/, ''));
    else setEditingServer(false);
  };

  const Toggle = ({ label, description, checked, onChange }) => (
    <label className="s-toggle" onClick={() => onChange(!checked)}>
      <div className="s-toggle-body">
        <span className="s-toggle-label">{label}</span>
        {description && <span className="s-toggle-desc">{description}</span>}
      </div>
      <span className={`s-switch ${checked ? 'on' : 'off'}`}>
        <span className="s-switch-dot" />
      </span>
    </label>
  );

  const SelectField = ({ label, value, options, onChange }) => (
    <div className="s-select-field">
      <span className="s-select-label">{label}</span>
      <select className="s-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const Card = ({ icon, title, description, children, category }) => {
    if (activeCategory !== 'all' && activeCategory !== category) return null;
    return (
      <div className="s-card">
        <div className="s-card-header">
          <div className="s-card-icon">{icon}</div>
          <div className="s-card-info">
            <h3 className="s-card-title">{title}</h3>
            {description && <p className="s-card-desc">{description}</p>}
          </div>
        </div>
        <div className="s-card-body">{children}</div>
      </div>
    );
  };

  const renderClientGeneral = () => (
    <>
      <Card icon={ICONS.behavior} title="Поведение" category="client">
        <Toggle label="Запускать при старте системы" description="Автоматически открывать лаунчер при включении компьютера" checked={settings.general.launchAtStartup} onChange={v => updateGroup('general', { launchAtStartup: v })} />
        <Toggle label="Сворачивать в трей" description="При закрытии окна сворачивать в системный трей" checked={settings.general.minimizeToTray} onChange={v => updateGroup('general', { minimizeToTray: v })} />
        <Toggle label="Показывать поверх окон" description="Лаунчер всегда будет поверх остальных окон" checked={settings.general.alwaysOnTop} onChange={v => {
          updateGroup('general', { alwaysOnTop: v });
          window.electron?.setAlwaysOnTop?.(v);
        }} />
      </Card>
      <Card icon={ICONS.updates} title="Обновления" category="client">
        <Toggle label="Автоматические обновления" description="Скачивать и устанавливать обновления автоматически" checked={settings.general.autoUpdates} onChange={v => updateGroup('general', { autoUpdates: v })} />
        <SelectField label="Канал обновлений" value={settings.general.updateChannel} options={[{ value: 'stable', label: 'Стабильный' }, { value: 'beta', label: 'Бета' }, { value: 'alpha', label: 'Альфа' }]} onChange={v => updateGroup('general', { updateChannel: v })} />
      </Card>
    </>
  );

  const renderAppearance = () => {
    const a = settings.appearance;
    return (
      <Card icon={ICONS.ui} title="Внешний вид" category="client">
        <SelectField label="Масштаб интерфейса" value={a.uiScale} options={[{ value: '80', label: '80%' }, { value: '90', label: '90%' }, { value: '100', label: '100%' }, { value: '110', label: '110%' }, { value: '120', label: '120%' }]} onChange={v => {
          updateGroup('appearance', { uiScale: v });
          document.body.style.zoom = v + '%';
        }} />
        <Toggle label="Компактный режим" description="Уменьшить отступы и размеры элементов" checked={a.compactMode} onChange={v => {
          updateGroup('appearance', { compactMode: v });
          document.body.classList.toggle('compact-mode', v);
        }} />
        <Toggle label="Анимации" description="Включить анимации переходов и эффектов" checked={a.animations} onChange={v => {
          updateGroup('appearance', { animations: v });
          document.body.classList.toggle('no-animations', !v);
        }} />
        <Toggle label="Размытие фона" description="Эффект размытия для стеклянных элементов" checked={a.blurEffect} onChange={v => {
          updateGroup('appearance', { blurEffect: v });
          document.body.classList.toggle('no-blur', !v);
        }} />
      </Card>
    );
  };

  const renderLaunch = () => {
    const l = settings.launch;
    return (
      <>
        <Card icon={ICONS.java} title="Minecraft" category="games">
          <Toggle label="Автоматическая установка Java" description="Скачивать нужную версию Java (8/17/21) автоматически" checked={l.autoJava} onChange={v => updateGroup('launch', { autoJava: v })} />
          <Toggle label="Установка OptiFine" description="Автоматически скачивать OptiFine для поддерживаемых версий" checked={l.autoOptifine} onChange={v => updateGroup('launch', { autoOptifine: v })} />
          <Toggle label="Проверка целостности файлов" description="Проверять файлы игры перед запуском" checked={l.verifyFiles} onChange={v => updateGroup('launch', { verifyFiles: v })} />
        </Card>
        <Card icon={ICONS.ram} title="Параметры JVM" category="games">
          <Toggle label="Выделять RAM автоматически" description="Оптимальный объём RAM в зависимости от версии" checked={l.autoRam} onChange={v => updateGroup('launch', { autoRam: v })} />
          <SelectField label="Максимум RAM" value={l.maxRam} options={[{ value: '1024', label: '1 ГБ' }, { value: '2048', label: '2 ГБ' }, { value: '4096', label: '4 ГБ' }, { value: '8192', label: '8 ГБ' }]} onChange={v => updateGroup('launch', { maxRam: v })} />
        </Card>
        <Card icon={ICONS.bell} title="Звук" category="games">
          <Toggle label="Звук при запуске" description="Воспроизводить звук при запуске игры" checked={l.launchSound} onChange={v => updateGroup('launch', { launchSound: v })} />
        </Card>
      </>
    );
  };

  const renderNotifications = () => {
    const n = settings.notifications;
    return (
      <Card icon={ICONS.bell} title="Уведомления" category="client">
        <Toggle label="Push-уведомления" description="Показывать уведомления о событиях" checked={n.enabled} onChange={v => updateGroup('notifications', { enabled: v })} />
        <Toggle label="Звук уведомлений" description="Воспроизводить звук при новом уведомлении" checked={n.sound} onChange={v => updateGroup('notifications', { sound: v })} />
        <Toggle label="Друзья онлайн" description="Когда друзья заходят в сеть" checked={n.friendsOnline} onChange={v => updateGroup('notifications', { friendsOnline: v })} />
        <Toggle label="Обновления" description="При выходе новых версий игр или лаунчера" checked={n.updates} onChange={v => updateGroup('notifications', { updates: v })} />
      </Card>
    );
  };

  const renderLanguage = () => {
    const l = settings.language;
    return (
      <Card icon={ICONS.globe} title="Язык и регион" category="client">
        <SelectField label="Язык интерфейса" value={l.lang} options={[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }, { value: 'uk', label: 'Українська' }]} onChange={v => updateGroup('language', { lang: v })} />
        <SelectField label="Часовой пояс" value={l.timezone} options={[{ value: 'auto', label: 'Автоматически' }, { value: 'Europe/Moscow', label: 'Москва (UTC+3)' }, { value: 'Europe/Kiev', label: 'Киев (UTC+2)' }]} onChange={v => updateGroup('language', { timezone: v })} />
      </Card>
    );
  };

  const renderServer = () => (
    <Card icon={ICONS.server} title="Сервер" description="Адрес сервера лаунчера" category="network">
      {editingServer ? (
        <div className="s-server-edit">
          <input className="s-server-input" value={serverInput} onChange={e => setServerInput(e.target.value)} placeholder="http://192.168.1.100:3001" />
          <div className="s-server-btns">
            <button className="s-btn s-btn-accent" onClick={handleSaveServerUrl}>Сохранить</button>
            <button className="s-btn" onClick={() => { setEditingServer(false); setServerInput(getServerUrl()); }}>Отмена</button>
          </div>
        </div>
      ) : (
        <div className="s-server-view" onClick={() => { setEditingServer(true); setServerInput(getServerUrl()); }}>
          <span className="s-server-url">{getServerUrl()}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
      )}
      <p className="s-server-hint">После смены сервера лаунчер перезагрузится</p>
    </Card>
  );

  const [proxyEditing, setProxyEditing] = useState(false);
  const proxy = settings.proxy || {};
  const updateProxy = (values) => updateGroup('proxy', { ...proxy, ...values });
  const [proxySearching, setProxySearching] = useState(false);
  const [proxySearchResult, setProxySearchResult] = useState(null);

  const handleFindProxy = async () => {
    setProxySearching(true);
    setProxySearchResult(null);
    try {
      const result = await window.electron?.findWorkingProxy?.();
      if (result?.success) {
        const [host, port] = result.proxy.split(':');
        updateProxy({ enabled: true, host, port });
        setProxySearchResult({ success: true, message: `Найден рабочий прокси: ${result.proxy}` });
      } else {
        setProxySearchResult({ success: false, message: result?.error || 'Прокси не найден' });
      }
    } catch (err) {
      setProxySearchResult({ success: false, message: err.message });
    } finally {
      setProxySearching(false);
    }
  };

  const renderProxy = () => (
    <Card icon={ICONS.globe} title="Прокси-сервер" description="Для обхода блокировок в браузере" category="network">
      <div className="s-proxy-find">
        <button className="s-proxy-btn" onClick={handleFindProxy} disabled={proxySearching}>
          {proxySearching ? (
            <>
              <span className="spinner" />
              Поиск...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83l-1.42 1.42a2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 2 2 0 0 1-1-1.73V17a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.74-1.74 2 2 0 0 1 1.73-1H21a2 2 0 0 1 2 2v.09a2 2 0 0 1-1.73 1" />
              </svg>
              Найти рабочий прокси
            </>
          )}
        </button>
        {proxySearchResult && (
          <span className={`s-proxy-result ${proxySearchResult.success ? 'success' : 'error'}`}>
            {proxySearchResult.success ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            )}
            {proxySearchResult.message}
          </span>
        )}
      </div>
      {proxy.enabled && (
        <div className="s-proxy-fields">
          <div className="s-proxy-row">
            <label>Хост</label>
            <input className="s-proxy-input" value={proxy.host || ''} onChange={e => updateProxy({ host: e.target.value })} placeholder="proxy.example.com" />
          </div>
          <div className="s-proxy-row">
            <label>Порт</label>
            <input className="s-proxy-input" value={proxy.port || ''} onChange={e => updateProxy({ port: e.target.value })} placeholder="8080" type="number" />
          </div>
          <div className="s-proxy-row">
            <label>Логин (опц.)</label>
            <input className="s-proxy-input" value={proxy.username || ''} onChange={e => updateProxy({ username: e.target.value })} placeholder="user" />
          </div>
          <div className="s-proxy-row">
            <label>Пароль (опц.)</label>
            <input className="s-proxy-input" type="password" value={proxy.password || ''} onChange={e => updateProxy({ password: e.target.value })} placeholder="password" />
          </div>
          <p className="s-proxy-hint">Поддерживается: HTTP, HTTPS, SOCKS5 (формат: host:port)</p>
        </div>
      )}
    </Card>
  );

  return (
    <div className="settings-page">
      <div className="settings-top">
        <h1 className="settings-title">Настройки</h1>
        <div className="settings-categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`s-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-grid">
        {renderClientGeneral()}
        {renderAppearance()}
        {renderLaunch()}
        {renderNotifications()}
        {renderLanguage()}
        {renderServer()}
        {renderProxy()}
      </div>
    </div>
  );
};

export default SettingsPage;
