import { useState } from 'react';
import './Friends.css';

const Friends = ({ profile, onUpdate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const addFriend = () => {
    if (!searchQuery.trim()) return;
    
    const newFriend = {
      id: 'friend-' + Date.now(),
      nickname: searchQuery,
      status: 'offline',
      avatar: null,
    };

    const updatedFriends = [...(profile.friends || []), newFriend];
    onUpdate({ friends: updatedFriends });
    setSearchQuery('');
  };

  const removeFriend = (friendId) => {
    const updatedFriends = profile.friends.filter(f => f.id !== friendId);
    onUpdate({ friends: updatedFriends });
  };

  return (
    <div className="friends-page fade-in">
      <div className="friends-header glass">
        <h1 className="page-title">Друны</h1>
        <div className="add-friend-form">
          <input
            className="friend-input"
            placeholder="Введите ID или имя игрока..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addFriend()}
          />
          <button className="add-btn" onClick={addFriend}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Добавить
          </button>
        </div>
      </div>

      <div className="friends-list glass fade-in fade-in-delay-1">
        {profile.friends?.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p>У вас пока нет друнов</p>
            <span className="empty-hint">Добавьте друна по ID или имени</span>
          </div>
        ) : (
          <div className="friends-grid">
            {profile.friends.map((friend, index) => (
              <div className="friend-card glass fade-in" key={friend.id} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="friend-avatar">
                  {friend.avatar ? (
                    <img src={friend.avatar} alt={friend.nickname} />
                  ) : (
                    <div className="friend-avatar-placeholder">
                      {friend.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`friend-status ${friend.status}`} />
                </div>
                <div className="friend-info">
                  <h3 className="friend-name">{friend.nickname}</h3>
                  <span className="friend-status-text">
                    {friend.status === 'online' ? 'В сети' : 'Не в сети'}
                  </span>
                </div>
                <button className="friend-remove" onClick={() => removeFriend(friend.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;
