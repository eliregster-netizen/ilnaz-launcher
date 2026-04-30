import { useState, useEffect } from 'react';
import { getActiveUser, getFriendsList } from '../../utils/auth';
import { createConversation, getConversations } from '../../utils/chat';

const NewChatModal = ({ onClose, onCreate }) => {
  const user = getActiveUser();
  const [chatType, setChatType] = useState('private');
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const list = await getFriendsList();
    setFriends(list);
    setLoading(false);
  };

  const toggleFriend = (friendId) => {
    if (chatType === 'private') {
      setSelectedFriends([friendId]);
    } else {
      setSelectedFriends(prev =>
        prev.includes(friendId) ? prev.filter(f => f !== friendId) : [...prev, friendId]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedFriends.length === 0) return;
    const res = await createConversation(
      user.id,
      chatType,
      chatType === 'group' ? groupName : null,
      selectedFriends
    );
    if (res.success) {
      if (onCreate) onCreate();
      if (onClose) onClose();
    }
  };

  return (
    <div className="new-chat-modal-overlay" onClick={onClose}>
      <div className="new-chat-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новый чат</h2>

        <div className="chat-type-toggle">
          <button
            className={`chat-type-btn ${chatType === 'private' ? 'active' : ''}`}
            onClick={() => { setChatType('private'); setSelectedFriends([]); }}
          >
            Личный
          </button>
          <button
            className={`chat-type-btn ${chatType === 'group' ? 'active' : ''}`}
            onClick={() => setChatType('group')}
          >
            Группа
          </button>
        </div>

        {chatType === 'group' && (
          <input
            className="chat-name-input"
            placeholder="Название группы..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          {chatType === 'private' ? 'Выберите друга:' : 'Выберите участников:'}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Загрузка...</div>
        ) : friends.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            У вас нет друнов
          </div>
        ) : (
          <div className="friend-select-list">
            {friends.map(friend => {
              const isSelected = selectedFriends.includes(friend.id);
              return (
                <div
                  className={`friend-select-item ${isSelected ? 'selected' : ''}`}
                  key={friend.id}
                  onClick={() => toggleFriend(friend.id)}
                >
                  <div className="friend-select-avatar">
                    {friend.avatar ? <img src={friend.avatar} alt="" /> : friend.nickname?.charAt(0).toUpperCase()}
                  </div>
                  <span className="friend-select-name">{friend.nickname}</span>
                  {isSelected && <span className="friend-select-check">✓</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="modal-actions-row">
          <button className="modal-cancel-btn" onClick={onClose}>Отмена</button>
          <button
            className="modal-create-btn"
            onClick={handleCreate}
            disabled={selectedFriends.length === 0 || (chatType === 'group' && !groupName.trim())}
          >
            {chatType === 'group' ? 'Создать' : 'Начать чат'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
