import { useState, useEffect } from 'react';
import { getApiUrl } from '../../config';
import './WebGames.css';

const makeSlug = (name) => {
  return name
    .replace(/ /g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
};

const WebGames = () => {
  const [games, setGames] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/webgames`);
        const data = await res.json();
        const list = (data.games || []).filter(g => g.id !== -1 && g.url?.includes('{HTML_URL}'));
        setGames(list);
        setFiltered(list);
      } catch (e) {
        console.error('Failed to load web games:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let f = games;
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter(g => g.name.toLowerCase().includes(q));
    }
    setFiltered(f);
  }, [search, games]);

  if (loading) return <div className="webgames-page"><div className="webgames-loading">Загрузка игр...</div></div>;

  return (
    <div className="webgames-page">
      <div className="webgames-header">
        <h2>Веб-игры</h2>
        <p className="webgames-count">{games.length} игр доступно</p>
        <input
          type="text"
          placeholder="Поиск игр..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="webgames-search"
        />
      </div>
      <div className="webgames-grid">
        {filtered.map(game => {
          const slug = makeSlug(game.name);
          return (
            <a
              key={game.id}
              className="webgames-card"
              href={`/webgame/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="webgames-card-cover">
                <img
                  src={game.cover?.replace('{COVER_URL}', 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main').replace('{HTML_URL}', 'https://cdn.jsdelivr.net/gh/freebuisness/html@main')}
                  alt={game.name}
                  loading="lazy"
                />
              </div>
              <div className="webgames-card-info">
                <h3>{game.name}</h3>
                {game.author && <p className="webgames-card-author">{game.author}</p>}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default WebGames;
