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
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    {game.avgRating || '—'} ({game.ratingCount})
                  </span>
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    {game.playCount}
                  </span>
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {game.downloadCount}
                  </span>
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    {game.likeCount}
                  </span>
                </div>
                <div className="mygame-slug">{game.slug}</div>
                <div className="mygame-actions">
                  <Link to={`/hub/submit?edit=${game.id}`} className="hub-btn outline small">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Редактировать
                  </Link>
                  <Link to={`/hub/game/${game.slug}`} className="hub-btn outline small">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Просмотр
                  </Link>
                  <button className="hub-btn outline small" onClick={() => handleDelete(game.id)} style={{ color: 'var(--danger)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Удалить
                  </button>
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
