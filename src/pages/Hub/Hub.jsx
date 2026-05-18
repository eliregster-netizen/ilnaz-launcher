import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchGames, fetchGenres, fetchPendingGames } from '../../utils/hubApi';
import { getActiveUser, isAdmin } from '../../utils/auth';
import './Hub.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Новые' },
  { value: 'plays', label: 'Популярные' },
  { value: 'rating', label: 'Рейтинг' },
  { value: 'downloads', label: 'Загрузки' },
];

const Hub = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeGenre, setActiveGenre] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);

  const user = getActiveUser();
  const admin = isAdmin();

  useEffect(() => {
    loadGenres();
    if (admin) loadPendingCount();
  }, []);

  useEffect(() => {
    loadGames();
  }, [search, activeGenre, sort, page]);

  const loadGames = async () => {
    setLoading(true);
    const data = await fetchGames({ search, genre: activeGenre, sort, page, limit: 24 });
    if (data.games) setGames(data.games);
    if (data.pages) setTotalPages(data.pages);
    setLoading(false);
  };

  const loadGenres = async () => {
    const data = await fetchGenres();
    if (Array.isArray(data)) setGenres(data);
  };

  const loadPendingCount = async () => {
    const data = await fetchPendingGames();
    if (Array.isArray(data)) setPendingCount(data.length);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadGames();
  };

  return (
    <div className="hub-page fade-in">
      <div className="hub-header glass">
        <div className="hub-header-top">
          <h1 className="hub-title">Game Hub</h1>
          {user && (
            <div className="hub-header-actions">
              <Link to="/hub/my-games" className="hub-btn outline">Мои игры</Link>
              <Link to="/hub/submit" className="hub-btn primary">+ Добавить игру</Link>
            </div>
          )}
        </div>
        <form className="hub-search" onSubmit={handleSearch}>
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" placeholder="Поиск игр, разработчиков..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </form>
      </div>

      <div className="hub-controls glass">
        <div className="hub-genres">
          <button className={`genre-pill ${activeGenre === '' ? 'active' : ''}`} onClick={() => { setActiveGenre(''); setPage(1); }}>
            Все
          </button>
          {genres.map(g => (
            <button key={g} className={`genre-pill ${activeGenre === g ? 'active' : ''}`} onClick={() => { setActiveGenre(g); setPage(1); }}>
              {g}
            </button>
          ))}
        </div>
        <select className="hub-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {admin && pendingCount > 0 && (
        <div className="hub-pending-banner glass" onClick={() => navigate('/admin?tab=hub')}>
          <span className="pending-dot" />
          {pendingCount} игра{['','ы','и'][pendingCount % 10 > 4 || pendingCount % 100 > 10 ? 2 : pendingCount % 10 === 1 ? 0 : pendingCount % 10 < 5 ? 1 : 2]} на проверку
        </div>
      )}

      <div className="hub-grid">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <div key={i} className="hub-card glass skeleton" />)
        ) : games.length === 0 ? (
          <div className="hub-empty">
            <p>Игры не найдены</p>
            {user && <Link to="/hub/submit" className="hub-btn primary">Будь первым — добавь игру!</Link>}
          </div>
        ) : (
          games.map(game => (
            <Link to={`/hub/game/${game.slug}`} key={game.id} className="hub-card glass">
              <div className="hub-card-cover">
                {game.coverUrl ? (
                  <img src={game.coverUrl} alt={game.title} loading="lazy" />
                ) : (
                  <div className="hub-card-no-cover">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
                <div className="hub-card-stats">
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    {game.avgRating || '—'}
                  </span>
                  <span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    {game.playCount}
                  </span>
                </div>
              </div>
              <div className="hub-card-info">
                <h3 className="hub-card-title">{game.title}</h3>
                <span className="hub-card-dev">{game.developerName}</span>
                <div className="hub-card-tags">
                  <span className="hub-tag">{game.genre}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="hub-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Вперёд →</button>
        </div>
      )}
    </div>
  );
};

export default Hub;
