import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createGame, updateGame } from '../../utils/hubApi';
import { getActiveUser } from '../../utils/auth';
import { getApiUrl } from '../../config';
import './SubmitGame.css';

const GENRES = [
  'Action', 'Adventure', 'Arcade', 'FPS', 'Puzzle', 'Racing', 'RPG',
  'Simulation', 'Sports', 'Strategy', 'Other',
];

const SubmitGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const user = getActiveUser();

  const [form, setForm] = useState({
    title: '', description: '', shortDescription: '', genre: 'Other',
    tags: '', coverUrl: '', screenshots: '', webUrl: '', downloadUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [gameId, setGameId] = useState(editId);
  const [coverFile, setCoverFile] = useState(null);
  const [screenshotFiles, setScreenshotFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [existingScreenshots, setExistingScreenshots] = useState([]);

  useEffect(() => {
    if (!user) { navigate('/hub'); return; }
    if (editId) loadGame(editId);
  }, [editId]);

  const loadGame = async (id) => {
    const { fetchMyGames } = await import('../../utils/hubApi');
    const games = await fetchMyGames();
    const game = games.find(g => g.id === id);
    if (game) {
      setIsEditing(true);
      setGameId(game.id);
      setExistingScreenshots(game.screenshots || []);
      setForm({
        title: game.title,
        description: game.description,
        shortDescription: game.shortDescription || '',
        genre: game.genre || 'Other',
        tags: (game.tags || []).join(', '),
        coverUrl: game.coverUrl || '',
        screenshots: '',
        webUrl: game.webUrl || '',
        downloadUrl: game.downloadUrl || '',
      });
    } else {
      setError('Игра не найдена');
    }
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const uploadCoverFile = async (id, file) => {
    const fd = new FormData();
    fd.append('cover', file);
    const token = localStorage.getItem('ilnaz-token');
    const res = await fetch(`${getApiUrl()}/hub/games/${id}/upload-cover`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    return res.json();
  };

  const uploadScreenshots = async (id, files) => {
    const fd = new FormData();
    for (const f of files) fd.append('screenshots', f);
    const token = localStorage.getItem('ilnaz-token');
    const res = await fetch(`${getApiUrl()}/hub/games/${id}/upload-screenshots`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    return res.json();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const data = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      screenshots: isEditing
        ? [...existingScreenshots, ...form.screenshots.split('\n').map(s => s.trim()).filter(Boolean)]
        : form.screenshots.split('\n').map(s => s.trim()).filter(Boolean),
    };

    let result;
    if (isEditing) {
      result = await updateGame(editId, data);
    } else {
      result = await createGame(data);
    }

    if (!result.success) {
      setLoading(false);
      setError(result.error || 'Ошибка при сохранении');
      return;
    }

    const id = result.game.id;

    // Upload files if any
    if (coverFile) {
      setUploading(true);
      const coverResult = await uploadCoverFile(id, coverFile);
      if (!coverResult.success) setError('Обложка не загружена: ' + (coverResult.error || ''));
    }

    if (screenshotFiles.length > 0) {
      setUploading(true);
      const ssResult = await uploadScreenshots(id, screenshotFiles);
      if (!ssResult.success) setError('Скриншоты не загружены: ' + (ssResult.error || ''));
    }

    setLoading(false);
    navigate(`/hub/game/${result.game.slug}`);
  };

  const removeExistingScreenshot = (url) => {
    setExistingScreenshots(prev => prev.filter(s => s !== url));
  };

  return (
    <div className="submit-page fade-in">
      <div className="submit-container glass">
        <h1 className="submit-title">{isEditing ? 'Редактировать игру' : 'Добавить игру'}</h1>
        <p className="submit-subtitle">После отправки игра будет отправлена на проверку администратору</p>

        {error && <div className="submit-error">{error}</div>}
        {uploading && <div className="submit-uploading">Загрузка файлов...</div>}

        <form className="submit-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название игры *</label>
            <input name="title" value={form.title} onChange={handleChange} placeholder="Введите название" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Жанр</label>
              <select name="genre" value={form.genre} onChange={handleChange}>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Теги (через запятую)</label>
              <input name="tags" value={form.tags} onChange={handleChange} placeholder="FPS,MMO,Co-op" />
            </div>
          </div>

          <div className="form-group">
            <label>Краткое описание</label>
            <input name="shortDescription" value={form.shortDescription} onChange={handleChange} placeholder="Коротко об игре" />
          </div>

          <div className="form-group">
            <label>Описание *</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={6} placeholder="Подробное описание игры" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Обложка — URL</label>
              <input name="coverUrl" value={form.coverUrl} onChange={handleChange} placeholder="https://example.com/cover.jpg" />
              <span className="form-hint">Или загрузите файл ниже</span>
            </div>
            <div className="form-group">
              <label>Обложка — файл</label>
              <div className="file-input-wrapper">
                <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files[0])} />
                {coverFile && <span className="file-name">{coverFile.name}</span>}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ссылка на веб-версию</label>
              <input name="webUrl" value={form.webUrl} onChange={handleChange} placeholder="https://example.com/play" />
            </div>
            <div className="form-group">
              <label>Ссылка на скачивание</label>
              <input name="downloadUrl" value={form.downloadUrl} onChange={handleChange} placeholder="https://example.com/game.zip" />
            </div>
          </div>

          <div className="form-group">
            <label>Скриншоты — URL (по одному на строку)</label>
            <textarea name="screenshots" value={form.screenshots} onChange={handleChange} rows={3} placeholder="https://example.com/screen1.jpg" />
            <span className="form-hint">Или загрузите файлы ниже</span>
          </div>

          <div className="form-group">
            <label>Скриншоты — файлы</label>
            <div className="file-input-wrapper">
              <input type="file" accept="image/*" multiple onChange={(e) => setScreenshotFiles([...e.target.files])} />
              {screenshotFiles.length > 0 && <span className="file-name">{screenshotFiles.length} файл(ов)</span>}
            </div>
          </div>

          {isEditing && existingScreenshots.length > 0 && (
            <div className="form-group">
              <label>Загруженные скриншоты</label>
              <div className="existing-screenshots">
                {existingScreenshots.map((url, i) => (
                  <div key={i} className="existing-ss-item">
                    <img src={url} alt={`SS ${i + 1}`} />
                    <button type="button" className="ss-remove" onClick={() => removeExistingScreenshot(url)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="hub-btn outline" onClick={() => navigate(-1)}>Отмена</button>
            <button type="submit" className="hub-btn primary" disabled={loading}>
              {loading ? 'Сохранение...' : isEditing ? 'Сохранить изменения' : 'Отправить на проверку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitGame;
