import { useState, useEffect } from 'react';
import GameCard from '../components/GameCard/GameCard';
import './Library.css';

const Library = () => {
  const [games, setGames] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    const loaded = await window.electron.getGames();
    setGames(loaded);
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

  const filteredGames = games.filter((game) => {
    if (filter !== 'all' && game.source !== filter) return false;
    if (search && !game.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="library-page fade-in">
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
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Все
          </button>
          <button
            className={`filter-btn ${filter === 'desktop' ? 'active' : ''}`}
            onClick={() => setFilter('desktop')}
          >
            .desktop
          </button>
          <button
            className={`filter-btn ${filter === 'executable' ? 'active' : ''}`}
            onClick={() => setFilter('executable')}
          >
            Бинарники
          </button>
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
              {games.length === 0
                ? 'Импортируйте свою первую игру!'
                : 'Попробуйте изменить фильтры'}
            </span>
          </div>
        ) : (
          <div className="games-grid">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onLaunch={launchGame}
                onRemove={removeGame}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  async function launchGame(game) {
    await window.electron.launchGame(game);
  }

  async function removeGame(id) {
    await window.electron.removeGame(id);
    loadGames();
  }
};

export default Library;
