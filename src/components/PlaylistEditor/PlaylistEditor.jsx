import { useState, useRef } from 'react';
import './PlaylistEditor.css';

const PlaylistEditor = ({ playlist, onSave, onCancel, onDelete }) => {
  const [name, setName] = useState(playlist?.name || '');
  const [coverPreview, setCoverPreview] = useState(playlist?.cover || null);
  const fileInputRef = useRef(null);

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Введите название плейлиста!');
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (playlist?.id && !file && !playlist.cover) {
      // Updating without new cover
      onSave({ id: playlist.id, name });
    } else {
      onSave({ 
        ...(playlist?.id && { id: playlist.id }),
        name,
        cover: file
      });
    }
  };

  const handleDelete = () => {
    if (playlist?.id && confirm('Удалить этот плейлист?')) {
      onDelete(playlist.id);
    }
  };

  return (
    <div className="playlist-editor">
      <div className="form-group">
        <label>Название плейлиста</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Мой плейлист"
        />
      </div>

      <div className="form-group">
        <label>Обложка</label>
        <div className="cover-upload" onClick={() => fileInputRef.current?.click()}>
          {coverPreview ? (
            <img src={coverPreview} alt="cover" />
          ) : (
            <div className="cover-placeholder">🖼️<br/>Нажмите для загрузки</div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            hidden
          />
        </div>
      </div>

      <div className="editor-actions">
        <button className="music-btn" onClick={handleSave}>
          {playlist?.id ? 'Сохранить' : 'Создать'}
        </button>
        <button className="music-btn music-btn-secondary" onClick={onCancel}>
          Отмена
        </button>
        {playlist?.id && (
          <button className="music-btn music-btn-danger" onClick={handleDelete}>
            Удалить
          </button>
        )}
      </div>
    </div>
  );
};

export default PlaylistEditor;