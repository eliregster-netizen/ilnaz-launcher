import { useState, useRef, useEffect } from 'react';
import { editConversation } from '../../utils/chat';
import { getActiveUser, getFriendsList } from '../../utils/auth';
import { getApiUrl } from '../../config';

const EditGroupModal = ({ conversation, onClose, onUpdated }) => {
  const [name, setName] = useState(conversation.name || '');
  const [description, setDescription] = useState(conversation.description || '');
  const [iconPreview, setIconPreview] = useState(conversation.icon);
  const [iconData, setIconData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' or 'members'
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const list = await getFriendsList();
    const existingIds = new Set((conversation.members || []).map(m => m.id));
    setFriends(list.filter(f => !existingIds.has(f.id)));
  };

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

  const toggleSelectFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) return;
    setLoading(true);
    const user = getActiveUser();
    const res = await fetch(`${getApiUrl()}/chat/conversations/${conversation.id}/add-members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newMemberIds: selectedFriends }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      if (onUpdated) onUpdated(conversation);
      onClose();
    }
  };

  return (
    <div className="members-modal-overlay" onClick={onClose}>
      <div className="members-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
        <h3>Настройки группы</h3>

        <div className="edit-group-tabs">
          <button className={`edit-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            Настройки
          </button>
          <button className={`edit-tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
            Участники
          </button>
        </div>

        {activeTab === 'settings' && (
          <>
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
          </>
        )}

        {activeTab === 'members' && (
          <>
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Все ваши друзья уже в этой группе
              </div>
            ) : (
              <>
                <div className="add-members-list">
                  {friends.map(friend => (
                    <div
                      className={`add-member-item ${selectedFriends.includes(friend.id) ? 'selected' : ''}`}
                      key={friend.id}
                      onClick={() => toggleSelectFriend(friend.id)}
                    >
                      <div className="add-member-avatar">
                        {friend.avatar ? <img src={friend.avatar} alt="" /> : friend.nickname?.charAt(0)}
                      </div>
                      <span className="add-member-name">{friend.nickname}</span>
                      {selectedFriends.includes(friend.id) && (
                        <span className="add-member-check">✓</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="modal-actions-row" style={{ marginTop: '16px' }}>
                  <button className="modal-cancel-btn" onClick={onClose}>Отмена</button>
                  <button
                    className="modal-create-btn"
                    onClick={handleAddMembers}
                    disabled={selectedFriends.length === 0 || loading}
                  >
                    {loading ? 'Добавление...' : `Добавить (${selectedFriends.length})`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EditGroupModal;
