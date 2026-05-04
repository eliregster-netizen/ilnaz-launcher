import { useState, useRef, useCallback, useEffect } from 'react';
import { getServerUrl } from '../../config';
import { login, getActiveUser } from '../../utils/auth';
import VerifyBadge from '../../components/VerifyBadge/VerifyBadge';
import './Music.css';

const FAVORITES_KEY = 'ilnaz-music-favorites';

const getFavorites = () => {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
  } catch { return []; }
};

const saveFavorites = (favorites) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
};

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const Music = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [favorites, setFavorites] = useState(getFavorites);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const currentUser = getActiveUser();
  const currentUserId = currentUser?.id;

  const loadTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getServerUrl()}/api/music`);
      const data = await res.json();
      setTracks(data.tracks || []);
    } catch (e) {
      setError('Не удалось загрузить музыку. Сервер недоступен.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  const toggleFavorite = (trackId) => {
    const newFavorites = favorites.includes(trackId)
      ? favorites.filter(id => id !== trackId)
      : [...favorites, trackId];
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const token = localStorage.getItem('ilnaz-token');
      if (!token) {
        const savedUser = localStorage.getItem('ilnaz-user');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          if (userData.username && userData.password) {
            await login(userData.username, userData.password);
          }
        }
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${getServerUrl()}/api/music`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}` },
        body: formData,
      });
      
      const result = await res.json();
      if (result.success) {
        alert('Музыка загружена!');
        loadTracks();
      } else {
        throw new Error(result.error || 'Ошибка загрузки');
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (trackId) => {
    if (!confirm('Удалить этот трек?')) return;
    try {
      const token = localStorage.getItem('ilnaz-token');
      const res = await fetch(`${getServerUrl()}/api/music/${trackId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) {
        alert('Трек удалён!');
        loadTracks();
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  const playTrack = (track) => {
    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const displayedTracks = activeTab === 'favorites' 
    ? tracks.filter(t => favorites.includes(t.id))
    : tracks;

  return (
    <div className="music-page">
      <audio 
        ref={audioRef} 
        src={currentTrack ? `${getServerUrl()}${currentTrack.path}` : ''} 
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        autoPlay 
      />
      
      <div className="music-header">
        <h1>Музыка</h1>
        <div className="music-actions">
          <button className="music-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Загрузка...' : 'Загрузить трек'}
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleUpload} hidden />
          <button className="music-btn music-btn-secondary" onClick={loadTracks} disabled={loading}>
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      <div className="music-tabs">
        <button className={`music-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          Все треки
        </button>
        <button className={`music-tab ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => setActiveTab('favorites')}>
          ♥ Избранное {favorites.length > 0 && <span className="music-tab-count">{favorites.length}</span>}
        </button>
      </div>

      {error && <div className="music-error">{error}</div>}

      {currentTrack && (
        <div className="music-player">
          <div className="player-info">
            <span className="player-name">{currentTrack.originalName}</span>
            <span className="player-author">
              published by {currentTrack.author}
              <VerifyBadge role={currentTrack.authorRole} size="sm" style={{ marginLeft: '5px' }} />
            </span>
          </div>
          <div className="player-controls">
            <button className="player-btn" onClick={() => {
              if (audioRef.current) {
                if (isPlaying) audioRef.current.pause();
                else audioRef.current.play();
                setIsPlaying(!isPlaying);
              }
            }}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <span className="player-time">{formatTime(currentTime)}</span>
            <input 
              type="range" 
              className="player-seek"
              min="0" 
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
            />
            <span className="player-time">{formatTime(duration)}</span>
            <div className="player-volume">
              <span>🔊</span>
              <input 
                type="range" 
                className="volume-slider"
                min="0" 
                max="1" 
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
              />
            </div>
          </div>
        </div>
      )}

      <div className="music-list">
        {displayedTracks.length === 0 && !loading && (
          <div className="music-empty">
            {activeTab === 'favorites' ? 'Нет избранных треков' : 'Музыка пока не загружена'}
          </div>
        )}
        {displayedTracks.map(track => (
          <div 
            key={track.id} 
            className={`music-track ${currentTrack?.id === track.id ? 'active' : ''}`}
            onClick={() => playTrack(track)}
          >
            <div className="track-play">
              {currentTrack?.id === track.id && isPlaying ? '⏸' : '▶'}
            </div>
            <div className="track-info">
              <span className="track-name">{track.originalName}</span>
              <span className="track-author">
                published by {track.author}
                <VerifyBadge role={track.authorRole} size="sm" style={{ marginLeft: '5px' }} />
              </span>
            </div>
            <button 
              className={`track-favorite ${favorites.includes(track.id) ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
              title={favorites.includes(track.id) ? 'Убрать из избранного' : 'В избранное'}
            >
              {favorites.includes(track.id) ? '♥' : '♡'}
            </button>
            <div className="track-meta">
              <span>{track.format.toUpperCase()}</span>
              <span>{formatSize(track.size)}</span>
            </div>
            {(track.authorId === currentUserId || currentUser?.role === 'admin' || currentUser?.role === 'owner') && (
              <button 
                className="track-delete" 
                onClick={(e) => { e.stopPropagation(); handleDelete(track.id); }}
                title="Удалить"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Music;