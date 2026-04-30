import { useState, useRef } from 'react';
import { editConversation } from '../../utils/chat';

const EditGroupModal = ({ conversation, onClose, onUpdated }) => {
  const [name, setName] = useState(conversation.name || '');
  const [description, setDescription] = useState(conversation.description || '');
  const [iconPreview, setIconPreview] = useState(conversation.icon);
  const [iconData, setIconData] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой (макс. 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIconPreview(reader.result);
      setIconData(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await editConversation(conversation.id, {
      name: name.trim(),
      description: description.trim() || null,
      icon: iconData !== null ? iconData : undefined,
    });
    setSaving(false);
    if (res.success) {
      if (onUpdated) onUpdated(res.conversation);
      onClose();
    }
  };

  return (
    <div className="members-modal-overlay" onClick={onClose}>
      <div className="members-modal" onClick={(e) => e.stopPropagation()} style={{ width: '380px' }}>
        <h3>Настройки группы</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            className="edit-group-avatar"
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            {iconPreview ? (
              <img src={iconPreview} alt="" />
            ) : (
              <span>{(name || 'G').charAt(0).toUpperCase()}</span>
            )}
            <div className="edit-avatar-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12l6 6z" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Иконка группы</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Нажмите для изменения</div>
          </div>
        </div>

        <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Название</label>
        <input
          className="chat-name-input"
          placeholder="Название группы..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', marginBottom: '12px' }}
        />

        <label style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Описание</label>
        <textarea
          className="chat-name-input"
          placeholder="Описание группы..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ width: '100%', resize: 'none', fontFamily: 'inherit' }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />

        <div className="modal-actions-row" style={{ marginTop: '16px' }}>
          <button className="modal-cancel-btn" onClick={onClose}>Отмена</button>
          <button
            className="modal-create-btn"
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditGroupModal;
