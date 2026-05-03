import { useState, useEffect } from 'react';
import { useAuth } from '../../utils/auth';
import './ThemeEditor.css';

const DEFAULT_COLORS = {
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
};

const ThemeEditor = ({ theme, onSave, onCancel }) => {
  const { isAdmin } = useAuth();
  const profile = JSON.parse(localStorage.getItem('ilnaz-user') || {});
  const isEditing = !!theme;
  const avatarSrc = profile.avatar || null;

  const [name, setName] = useState(theme?.name || '');
  const [author, setAuthor] = useState(theme?.author || '');
  const [description, setDescription] = useState(theme?.description || '');
  const [launcherTitle, setLauncherTitle] = useState(theme?.launcherTitle || 'ILNAZ GAMING LAUNCHER');
  const [colors, setColors] = useState(theme?.colors || { ...DEFAULT_COLORS });
  const [bgType, setBgType] = useState(theme?.background?.type || 'gradient');
  const [bgValue, setBgValue] = useState(theme?.background?.value || '');
  const [bgImageBase64, setBgImageBase64] = useState(theme?.background?.type === 'image' ? theme?.background?.value || '' : '');
  const [iconBase64, setIconBase64] = useState(theme?.icon || '');
  const [soundBase64, setSoundBase64] = useState(theme?.soundPath || '');

  useEffect(() => {
    if (theme) {
      setName(theme.name || '');
      setAuthor(theme.author || '');
      setDescription(theme.description || '');
      setLauncherTitle(theme.launcherTitle || '');
      setColors(theme.colors || { ...DEFAULT_COLORS });
      setBgType(theme.background?.type || 'gradient');
      setBgValue(theme.background?.value || '');
      if (theme.background?.type === 'image') setBgImageBase64(theme.background?.value || '');
      setIconBase64(theme.icon || '');
      setSoundBase64(theme.soundPath || '');
    }
  }, [theme]);

  const handleColorChange = (key, value) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = (e, target) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      if (target === 'background') {
        setBgImageBase64(base64);
        setBgValue(base64);
      } else if (target === 'icon') {
        setIconBase64(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSoundUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSoundBase64(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const bg = bgType === 'image'
      ? { type: 'image', value: bgImageBase64 }
      : { type: bgType, value: bgValue };

    onSave({
      ...(isEditing ? { id: theme.id } : {}),
      name: name.trim(),
      author: author.trim() || 'Пользователь',
      description: description.trim(),
      launcherTitle: launcherTitle.trim() || 'ILNAZ GAMING LAUNCHER',
      colors,
      background: bg,
      icon: iconBase64 || null,
      soundPath: soundBase64 || null,
    });
  };

  const colorFields = [
    { key: 'bgPrimary', label: 'Основной фон' },
    { key: 'bgSecondary', label: 'Вторичный фон' },
    { key: 'bgTertiary', label: 'Третичный фон' },
    { key: 'accentPrimary', label: 'Акцент 1' },
    { key: 'accentSecondary', label: 'Акцент 2' },
    { key: 'textPrimary', label: 'Текст основной' },
    { key: 'textSecondary', label: 'Текст вторичный' },
    { key: 'textMuted', label: 'Текст приглушённый' },
    { key: 'glassBg', label: 'Стекло фон' },
    { key: 'glassBorder', label: 'Стекло рамка' },
    { key: 'success', label: 'Успех' },
    { key: 'warning', label: 'Предупреждение' },
    { key: 'danger', label: 'Ошибка' },
  ];

  return (
    <div className="theme-editor-overlay" onClick={onCancel}>
      <div className="theme-editor" onClick={e => e.stopPropagation()}>
        <div className="theme-editor-header">
          <h3>{isEditing ? 'Редактировать тему' : 'Создать тему'}</h3>
          <button className="theme-editor-close" onClick={onCancel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="theme-editor-body">
          <div className="editor-section">
            <h4>Основное</h4>
            <div className="editor-row">
              <label>Название</label>
              <input type="text" className="editor-input" value={name} onChange={e => setName(e.target.value)} placeholder="Моя тема" />
            </div>
            <div className="editor-row">
              <label>Автор</label>
              <div className="author-row">
                {avatarSrc && (
                  <img src={avatarSrc} alt="" className="author-avatar" />
                )}
                <input type="text" className="editor-input" value={author} onChange={e => setAuthor(e.target.value)} placeholder={profile.nickname || 'Ваше имя'} />
              </div>
            </div>
            <div className="editor-row">
              <label>Описание</label>
              <textarea className="editor-input" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Описание темы..." />
            </div>
            <div className="editor-row">
              <label>Название лаунчера</label>
              <input type="text" className="editor-input" value={launcherTitle} onChange={e => setLauncherTitle(e.target.value)} placeholder="ILNAZ GAMING LAUNCHER" />
            </div>
          </div>

          <div className="editor-section">
            <h4>Фон</h4>
            <div className="editor-tabs">
              <button className={`editor-tab ${bgType === 'gradient' ? 'active' : ''}`} onClick={() => setBgType('gradient')}>Градиент</button>
              <button className={`editor-tab ${bgType === 'solid' ? 'active' : ''}`} onClick={() => setBgType('solid')}>Цвет</button>
              <button className={`editor-tab ${bgType === 'image' ? 'active' : ''}`} onClick={() => setBgType('image')}>Картинка</button>
            </div>

            {bgType === 'solid' && (
              <div className="editor-row">
                <label>Цвет фона</label>
                <div className="color-input-wrap">
                  <input type="color" value={bgValue.startsWith('#') ? bgValue : '#0a0a1a'} onChange={e => setBgValue(e.target.value)} />
                  <input type="text" className="editor-input" value={bgValue} onChange={e => setBgValue(e.target.value)} />
                </div>
              </div>
            )}

            {bgType === 'gradient' && (
              <div className="editor-row">
                <label>CSS градиент</label>
                <textarea className="editor-input" value={bgValue} onChange={e => setBgValue(e.target.value)} rows={3} placeholder="radial-gradient(ellipse at 20% 80%, rgba(123,47,247,0.15) 0%, transparent 50%)" />
              </div>
            )}

            {bgType === 'image' && (
              <div className="editor-row">
                <label>Фоновое изображение</label>
                <label className="upload-btn">
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'background')} hidden />
                  Загрузить картинку
                </label>
                {bgImageBase64 && (
                  <div className="image-preview">
                    <img src={bgImageBase64} alt="Preview" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="editor-section">
            <h4>Цвета</h4>
            <div className="color-grid">
              {colorFields.map(({ key, label }) => (
                <div className="color-field" key={key}>
                  <label>{label}</label>
                  <div className="color-input-wrap">
                    <input
                      type="color"
                      value={colors[key]?.startsWith('#') ? colors[key] : '#ffffff'}
                      onChange={e => handleColorChange(key, e.target.value)}
                    />
                    <input
                      type="text"
                      className="editor-input-sm"
                      value={colors[key]}
                      onChange={e => handleColorChange(key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-section">
            <h4>Иконка лаунчера</h4>
            <label className="upload-btn">
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={e => handleImageUpload(e, 'icon')} hidden />
              Загрузить иконку
            </label>
            {iconBase64 && (
              <div className="icon-preview">
                <img src={iconBase64} alt="Icon" />
                <span>Иконка будет применена после перезапуска</span>
              </div>
            )}
          </div>

          <div className="editor-section">
            <h4>Звук запуска</h4>
            <label className="upload-btn">
              <input type="file" accept="audio/*,.flac,.mp3,.wav,.ogg" onChange={e => handleSoundUpload(e)} hidden />
              Загрузить звук
            </label>
            {soundBase64 && (
              <div className="sound-preview">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span>Звук загружен</span>
                <audio controls src={soundBase64} className="sound-audio" />
              </div>
            )}
            {!soundBase64 && (
              <span className="sound-hint">Без звука — запуск будет мгновенным</span>
            )}
          </div>
        </div>

        <div className="theme-editor-footer">
          <button className="theme-btn-secondary" onClick={onCancel}>Отмена</button>
          <button className="theme-btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {isEditing ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeEditor;
