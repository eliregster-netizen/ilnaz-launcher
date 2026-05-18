import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../../config';
import { getActiveUser } from '../../utils/auth';
import winlogo from '../../../public/winlogo.png';
import linuxlogo from '../../../public/linux.png';
import macoslogo from '../../../public/macos.png';
import './Catalog.css';

const Catalog = () => {
  const [games, setGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOS, setSelectedOS] = useState('all');
  const [downloadProgress, setDownloadProgress] = useState({});

  // Загрузка каталога
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        let data;
        
        // В Electron используем IPC для чтения файла
        const isElectron = !!window.electron;
        
        if (isElectron && window.electron.getCatalogJson) {
          // В Electron читаем через main process
          const result = await window.electron.getCatalogJson();
          if (result.success) {
            data = { games: result.games };
          } else {
            throw new Error(result.error || 'Failed to load catalog');
          }
        } else if (isElectron) {
          // Fallback для Electron - fetch из папки dist
          try {
            const res = await fetch('./catalog.json');
            if (!res.ok) throw new Error(`Failed: ${res.status}`);
            data = await res.json();
          } catch (e) {
            // Пробуем через IPC если есть
            console.error('[Catalog] Fetch failed, no IPC method:', e.message);
            throw e;
          }
        } else {
          // В веб-версии пробуем API
          try {
            const res = await fetch(`${getApiUrl()}/catalog`);
            data = await res.json();
          } catch {
            // Fallback to static JSON
            const res = await fetch('/catalog.json');
            data = await res.json();
          }
        }
        
        setGames(data.games || []);
        setFilteredGames(data.games || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  // Фильтрация по ОС и поиску
  useEffect(() => {
    let filtered = games;
    if (selectedOS !== 'all') {
      filtered = filtered.filter(game => game.sources && game.sources[selectedOS]);
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter(game => 
        game.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredGames(filtered);
  }, [games, selectedOS, searchQuery]);

  // Подписка на прогресс загрузки
  useEffect(() => {
    const unsub = window.electron.onCatalogDownloadProgress((data) => {
      setDownloadProgress(prev => ({
        ...prev,
        [data.gameId]: {
          percent: data.percent,
          stage: data.stage,
          downloaded: data.downloaded,
          total: data.total
        }
      }));
    });
    return unsub;
  }, []);

  const handleDownload = async (game) => {
    const os = navigator.platform.includes('Win') ? 'windows' : 
                navigator.platform.includes('Linux') ? 'linux' : 'macos';
    if (!game.sources?.[os]) {
      alert(`Игра недоступна для ${os}`);
      return;
    }
    try {
      await window.electron.downloadCatalogGame(game.id, os);
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  if (loading) return <div className="catalog-page"><div className="catalog-loading">Загрузка каталога...</div></div>;
  if (error) return <div className="catalog-page"><div className="catalog-error">Ошибка: {error}</div></div>;

  const user = getActiveUser();
  
  return (
    <div className="catalog-page">
      {/* Заголовок */}
      <div className="catalog-header">
        <h2>Каталог игр</h2>
        {user?.role === 'owner' && (
          <button className="manage-btn" onClick={() => window.location.href = '#/catalog/manager'}>
            ⚙️ Управление
          </button>
        )}
        <div className="catalog-controls">
          {/* Поиск */}
          <input 
            type="text" 
            placeholder="Поиск игр..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="catalog-search"
          />
          {/* Фильтры ОС */}
          <div className="os-filters">
            <button 
              className={`os-filter-btn ${selectedOS === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedOS('all')}
            >
              Все
            </button>
            <button 
              className={`os-filter-btn ${selectedOS === 'windows' ? 'active' : ''}`}
              onClick={() => setSelectedOS('windows')}
            >
              <img src={winlogo} alt="Windows" className="os-filter-logo" /> Windows
            </button>
            <button 
              className={`os-filter-btn ${selectedOS === 'linux' ? 'active' : ''}`}
              onClick={() => setSelectedOS('linux')}
            >
              <img src={linuxlogo} alt="Linux" className="os-filter-logo" /> Linux
            </button>
            <button 
              className={`os-filter-btn ${selectedOS === 'macos' ? 'active' : ''}`}
              onClick={() => setSelectedOS('macos')}
            >
              <img src={macoslogo} alt="macOS" className="os-filter-logo" /> macOS
            </button>
          </div>
        </div>
      </div>

      {/* Сетка игр */}
      <div className="catalog-grid">
        {filteredGames.map(game => {
          const progress = downloadProgress[game.id];
          const isDownloading = !!progress;
          
          return (
            <div key={game.id} className="catalog-card">
              {/* Обложка */}
              <div className="catalog-card-cover">
                <img src={game.cover} alt={game.name} />
                {isDownloading && (
                  <div className="catalog-download-overlay">
                    <div className="catalog-progress-bar">
                      <div 
                        className="catalog-progress-fill" 
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <div className="catalog-progress-text">
                      {Math.round(progress.percent)}% ({formatSize(progress.downloaded)} / {formatSize(progress.total)})
                    </div>
                  </div>
                )}
              </div>
              
              {/* Информация */}
              <div className="catalog-card-info">
                <h3 className="catalog-card-title">{game.name}</h3>
                <p className="catalog-card-genre">{game.genre}</p>
                <p className="catalog-card-desc">{game.description}</p>
                <div className="catalog-card-os">
                  {game.sources?.windows && <img src={winlogo} title="Windows" alt="Windows" className="os-logo" />}
                  {game.sources?.linux && <img src={linuxlogo} title="Linux" alt="Linux" className="os-logo" />}
                  {game.sources?.macos && <img src={macoslogo} title="macOS" alt="macOS" className="os-logo" />}
                </div>
              </div>
              
              {/* Кнопка загрузки или статус */}
              <div className="catalog-card-action">
                {isDownloading ? (
                  <div className="catalog-downloading">
                    <span>{progress.stage}</span>
                    <button onClick={() => window.electron.cancelCatalogDownload(game.id)}>
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button 
                    className="catalog-download-btn"
                    onClick={() => handleDownload(game)}
                    title="Скачать игру"
                  >
                    ↓ Скачать
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Catalog;
