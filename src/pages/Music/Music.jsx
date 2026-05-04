import { useState, useRef, useCallback, useEffect } from 'react';
import { getServerUrl } from '../../config';
import { login, getActiveUser } from '../../utils/auth';
import { useMusic } from '../../context/MusicContext';
import VerifyBadge from '../../components/VerifyBadge/VerifyBadge';
import PlaylistEditor from '../../components/PlaylistEditor/PlaylistEditor';
import './Music.css';

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
  const [activeTab, setActiveTab] = useState('all');
  const [playlists, setPlaylists] = useState([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  
  const { 
    currentTrack, 
    isPlaying, 
    volume,
    currentTime,
    duration,
    favorites,
    playTrack, 
    togglePlay,
    setVolumeLevel,
    toggleFavorite,
    isFavorite,
    seekTo,
    stop,
  } = useMusic();
  
  const currentUser = getActiveUser();
  const currentUserId = currentUser?.id;

  const loadTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getServerUrl()}/api/music`);
      const data = await res.json();
      setTracks(data.tracks || []);
      
      const plRes = await fetch(`${getServerUrl()}/api/playlists`);
      const plData = await plRes.json();
      setPlaylists(plData.playlists || []);
    } catch (e) {
      setError('Не удалось загрузить музыку. Сервер недоступен.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

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

  const handleAddToPlaylist = (playlistId) => {
    // Will open a modal to select track
    const trackId = prompt('Введите ID трека для добавления (или выберите из списка)');
    if (!trackId) return;
    
    fetch(`${getServerUrl()}/api/playlists/${playlistId}/add`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}`
      },
      body: JSON.stringify({ trackId })
    }).then(res => res.json()).then(result => {
      if (result.success) {
        alert('Трек добавлен в плейлист!');
        loadTracks();
      } else {
        throw new Error(result.error);
      }
    }).catch(e => alert('Ошибка: ' + e.message));
  };

  const handleSavePlaylist = async (playlistData) => {
    try {
      const formData = new FormData();
      if (playlistData.name) formData.append('name', playlistData.name);
      if (playlistData.cover) formData.append('cover', playlistData.cover);
      
      const url = playlistData.id 
        ? `${getServerUrl()}/api/playlists/${playlistData.id}`
        : `${getServerUrl()}/api/playlists`;
      
      const method = playlistData.id ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}` },
        body: formData
      });
      
      const result = await res.json();
      if (result.success) {
        alert(playlistData.id ? 'Плейлист обновлён!' : 'Плейлист создан!');
        setEditingPlaylist(null);
        loadTracks(); // Reload playlists
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (!confirm('Удалить этот плейлист?')) return;
    try {
      const res = await fetch(`${getServerUrl()}/api/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}` }
      });
      const result = await res.json();
      if (result.success) {
        alert('Плейлист удалён!');
        setEditingPlaylist(null);
        loadTracks();
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  const handleUploadCover = async (trackId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('cover', file);
      
      try {
        const res = await fetch(`${getServerUrl()}/api/music/${trackId}/cover`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}` },
          body: formData,
        });
        const result = await res.json();
        if (result.success) {
          alert('Обложка обновлена!');
          loadTracks();
        } else {
          throw new Error(result.error);
        }
      } catch (e) {
        alert('Ошибка: ' + e.message);
      }
    };
    input.click();
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

  const handlePlayTrack = (track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track);
    }
  };

  const handleTrackEnded = useCallback(() => {
    // Update duration when track ends
    if (currentTrack && duration > 0) {
      const serverUrl = getServerUrl();
      fetch(`${serverUrl}/api/music/${currentTrack.id}/duration`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}`
        },
        body: JSON.stringify({ duration })
      }).catch(() => {});
    }
  }, [currentTrack, duration]);

  const handleSeek = (e) => {
    seekTo(parseFloat(e.target.value));
  };

  const displayedTracks = activeTab === 'favorites' 
    ? tracks.filter(t => favorites.includes(t.id))
    : tracks;

  return (
    <div className="music-page">
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
          Все треки ({tracks.length})
        </button>
        <button className={`music-tab ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => setActiveTab('favorites')}>
          ♥ Избранное {favorites.length > 0 && <span className="music-tab-count">{favorites.length}</span>}
        </button>
        <button className={`music-tab ${activeTab === 'playlists' ? 'active' : ''}`} onClick={() => { setActiveTab('playlists'); setShowPlaylistModal(true); }}>
          Плейлисты ({playlists.length})
        </button>
      </div>

      {error && <div className="music-error">{error}</div>}

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
            onClick={() => handlePlayTrack(track)}
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
              className={`track-favorite ${isFavorite(track.id) ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
              title={isFavorite(track.id) ? 'Убрать из избранного' : 'В избранное'}
            >
              {isFavorite(track.id) ? '♥' : '♡'}
            </button>
            <div className="track-meta">
              <span>{track.format.toUpperCase()}</span>
              <span>{formatSize(track.size)}</span>
              {track.duration > 0 && (
                <span>{formatTime(track.duration)}</span>
              )}
              {track.playCount > 0 && (
                <span title="Прослушиваний">{track.playCount} 🔊</span>
              )}
            </div>
            {(track.authorId === currentUserId || currentUser?.role === 'admin' || currentUser?.role === 'owner') && (
              <div className="track-actions">
                <button 
                  className="track-cover-btn" 
                  onClick={(e) => { e.stopPropagation(); handleUploadCover(track.id); }}
                  title="Загрузить обложку"
                >
                  🖼
                </button>
                <button 
                  className="track-delete" 
                  onClick={(e) => { e.stopPropagation(); handleDelete(track.id); }}
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showPlaylistModal && (
        <div className="playlist-modal" onClick={(e) => { if (e.target === e.currentTarget) setShowPlaylistModal(false); }}>
          <div className="playlist-modal-content">
            <div className="playlist-header">
              <h2>{editingPlaylist ? 'Редактировать плейлист' : 'Мои плейлисты'}</h2>
              <button className="modal-close" onClick={() => { setShowPlaylistModal(false); setEditingPlaylist(null); }}>✕</button>
            </div>

            {!editingPlaylist && (
              <div className="playlist-create">
                <button className="music-btn" onClick={() => setEditingPlaylist({})}>
                  + Создать плейлист
                </button>
              </div>
            )}

            {editingPlaylist && (
              <PlaylistEditor 
                playlist={editingPlaylist}
                onSave={handleSavePlaylist}
                onCancel={() => setEditingPlaylist(null)}
                onDelete={handleDeletePlaylist}
              />
            )}

            {!editingPlaylist && (
              <div className="playlist-list">
                {playlists.length === 0 && <div className="music-empty">Нет плейлистов</div>}
                {playlists.map(pl => (
                  <div key={pl.id} className="playlist-item">
                    <div className="playlist-cover">
                      {pl.cover ? (
                        <img src={`${getServerUrl()}${pl.cover}`} alt="" />
                      ) : (
                        <span>🎵</span>
                      )}
                    </div>
                    <div className="playlist-info">
                      <span className="playlist-name">{pl.name}</span>
                      <span className="playlist-meta">
                        {pl.tracks?.length || 0} треков
                      </span>
                    </div>
                    <div className="playlist-actions">
                      <button onClick={() => setEditingPlaylist(pl)}>✏️</button>
                      <button onClick={() => handleAddToPlaylist(pl.id)}>➕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Music;