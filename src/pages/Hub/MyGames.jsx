import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMyGames, deleteGame } from '../../utils/hubApi';
import { getActiveUser } from '../../utils/auth';
import './MyGames.css';

const STATUS_LABELS = {
  published: 'Опубликовано',
  pending_review: 'На проверке',
  rejected: 'Отклонено',
};

const STATUS_COLORS = {
  published: 'var(--success)',
  pending_review: 'var(--warning)',
  rejected: 'var(--danger)',
};

const MyGames = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = getActiveUser();

  useEffect(() => {
    if (!user) { navigate('/hub'); return; }
    loadGames();
  }, []);

  const loadGames = async () => {
    setLoading(true);
    const data = await fetchMyGames();
    if (Array.isArray(data)) setGames(data);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Удалить игру? Это действие нельзя отменить.')) return;
    await deleteGame(id);
    loadGames();
  };

  return (
    <div className="mygames-page fade-in">
      <div className="mygames-header glass">
        <div className="mygames-header-left">
          <Link to="/hub" className="hub-btn outline small">← Hub</Link>
          <h1>Мои игры</h1>
        </div>
        <Link to="/hub/submit" className="hub-btn primary">+ Добавить игру</Link>
      </div>

      {loading ? (
        <div className="mygames-loading"><div className="spinner" /></div>
      ) : games.length === 0 ? (
        <div className="mygames-empty glass">
          <p>У вас пока нет игр</p>
          <Link to="/hub/submit" className="hub-btn primary">Добавить первую игру</Link>
        </div>
      ) : (
        <div className="mygames-list">
          {games.map(game => (
            <div key={game.id} className="mygame-card glass">
              <div className="mygame-cover">
                {game.coverUrl ? (
                  <img src={game.coverUrl} alt={game.title} />
                ) : (
                  <div className="mygame-no-cover">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="mygame-info">
                <div className="mygame-title-row">
                  <h3>{game.title}</h3>
                  <span className="mygame-status" style={{ color: STATUS_COLORS[game.status] || 'var(--text-muted)' }}>
                    {STATUS_LABELS[game.status] || game.status}
                  </span>
                </div>
                <div className="mygame-meta">
                  <span>⭐ {game.avgRating || '—'} ({game.ratingCount})</span>
                  <span>▶ {game.playCount}</span>
                  <span>⬇ {game.downloadCount}</span>
                  <span>❤ {game.likeCount}</span>
                </div>
                <div className="mygame-slug">{game.slug}</div>
                <div className="mygame-actions">
                  <Link to={`/hub/submit?edit=${game.id}`} className="hub-btn outline small">✏️ Редактировать</Link>
                  <Link to={`/hub/game/${game.slug}`} className="hub-btn outline small">👁️ Просмотр</Link>
                  <button className="hub-btn outline small" onClick={() => handleDelete(game.id)} style={{ color: 'var(--danger)' }}>🗑️ Удалить</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyGames;
