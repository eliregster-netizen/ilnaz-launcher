import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchUsers, sendFriendRequest, getPendingRequests, acceptFriendRequest, declineFriendRequest, removeFriend, getFriendsList, getSentRequests, getActiveUser, cancelFriendRequest } from '../utils/auth';
import VerifyBadge from '../components/VerifyBadge/VerifyBadge';
import './Friends.css';

const Friends = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentUser = getActiveUser();

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadFriends(), loadPendingRequests(), loadSentRequests()]);
    setLoading(false);
  };

  const loadFriends = async () => {
    const list = await getFriendsList();
    setFriends(list);
  };

  const loadPendingRequests = async () => {
    if (!currentUser) return;
    const list = await getPendingRequests();
    setPendingRequests(list);
  };

  const loadSentRequests = async () => {
    if (!currentUser) return;
    const list = await getSentRequests();
    setSentRequests(list);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchUsers(searchQuery);
    setSearchResults(results.filter(r => r.id !== currentUser?.id));
    setSearching(false);
  };

  const handleSendRequest = async (toId) => {
    const res = await sendFriendRequest(toId);
    if (res.success) {
      setSearchResults(prev => prev.filter(r => r.id !== toId));
      loadSentRequests();
    } else {
      alert(res.error || 'Не удалось отправить заявку');
    }
  };

  const handleAccept = async (requestId) => {
    await acceptFriendRequest(requestId);
    loadPendingRequests();
    loadFriends();
  };

  const handleDecline = async (requestId) => {
    await declineFriendRequest(requestId);
    loadPendingRequests();
  };

  const handleRemoveFriend = async (friendId) => {
    await removeFriend(friendId);
    loadFriends();
  };

  const handleCancelRequest = async (requestId) => {
    const res = await cancelFriendRequest(requestId);
    if (res.success) {
      loadSentRequests();
    } else {
      alert(res.error || 'Не удалось отозвать заявку');
    }
  };

  return (
    <div className="friends-page fade-in">
      <div className="friends-header glass">
        <h1 className="page-title">Друны</h1>
        <div className="add-friend-form">
          <input
            className="friend-input"
            placeholder="Поиск по ID или нику..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="search-btn" onClick={handleSearch} disabled={searching}>
            {searching ? 'Поиск...' : 'Поиск'}
          </button>
        </div>
      </div>

      <div className="friends-tabs glass fade-in fade-in-delay-1">
        <button
          className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Друны
          <span className="tab-count">{friends.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'incoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          Входящие
          {pendingRequests.length > 0 && <span className="tab-badge">{pendingRequests.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          Отправленные
          <span className="tab-count">{sentRequests.length}</span>
        </button>
      </div>

      {activeTab === 'incoming' && (
        <div className="requests-section glass fade-in">
          {pendingRequests.length === 0 ? (
            <div className="empty-state">
              <p>Нет входящих заявок</p>
            </div>
          ) : (
            <div className="requests-list">
              {pendingRequests.map(req => (
                <div className="request-card" key={req.id}>
                  <div
                    className="request-avatar"
                    onClick={() => navigate(`/profile/${req.fromId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {req.avatar ? (
                      <img src={req.avatar} alt={req.nickname} />
                    ) : (
                      <div className="request-avatar-placeholder">
                        {req.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={`request-status ${req.status}`} />
                  </div>
                  <div
                    className="request-info"
                    onClick={() => navigate(`/profile/${req.fromId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="friend-name-row">
                      <h3 className="request-name">{req.nickname}</h3>
                      <VerifyBadge role={req.role} size="sm" />
                    </div>
                    <span className="request-id">ID: {req.fromId}</span>
                  </div>
                  <div className="request-actions">
                    <button className="accept-btn" onClick={() => handleAccept(req.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button className="decline-btn" onClick={() => handleDecline(req.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="requests-section glass fade-in">
          {sentRequests.length === 0 ? (
            <div className="empty-state">
              <p>Нет отправленных заявок</p>
            </div>
          ) : (
            <div className="requests-list">
              {sentRequests.map(req => (
                <div className="request-card" key={req.id}>
                  <div
                    className="request-avatar"
                    onClick={() => navigate(`/profile/${req.toId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {req.avatar ? (
                      <img src={req.avatar} alt={req.nickname} />
                    ) : (
                      <div className="request-avatar-placeholder">
                        {req.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div
                    className="request-info"
                    onClick={() => navigate(`/profile/${req.toId}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="friend-name-row">
                      <h3 className="request-name">{req.nickname}</h3>
                      <VerifyBadge role={req.role} size="sm" />
                    </div>
                    <span className="request-id">ID: {req.toId}</span>
                  </div>
                  <div className="request-actions">
                    <span className="pending-label">Ожидание</span>
                    <button className="decline-btn" onClick={() => handleCancelRequest(req.id)} title="Отозвать заявку">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'friends' && (
        <div className="friends-list glass fade-in fade-in-delay-2">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>Загрузка...</span>
            </div>
          ) : friends.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p>У вас пока нет друнов</p>
              <span className="empty-hint">Найдите игрока по ID или нику</span>
            </div>
          ) : (
            <div className="friends-grid">
              {friends.map((friend, index) => (
                <div className="friend-card glass fade-in" key={friend.id} style={{ animationDelay: `${index * 0.05}s` }}>
                  <div
                    className="friend-avatar"
                    onClick={() => navigate(`/profile/${friend.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {friend.avatar ? (
                      <img src={friend.avatar} alt={friend.nickname} />
                    ) : (
                      <div className="friend-avatar-placeholder">
                        {friend.nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={`friend-status ${friend.status}`} />
                  </div>
                  <div
                    className="friend-info"
                    onClick={() => navigate(`/profile/${friend.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="friend-name-row">
                      <h3 className="friend-name">{friend.nickname}</h3>
                      <VerifyBadge role={friend.role} size="sm" />
                    </div>
                    <span className="friend-id">ID: {friend.id}</span>
                    <span className="friend-status-text">
                      {friend.status === 'online' ? 'В сети' : friend.status === 'idle' ? 'Неактивен' : friend.status === 'do_not_disturb' ? 'Не беспокоить' : 'Не в сети'}
                    </span>
                  </div>
                  <button className="friend-remove" onClick={() => handleRemoveFriend(friend.id)}>
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
      )}

      {searchResults.length > 0 && (
        <div className="search-results glass fade-in">
          <h2 className="section-title">Результаты поиска</h2>
          <div className="results-list">
            {searchResults.map(user => (
              <div className="result-card" key={user.id}>
                <div
                  className="result-avatar"
                  onClick={() => navigate(`/profile/${user.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.nickname} />
                  ) : (
                    <div className="result-avatar-placeholder">
                      {user.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`result-status ${user.status}`} />
                </div>
                <div
                  className="result-info"
                  onClick={() => navigate(`/profile/${user.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="friend-name-row">
                    <h3 className="result-name">{user.nickname}</h3>
                    <VerifyBadge role={user.role} size="sm" />
                  </div>
                  <span className="result-id">ID: {user.id}</span>
                </div>
                <button className="add-friend-btn" onClick={() => handleSendRequest(user.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Запрос
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Friends;
