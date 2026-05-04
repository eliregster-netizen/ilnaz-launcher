import { useState, useRef, useCallback } from 'react';
import { getServerUrl } from '../config';
import { login, getActiveUser } from '../utils/auth';
import VerifyBadge from '../components/VerifyBadge/VerifyBadge';
import './Music.css';

const Music = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
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
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}`,
        },
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

  return (
    <div className="music-page">
      <audio ref={audioRef} src={currentTrack ? `${getServerUrl()}${currentTrack.path}` : ''} 
        onEnded={() => setIsPlaying(false)} autoPlay />
      
      <div className="music-header">
        <h1>Музыка</h1>
        <div className="music-actions">
          <button className="music-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Загрузка...' : 'Загрузить трек'}
          </button>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="audio/*" 
            onChange={handleUpload} 
            hidden 
          />
          <button className="music-btn music-btn-secondary" onClick={loadTracks} disabled={loading}>
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      {error && <div className="music-error">{error}</div>}

      {currentTrack && (
        <div className="music-player">
          <div className="player-info">
            <span className="player-name">{currentTrack.originalName}</span>
            <span className="player-author">
              by {currentTrack.author}
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
            <input 
              type="range" 
              className="player-seek"
              min="0" 
              max={audioRef.current?.duration || 100}
              value={audioRef.current?.currentTime || 0}
              onChange={(e) => { audioRef.current.currentTime = e.target.value; }}
            />
            <span className="player-time">
              {Math.floor(audioRef.current?.currentTime || 0)} / {Math.floor(audioRef.current?.duration || 0)}
            </span>
          </div>
        </div>
      )}

      <div className="music-list">
        {tracks.length === 0 && !loading && (
          <div className="music-empty">
            Музыка пока не загружена
          </div>
        )}
        {tracks.map(track => (
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
                by {track.author}
                <VerifyBadge role={track.authorRole} size="sm" style={{ marginLeft: '5px' }} />
              </span>
            </div>
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