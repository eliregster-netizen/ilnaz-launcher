import { useState, useRef, useCallback, useEffect } from 'react';
import { login, getActiveUser } from '../../utils/auth';
import { getApiUrl, getServerUrl } from '../../config';
import { useMusic } from '../../context/MusicContext';
import VerifyBadge from '../../components/VerifyBadge/VerifyBadge';
import PlaylistEditor from '../../components/PlaylistEditor/PlaylistEditor';
import './Music.css';

const API = getApiUrl();
const BASE_URL = getServerUrl();

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
  const [viewedPlaylistId, setViewedPlaylistId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNowPlaying, setShowNowPlaying] = useState(true);
  const [addTrackToPlaylistId, setAddTrackToPlaylistId] = useState(null);
  const [addTrackIdInput, setAddTrackIdInput] = useState('');
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
    playNext,
    playPrevious,
    currentPlaylist,
    currentTrackIndex
  } = useMusic();
  
  const currentUser = getActiveUser();
  const currentUserId = currentUser?.id;

  const loadTracks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/music`);
      const data = await res.json();
      setTracks(data.tracks || []);
      
      const plRes = await fetch(`${API}/playlists`);
      const plData = await plRes.json();
      setPlaylists(plData.playlists || []);
    } catch (e) {
      setError('Не удалось загрузить музыку. Сервер недоступен.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  useEffect(() => {
    if (activeTab !== 'playlists') {
      setViewedPlaylistId(null);
    }
  }, [activeTab]);

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
      
      const res = await fetch(`${API}/music`, {
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
    setAddTrackToPlaylistId(playlistId);
    setAddTrackIdInput('');
  };

  const confirmAddTrack = async () => {
    if (!addTrackIdInput.trim()) return;
    try {
      const res = await fetch(`${API}/playlists/${addTrackToPlaylistId}/add`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ilnaz-token')}`
        },
        body: JSON.stringify({ trackId: addTrackIdInput })
      });
      const result = await res.json();
      if (result.success) {
        alert('Трек добавлен в плейлист!');
        setAddTrackToPlaylistId(null);
        setAddTrackIdInput('');
        loadTracks();
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      alert('Ошибка: ' + e.message);
    }
  };

  const handleSavePlaylist = async (playlistData) => {
    try {
      const formData = new FormData();
      if (playlistData.name) formData.append('name', playlistData.name);
      if (playlistData.cover) formData.append('cover', playlistData.cover);
      
      const url = playlistData.id 
        ? `${API}/playlists/${playlistData.id}`
        : `${API}/playlists`;
      
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
        loadTracks();
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
      const res = await fetch(`${API}/playlists/${playlistId}`, {
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
        const token = localStorage.getItem('ilnaz-token');
        console.log('[Cover Upload] Token exists:', !!token);
        
        const res = await fetch(`${API}/music/${trackId}/cover`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
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
      const res = await fetch(`${API}/music/${trackId}`, {
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

  const handlePlayTrack = (track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      if (viewedPlaylistId) {
        const playlist = playlists.find(p => p.id === viewedPlaylistId);
        if (playlist && playlist.tracks) {
          const trackIndex = playlist.tracks.indexOf(track.id);
          if (trackIndex >= 0) {
            playTrack(track, playlist.tracks, trackIndex);
            return;
          }
        }
      }
      playTrack(track);
    }
  };

  const handleSeek = (e) => {
    seekTo(parseFloat(e.target.value));
  };

  const displayedTracks = activeTab === 'favorites' 
    ? tracks.filter(t => favorites.includes(t.id))
    : activeTab === 'playlists' && viewedPlaylistId
      ? tracks.filter(t => {
          const playlist = playlists.find(p => p.id === viewedPlaylistId);
          return playlist && playlist.tracks?.includes(t.id);
        })
      : tracks;

  const filteredTracks = searchQuery
    ? displayedTracks.filter(t => 
        t.originalName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.author?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : displayedTracks;

  return (
    <div className="music-page">
      {/* Header */}
      <div className="music-header">
        <h1>Музыка</h1>
        
        <div className="music-search">
          <input 
            type="text" 
            placeholder="Поиск треков..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="music-search-icon">🔍</span>
        </div>
        
        <div className="header-actions">
          <button className="music-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Загрузка...' : 'Загрузить трек'}
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleUpload} hidden />
          <button className="music-btn music-btn-secondary" onClick={loadTracks} disabled={loading}>
            {loading ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* Now Playing Section */}
      {currentTrack && showNowPlaying && (
        <div className="now-playing">
          <div className="now-playing-header">
            <div className="now-playing-title">Сейчас играет</div>
            <button 
              className="control-btn" 
              onClick={() => setShowNowPlaying(false)}
              title="Скрыть"
            >
              ✕
            </button>
          </div>
          <div className="player-visual">
            <div className="player-cover">
              {currentTrack.cover ? (
                <img 
                  src={`${BASE_URL}${currentTrack.cover}`} 
                  alt="" 
                />
              ) : (
                <div className="player-cover-placeholder">🎵</div>
              )}
            </div>
            <div className="player-controls-main">
              <div className="track-info-large">
                <div className="track-title-large">{currentTrack.originalName}</div>
                <div className="track-artist-large">
                  {currentTrack.author}
                  {currentTrack.authorRole && <VerifyBadge role={currentTrack.authorRole} size="sm" />}
                </div>
              </div>
              <div className="player-progress">
                <span className="time-display">{formatTime(currentTime)}</span>
                <div 
                  className="progress-bar-container" 
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    seekTo(percent * duration);
                  }}
                >
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                </div>
                <span className="time-display">{formatTime(duration)}</span>
              </div>
              <div className="player-buttons">
                {currentPlaylist && (
                  <button 
                    className="control-btn" 
                    onClick={playPrevious}
                    disabled={currentTrackIndex <= 0}
                    title="Предыдущий"
                  >
                    ⏮
                  </button>
                )}
                <button className="control-btn play-btn" onClick={togglePlay}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                {currentPlaylist && (
                  <button 
                    className="control-btn" 
                    onClick={playNext}
                    disabled={currentTrackIndex >= currentPlaylist.length - 1}
                    title="Следующий"
                  >
                    ⏭
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>🔊</span>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
                    style={{ width: '80px' }}
                  />
                </div>
                <button className="control-btn" onClick={stop} title="Остановить">
                  ⏹
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="music-tabs">
        <button className={`music-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          Все треки ({tracks.length})
        </button>
        <button className={`music-tab ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => setActiveTab('favorites')}>
          ♥ Избранное {favorites.length > 0 && <span className="music-tab-count">{favorites.length}</span>}
        </button>
        <button className={`music-tab ${activeTab === 'playlists' ? 'active' : ''}`} onClick={() => { setActiveTab('playlists'); setShowPlaylistModal(true); }} style={{display: 'none'}}>
          📋 Плейлисты ({playlists.length})
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <div className="loading-text">Загрузка музыки...</div>
        </div>
      ) : (
        <>
          {/* Playlists View */}
          {activeTab === 'playlists' && !viewedPlaylistId && (
            <div className="playlist-grid">
              {/* Create Playlist Card */}
              <div 
                className="playlist-card" 
                onClick={() => setEditingPlaylist({})}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>Плейлист</div>
                  <div style={{ fontWeight: 600 }}>Создать плейлист</div>
                </div>
              </div>
              
              {playlists.map((pl, index) => (
                <div key={pl.id} className="playlist-card" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="playlist-card-image">
                    {pl.cover ? (
                      <img src={`${BASE_URL}${pl.cover}`} alt="" />
                    ) : (
                      <div className="playlist-card-placeholder">Обложка</div>
                    )}
                    <div className="playlist-card-overlay">
                <button 
                      className="playlist-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewedPlaylistId(pl.id);
                        setActiveTab('all');
                      }}
                  >
                    Играть
                  </button>
                    </div>
                  </div>
                  <div className="playlist-card-info">
                    <div className="playlist-card-title">{pl.name}</div>
                    <div className="playlist-card-meta">
                      {pl.tracks?.length || 0} треков • {pl.author}
                    </div>
                  </div>
                    <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                    <button 
                      className="control-btn" 
                      onClick={(e) => { e.stopPropagation(); setEditingPlaylist(pl); }}
                      style={{ width: '32px', height: '32px' }}
                    >
                      Р
                    </button>
                    <button 
                      className="control-btn" 
                      onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(pl.id); }}
                      style={{ width: '32px', height: '32px' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Back button when viewing playlist */}
          {viewedPlaylistId && (
            <div style={{ marginBottom: '20px' }}>
              <button 
                className="music-btn music-btn-secondary" 
                onClick={() => setViewedPlaylistId(null)}
              >
                ← Назад к плейлистам
              </button>
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '16px' }}>
                {playlists.find(p => p.id === viewedPlaylistId)?.name || 'Плейлист'}
              </h2>
            </div>
          )}

          {/* Empty State */}
          {filteredTracks.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-icon">Нет музыки</div>
              <div className="empty-title">
                {searchQuery ? 'Ничего не найдено' : activeTab === 'favorites' ? 'Нет избранных треков' : 'Музыка пока не загружена'}
              </div>
              <div className="empty-subtitle">
                {searchQuery ? 'Попробуйте изменить запрос поиска' : 'Загрузите свой первый трек, чтобы начать!'}
              </div>
              {!searchQuery && (
                <div style={{ marginTop: '20px' }}>
                  <button className="music-btn" onClick={() => fileInputRef.current?.click()}>
                    ➕ Загрузить трек
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Track List */}
          {filteredTracks.length > 0 && (
            <div className="track-list-container">
              <div className="track-list">
                {filteredTracks.map((track, index) => (
                  <div 
                    key={track.id} 
                    className={`track-item ${currentTrack?.id === track.id ? 'playing' : ''}`}
                    onClick={() => handlePlayTrack(track)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="track-number">
                      {currentTrack?.id === track.id ? (isPlaying ? '⏸' : '▶') : index + 1}
                    </div>
                    <div className="track-info">
                      <div className="track-title">{track.originalName}</div>
                      <div className="track-meta">
                        {track.author}
                        {track.authorRole && <VerifyBadge role={track.authorRole} size="sm" style={{ marginLeft: '5px' }} />}
                        {track.duration > 0 && <span style={{ marginLeft: '8px' }}>{formatTime(track.duration)}</span>}
                      </div>
                    </div>
                    <div className="track-duration">
                      {formatTime(track.duration)}
                    </div>
                    <div className="track-actions">
                      <button 
                        className={`track-action-btn favorite ${isFavorite(track.id) ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
                        title={isFavorite(track.id) ? 'Убрать из избранного' : 'В избранное'}
                      >
                        {isFavorite(track.id) ? 'ВЫ' : 'В+'}
                      </button>
                      {(track.authorId === currentUserId || currentUser?.role === 'admin' || currentUser?.role === 'owner') && (
                        <>
                          <button 
                            className="track-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleUploadCover(track.id); }}
                            title="Загрузить обложку"
                          >
                            О
                          </button>
                          <button 
                            className="track-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleDelete(track.id); }}
                            title="Удалить"
                          >
                            Х
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Playlist Modal */}
      {showPlaylistModal && (
        <div className="playlist-modal" onClick={(e) => { if (e.target === e.currentTarget) { setShowPlaylistModal(false); setEditingPlaylist(null); } }}>
          <div className="playlist-modal-content">
            <div className="playlist-header">
              <h2>{editingPlaylist ? 'Редактировать плейлист' : 'Мои плейлисты'}</h2>
              <button className="control-btn" onClick={() => { setShowPlaylistModal(false); setEditingPlaylist(null); }}>✕</button>
            </div>

            {!editingPlaylist && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
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

            {addTrackToPlaylistId && (
              <div style={{ padding: '20px', borderTop: '1px solid var(--glass-border)' }}>
                <h3>Добавить трек в плейлист</h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <input
                    type="text"
                    placeholder="Введите ID трека"
                    value={addTrackIdInput}
                    onChange={(e) => setAddTrackIdInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                  <button 
                    className="music-btn"
                    onClick={confirmAddTrack}
                    disabled={!addTrackIdInput.trim()}
                  >
                    Добавить
                  </button>
                  <button 
                    className="music-btn music-btn-secondary"
                    onClick={() => { setAddTrackToPlaylistId(null); setAddTrackIdInput(''); }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Music;
