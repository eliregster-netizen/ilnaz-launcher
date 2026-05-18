import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createGame, updateGame, fetchGame } from '../../utils/hubApi';
import { getActiveUser } from '../../utils/auth';
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

  useEffect(() => {
    if (!user) { navigate('/hub'); return; }
    if (editId) loadGame(editId);
  }, [editId]);

  const loadGame = async (id) => {
    // Need to fetch by id — use my-games list or fetch by slug
    // We'll fetch my games and find by id
    const { fetchMyGames } = await import('../../utils/hubApi');
    const games = await fetchMyGames();
    const game = games.find(g => g.id === id);
    if (game) {
      setIsEditing(true);
      setForm({
        title: game.title,
        description: game.description,
        shortDescription: game.shortDescription || '',
        genre: game.genre || 'Other',
        tags: (game.tags || []).join(', '),
        coverUrl: game.coverUrl || '',
        screenshots: (game.screenshots || []).join('\n'),
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const data = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      screenshots: form.screenshots.split('\n').map(s => s.trim()).filter(Boolean),
    };

    let result;
    if (isEditing) {
      result = await updateGame(editId, data);
    } else {
      result = await createGame(data);
    }

    setLoading(false);

    if (result.success) {
      navigate(`/hub/game/${result.game.slug}`);
    } else {
      setError(result.error || 'Ошибка при сохранении');
    }
  };

  return (
    <div className="submit-page fade-in">
      <div className="submit-container glass">
        <h1 className="submit-title">{isEditing ? 'Редактировать игру' : 'Добавить игру'}</h1>
        <p className="submit-subtitle">После отправки игра будет отправлена на проверку администратору</p>

        {error && <div className="submit-error">{error}</div>}

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
              <label>Ссылка на обложку</label>
              <input name="coverUrl" value={form.coverUrl} onChange={handleChange} placeholder="https://example.com/cover.jpg" />
            </div>
            <div className="form-group">
              <label>Ссылка на веб-версию</label>
              <input name="webUrl" value={form.webUrl} onChange={handleChange} placeholder="https://example.com/play" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ссылка на скачивание</label>
              <input name="downloadUrl" value={form.downloadUrl} onChange={handleChange} placeholder="https://example.com/game.zip" />
            </div>
          </div>

          <div className="form-group">
            <label>Скриншоты (по одному URL на строку)</label>
            <textarea name="screenshots" value={form.screenshots} onChange={handleChange} rows={3} placeholder="https://example.com/screen1.jpg" />
          </div>

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
