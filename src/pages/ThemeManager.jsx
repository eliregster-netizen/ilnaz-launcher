import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getApiUrl, getServerUrl } from '../config';
import { login, getActiveUser } from '../utils/auth';
import ThemeCard from '../components/ThemeCard/ThemeCard';
import ThemeEditor from '../components/ThemeEditor/ThemeEditor';
import './ThemeManager.css';

const TABS = [
  { id: 'my', label: 'Мои темы' },
  { id: 'public', label: 'Каталог' },
];

const ThemeManager = () => {
  const { themes, activeTheme, selectTheme, createTheme, updateTheme, deleteTheme, exportTheme, importTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('my');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState(null);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [publishing, setPublishing] = useState(null);
  const [publicThemes, setPublicThemes] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [publicError, setPublicError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'public') loadPublicThemes();
  }, [activeTab]);

  const loadPublicThemes = async () => {
    setLoadingPublic(true);
    setPublicError(null);
    try {
      const res = await fetch(`${getServerUrl()}/api/themes/public`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPublicThemes(data.themes || []);
    } catch (e) {
      setPublicError('Не удалось загрузить каталог тем. Сервер недоступен.');
    } finally {
      setLoadingPublic(false);
    }
  };

const getToken = () => localStorage.getItem('ilnaz-token');

  const publishTheme = async (themeId) => {
    setPublishing(themeId);
    try {
      let token = localStorage.getItem('ilnaz-token');
      if (!token) {
        const user = getActiveUser();
        if (user?.username && user?.password) {
          const loginResult = await login(user.username, user.password);
          if (loginResult.success) {
            token = localStorage.getItem('ilnaz-token');
          }
        }
      }
      if (!token) {
        alert('Ошибка аутентификации: нужно войти в аккаунт');
        setPublishing(null);
        return;
      }

      const exportRes = await exportTheme(themeId);
      if (!exportRes.success) throw new Error('Failed to export');

      const theme = themes.find(t => t.id === themeId);
      const body = {
        name: theme.name,
        author: theme.author,
        version: theme.version,
        description: theme.description,
        launcherTitle: theme.launcherTitle,
        colors: theme.colors,
        data: exportRes.data,
      };

      const res = await fetch(`${getServerUrl()}/api/themes/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success) {
        alert('Тема опубликована!');
      } else {
        throw new Error(result.error || 'Ошибка публикации');
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setPublishing(null);
    }
  };

  const downloadTheme = async (themeData) => {
    try {
      const token = getToken();
      const res = await fetch(`${getServerUrl()}/api/themes/download/${themeData._id || themeData.id}`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const result = await res.json();
      if (result.success && result.data) {
        const importRes = await importThemeFile(result.data);
        if (importRes.success) {
          alert('Тема скачана и установлена!');
        } else {
          throw new Error(importRes.error || 'Failed to import');
        }
      } else {
        throw new Error(result.error || 'Ошибка скачивания');
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  const importThemeFile = async (themeDataJson) => {
    try {
      const parsed = JSON.parse(themeDataJson);
      const id = 'public-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const themeWithId = { ...parsed, id };
      const result = await createTheme(themeWithId);
      if (result.success) {
        await selectTheme(result.theme.id);
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const filteredThemes = themes.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.author && t.author.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPublic = publicThemes.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.author && t.author.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = () => { setEditingTheme(null); setShowEditor(true); };
  const handleEdit = (theme) => { setEditingTheme(theme); setShowEditor(true); };

  const handleSave = async (themeData) => {
    if (themeData.id) {
      await updateTheme(themeData.id, themeData);
    } else {
      const result = await createTheme(themeData);
      if (result.success) await selectTheme(result.theme.id);
    }
    setShowEditor(false); setEditingTheme(null);
  };

  const handleDelete = async (themeId) => {
    if (confirm('Удалить эту тему?')) {
      await deleteTheme(themeId);
    }
  };
  const handleExport = async (themeId) => {
    const r = await exportTheme(themeId);
    if (r.success && r.data) {
      const saveResult = await window.electron?.saveThemeFile?.(r.data);
      if (saveResult?.success) alert('Тема сохранена!');
      else if (!saveResult?.success) alert('Ошибка при сохранении файла');
    } else {
      alert(r.error || 'Ошибка экспорта темы');
    }
  };

  const handleImport = useCallback(async () => {
    const filePath = await window.electron?.selectThemeFile?.();
    if (filePath) { const r = await importTheme(filePath); if (!r.success) alert(r.error); }
  }, [importTheme]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragOver(false);
  }, []);

  const handleFileInput = async (e) => {
    for (const file of Array.from(e.target.files)) {
      if (file.name.endsWith('.ilnztheme') && file.path) {
        const r = await importTheme(file.path);
        if (!r.success) alert(r.error);
      }
    }
    e.target.value = '';
  };

  const renderMyThemes = () => (
    <>
      <div className="tm-header">
        <div>
          <h2>Мои темы</h2>
          <p className="tm-subtitle">Управляйте своими темами лаунчера</p>
        </div>
        <div className="tm-actions">
          <button className="tm-btn" onClick={handleImport}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Импорт
          </button>
          <button className="tm-btn tm-btn-accent" onClick={handleCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Создать
          </button>
        </div>
      </div>

      <div className="tm-toolbar">
        <div className="tm-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="tm-count">{filteredThemes.length} тем</span>
      </div>

      <div className={`tm-drop-zone ${dragOver ? 'visible' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p>Перетащите .ilnztheme</p>
      </div>

      <div className="tm-grid">
        {filteredThemes.map(theme => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isActive={theme.id === activeTheme?.id}
            onSelect={selectTheme}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onExport={handleExport}
            onPublish={theme.id !== 'ilnaz-default' ? () => publishTheme(theme.id) : undefined}
            isPublishing={publishing === theme.id}
          />
        ))}
      </div>

      {filteredThemes.length === 0 && (
        <div className="tm-empty">
          <p>Нет тем</p>
          <button className="tm-btn tm-btn-accent" onClick={handleCreate}>Создать первую тему</button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".ilnztheme" onChange={handleFileInput} hidden multiple />
      {showEditor && <ThemeEditor theme={editingTheme} onSave={handleSave} onCancel={() => { setShowEditor(false); setEditingTheme(null); }} />}
    </>
  );

  const renderPublicThemes = () => (
    <>
      <div className="tm-header">
        <div>
          <h2>Каталог тем</h2>
          <p className="tm-subtitle">Скачивайте темы, созданные сообществом</p>
        </div>
        <button className="tm-btn" onClick={loadPublicThemes} disabled={loadingPublic}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Обновить
        </button>
      </div>

      <div className="tm-toolbar">
        <div className="tm-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Поиск в каталоге..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="tm-count">{filteredPublic.length} тем</span>
      </div>

      {loadingPublic ? (
        <div className="tm-loading">
          <div className="tm-spinner" />
          <p>Загрузка каталога...</p>
        </div>
      ) : publicError ? (
        <div className="tm-error">
          <p>{publicError}</p>
          <button className="tm-btn tm-btn-accent" onClick={loadPublicThemes}>Попробовать снова</button>
        </div>
      ) : (
        <>
          <div className="tm-grid">
            {filteredPublic.map(theme => (
              <div key={theme._id || theme.id} className="tm-card tm-card-public">
                <div className="tm-card-preview">
                  {theme.colors?.bgPrimary && (
                    <div className="tm-card-bg" style={{ background: `linear-gradient(135deg, ${theme.colors.bgPrimary} 0%, ${theme.colors.accentPrimary || '#00d4ff'} 100%)` }} />
                  )}
                  {!theme.colors?.bgPrimary && <div className="tm-card-bg tm-card-bg-default" />}
                  <div className="tm-card-info">
                    <h3 className="tm-card-name">{theme.name}</h3>
                    <div className="tm-card-author-row">
                      {theme.authorAvatar && <img src={theme.authorAvatar} alt="" className="tm-card-avatar" />}
                      <span className="tm-card-author">от {theme.author || 'Аноним'}</span>
                    </div>
                  </div>
                </div>
                <p className="tm-card-desc">{theme.description || 'Без описания'}</p>
                <div className="tm-card-footer">
                  <span className="tm-card-version">v{theme.version || '1.0'}</span>
                  <button className="tm-btn tm-btn-accent tm-btn-sm" onClick={() => downloadTheme(theme)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Скачать
                  </button>
                </div>
              </div>
            ))}
          </div>
          {filteredPublic.length === 0 && (
            <div className="tm-empty">
              <p>Ничего не найдено</p>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="themes-page">
      <div className="tm-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tm-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tm-content">
        {activeTab === 'my' ? renderMyThemes() : renderPublicThemes()}
      </div>
    </div>
  );
};

export default ThemeManager;
