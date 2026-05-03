import { useState } from 'react';
import './GameCard.css';

const GameCard = ({ game, onLaunch, onRemove, onSettings }) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleLaunch = (e) => {
    e.stopPropagation();
    onLaunch(game);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(game.id);
  };

  const handleSettings = (e) => {
    e.stopPropagation();
    if (onSettings) onSettings(game);
  };

  const isMinecraft = game.source === 'minecraft';
  const playtime = game.playtime;
  const playtimeText = playtime ? `${playtime.hours}ч ${String(playtime.minutes).padStart(2, '0')}м` : '0ч 00м';

  return (
    <div className={`game-card glass fade-in ${isMinecraft ? 'mc-game-card' : ''}`}>
      <div className="game-cover">
        {game.icon ? (
          <img src={game.icon} alt={game.name} />
        ) : (
          <div className="game-cover-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0 0 10 9.87v4.263a1 1 0 0 0 1.555.832l3.197-2.132a1 1 0 0 0 0-1.664z" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
        )}
        <div className="game-overlay">
          <button className="play-btn" onClick={handleLaunch}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Играть</span>
          </button>
        </div>
        {!isMinecraft && (
          <button className="remove-btn" onClick={handleRemove}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
        {isMinecraft && onSettings && (
          <button className="settings-btn" onClick={handleSettings}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
      <div className="game-info">
        <h3 className="game-title">{game.name}</h3>
        <div className="game-meta">
          {isMinecraft ? (
            <>
              <span className="game-source mc-source">Minecraft</span>
              {playtime && <span className="game-playtime">{playtimeText}</span>}
            </>
          ) : (
            <span className="game-source">{game.source === 'desktop' ? '.desktop' : 'Binary'}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameCard;
