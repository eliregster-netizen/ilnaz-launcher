import { useState, useRef, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import VerifyBadge from '../VerifyBadge/VerifyBadge';
import './GlobalPlayer.css';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const GlobalPlayer = () => {
  const { currentTrack, isPlaying, volume, currentTime, duration, togglePlay, seekTo, setVolumeLevel, stop } = useMusic();
  const [expanded, setExpanded] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const progressRef = useRef(null);

  const handleProgressClick = (e) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * duration);
  };

  if (!currentTrack) return null;

  return (
    <div className={`global-player ${expanded ? 'expanded' : ''}`} tabIndex={0}>
      <div className="player-main" onClick={() => setExpanded(!expanded)}>
        <button className="player-play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        
        <div className="player-track-info">
          <span className="player-title">{currentTrack.originalName}</span>
          <span className="player-author">
            {currentTrack.author}
            {currentTrack.authorRole && <VerifyBadge role={currentTrack.authorRole} size="sm" style={{ marginLeft: '5px' }} />}
          </span>
        </div>

        <div className="player-progress" ref={progressRef} onClick={handleProgressClick}>
          <div className="progress-bar" style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }} />
        </div>

        <span className="player-time">{formatTime(currentTime)} / {formatTime(duration)}</span>

        <div className="player-volume-ctrl" onClick={(e) => e.stopPropagation()}>
          <button 
            className="volume-btn" 
            onClick={() => setShowVolume(!showVolume)}
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          {(showVolume || expanded) && (
            <div className="volume-popup">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>

        <button className="player-close" onClick={(e) => { e.stopPropagation(); stop(); }}>✕</button>
      </div>

      {expanded && (
        <div className="player-expanded">
          <div className="expanded-info">
            <div className="expanded-cover">
              <span className="music-icon">🎵</span>
            </div>
            <div className="expanded-details">
              <h3>{currentTrack.originalName}</h3>
              <p>published by {currentTrack.author}</p>
            </div>
          </div>
          <div className="expanded-controls">
            <button onClick={() => seekTo(Math.max(0, currentTime - 10))}>-10s</button>
            <button className="big-play" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button onClick={() => seekTo(Math.min(duration, currentTime + 10))}>+10s</button>
          </div>
          <div className="expanded-seek">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
            />
            <div className="seek-labels">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalPlayer;