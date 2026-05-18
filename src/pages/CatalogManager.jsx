import { useState, useEffect } from 'react';
import { getActiveUser } from '../utils/auth';
import './CatalogManager.css';

const CatalogManager = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingGame, setEditingGame] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    cover: '',
    sources: { windows: '', linux: '', macos: '' },
    size: 0,
    genre: '',
    developer: ''
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const user = getActiveUser();
    if (!user || user.role !== 'owner') {
      navigate('/catalog');
      return;
    }
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      if (window.electron?.getCatalogJson) {
        const result = await window.electron.getCatalogJson();
        if (result.success) {
          setGames(result.games || []);
        }
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('sources.')) {
      const os = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        sources: { ...prev.sources, [os]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing && editingGame) {
        const result = await window.electron.updateCatalogGame(editingGame.id, formData);
        if (result.success) {
          alert('Игра обновлена!');
          resetForm();
          loadCatalog();
        }
      } else {
        const result = await window.electron.addCatalogGame(formData);
        if (result.success) {
          alert('Игра добавлена!');
          resetForm();
          loadCatalog();
        } else {
          alert('Ошибка: ' + result.error);
        }
      }
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  };

  const handleEdit = (game) => {
    setFormData({
      id: game.id,
      name: game.name,
      description: game.description || '',
      cover: game.cover || '',
      sources: { 
        windows: game.sources?.windows || '', 
        linux: game.sources?.linux || '', 
        macos: game.sources?.macos || '' 
      },
      size: game.size || 0,
      genre: game.genre || '',
      developer: game.developer || ''
    });
    setEditingGame(game);
    setIsEditing(true);
  };

  const handleDelete = async (gameId) => {
    if (!confirm('Удалить игру?')) return;
    try {
      const result = await window.electron.deleteCatalogGame(gameId);
      if (result.success) {
        alert('Игра удалена!');
        loadCatalog();
      }
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      description: '',
      cover: '',
      sources: { windows: '', linux: '', macos: '' },
      size: 0,
      genre: '',
      developer: ''
    });
    setEditingGame(null);
    setIsEditing(false);
  };

  if (loading) return <div className="catalog-manager"><div className="loading">Загрузка...</div></div>;

  return (
    <div className="catalog-manager">
      <div className="manager-header">
        <h2>Управление каталогом</h2>
        <button className="back-btn" onClick={() => window.location.href = '#/catalog'}>
          ← Назад к каталогу
        </button>
      </div>

      {/* Form */}
      <form className="game-form glass" onSubmit={handleSubmit}>
        <h3>{isEditing ? 'Редактировать игру' : 'Добавить игру'}</h3>
        
        <div className="form-row">
          <label>ID (уникальный):</label>
          <input 
            name="id" 
            value={formData.id} 
            onChange={handleInputChange}
            required
            disabled={isEditing}
          />
        </div>

        <div className="form-row">
          <label>Название:</label>
          <input 
            name="name" 
            value={formData.name} 
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-row">
          <label>Описание:</label>
          <textarea 
            name="description" 
            value={formData.description} 
            onChange={handleInputChange}
            rows="3"
          />
        </div>

        <div className="form-row">
          <label>Обложка (URL):</label>
          <input 
            name="cover" 
            value={formData.cover} 
            onChange={handleInputChange}
            placeholder="https://..."
          />
        </div>

        <div className="form-row">
          <label>Размер (байты):</label>
          <input 
            name="size" 
            type="number"
            value={formData.size} 
            onChange={handleInputChange}
          />
        </div>

        <div className="form-row">
          <label>Жанр:</label>
          <input 
            name="genre" 
            value={formData.genre} 
            onChange={handleInputChange}
          />
        </div>

        <div className="form-row">
          <label>Разработчик:</label>
          <input 
            name="developer" 
            value={formData.developer} 
            onChange={handleInputChange}
          />
        </div>

        <div className="form-section">
          <h4>Ссылки на загрузку:</h4>
          <div className="form-row">
            <label>Windows:</label>
            <input 
              name="sources.windows" 
              value={formData.sources.windows} 
              onChange={handleInputChange}
              placeholder="https://..."
            />
          </div>
          <div className="form-row">
            <label>Linux:</label>
            <input 
              name="sources.linux" 
              value={formData.sources.linux} 
              onChange={handleInputChange}
              placeholder="https://..."
            />
          </div>
          <div className="form-row">
            <label>macOS:</label>
            <input 
              name="sources.macos" 
              value={formData.sources.macos} 
              onChange={handleInputChange}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-btn">
            {isEditing ? 'Сохранить' : 'Добавить'}
          </button>
          {isEditing && (
            <button type="button" className="cancel-btn" onClick={resetForm}>
              Отмена
            </button>
          )}
        </div>
      </form>

      {/* Games List */}
      <div className="games-list">
        <h3>Список игр ({games.length})</h3>
        <div className="games-table">
          <div className="table-header">
            <span>Название</span>
            <span>Жанр</span>
            <span>Разработчик</span>
            <span>Действия</span>
          </div>
          {games.map(game => (
            <div key={game.id} className="table-row">
              <span className="game-name">{game.name}</span>
              <span>{game.genre}</span>
              <span>{game.developer}</span>
              <span className="actions">
                <button className="edit-btn" onClick={() => handleEdit(game)}>
                  ✏️
                </button>
                <button className="delete-btn" onClick={() => handleDelete(game.id)}>
                  🗑️
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CatalogManager;
