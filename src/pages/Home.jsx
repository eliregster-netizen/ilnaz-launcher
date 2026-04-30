import { useState, useEffect } from 'react';
import GameCard from '../components/GameCard/GameCard';
import './Home.css';

const Home = ({ profile }) => {
  const [games, setGames] = useState([]);
  const [recentGames, setRecentGames] = useState([]);

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    const loaded = await window.electron.getGames();
    setGames(loaded);
    setRecentGames(loaded.slice(-3).reverse());
  };

  return (
    <div className="home-page fade-in">
      <div className="hero-section glass">
        <div className="hero-content">
          <h1 className="hero-title">
            Добро пожаловать, <span className="text-gradient">{profile.nickname}</span>!
          </h1>
          <p className="hero-subtitle">Ваша игровая библиотека ждёт вас</p>
        </div>
        <div className="hero-decoration">
          <div className="hero-circle hero-circle-1" />
          <div className="hero-circle hero-circle-2" />
          <div className="hero-circle hero-circle-3" />
        </div>
      </div>

      {recentGames.length > 0 && (
        <div className="recent-section fade-in fade-in-delay-1">
          <h2 className="section-title">Недавние игры</h2>
          <div className="games-row">
            {recentGames.map((game) => (
              <GameCard key={game.id} game={game} onLaunch={launchGame} onRemove={removeGame} />
            ))}
          </div>
        </div>
      )}

      <div className="stats-section fade-in fade-in-delay-2">
        <div className="stat-card glass">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{games.length}</div>
            <div className="stat-label">Всего игр</div>
          </div>
        </div>
        <div className="stat-card glass">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{(profile.friends || []).length}</div>
            <div className="stat-label">Друнов</div>
          </div>
        </div>
        <div className="stat-card glass">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{profile.hours_played || 0}</div>
            <div className="stat-label">Часов в играх</div>
          </div>
        </div>
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

export default Home;
