import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserById, sendFriendRequest, removeFriend, getActiveUser, isAdmin } from '../utils/auth';
import { getApiUrl } from '../config';
import VerifyBadge from '../components/VerifyBadge/VerifyBadge';
import './UserProfile.css';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null);

  const currentUser = getActiveUser();

  useEffect(() => {
    loadUser();
  }, [userId]);

  useEffect(() => {
    if (user && currentUser) {
      checkFriendStatus();
    }
  }, [user, currentUser]);

  const checkFriendStatus = () => {
    if (!user || !currentUser) return;
    const isFriend = (user.friends || []).includes(currentUser.id);
    const isMe = user.id === currentUser.id;
    if (isMe) setFriendStatus('me');
    else if (isFriend) setFriendStatus('friends');
    else setFriendStatus('none');
  };

  const loadUser = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/users/${userId}`);
      if (!res.ok) {
        console.error(`Failed to load user ${userId}: ${res.status} ${res.statusText}`);
        const errorData = await res.json().catch(() => ({}));
        console.error('Error details:', errorData);
        setUser(null);
      } else {
        const userData = await res.json();
        setUser(userData);
      }
    } catch (err) {
      console.error('Error loading user:', err);
      setUser(null);
    }
    setLoading(false);
  };

  const handleSendRequest = async () => {
    setActionLoading(true);
    const result = await sendFriendRequest(userId);
    if (result.success) {
      setFriendStatus('pending');
    }
    setActionLoading(false);
  };

  const handleRemoveFriend = async () => {
    setActionLoading(true);
    await removeFriend(userId);
    setFriendStatus('none');
    setActionLoading(false);
  };

  const isOwnProfile = user && currentUser && user.id === currentUser.id;

  if (loading) {
    return (
      <div className="user-profile-page fade-in">
        <div className="loading-profile">
          <div className="spinner" />
          <span>Загрузка профиля...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-profile-page fade-in">
        <div className="profile-not-found">
          <h2>Пользователь не найден</h2>
          <button className="back-btn" onClick={() => navigate(-1)}>Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-page fade-in">
      <button className="back-btn" onClick={() => navigate(-1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Назад
      </button>

      <div className="profile-header glass">
        <div className="profile-banner-container">
          {user.banner ? (
            <img className="profile-banner" src={user.banner} alt="banner" />
          ) : (
            <div className="profile-banner" />
          )}
          <div className="profile-overlay">
            <div className="profile-avatar-large">
              {user.avatar ? (
                <img src={user.avatar} alt={user.nickname} />
              ) : (
                <div className="avatar-large-placeholder">
                  {user.nickname.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="profile-info-main">
              <div className="profile-title-row">
                <h1 className="nickname">{user.nickname}</h1>
                <VerifyBadge role={user.role} size="md" />
              </div>
              {isAdmin() && <div className="profile-id">ID: {user.id}</div>}
              <div className={`status-badge ${user.status}`}>
                {user.status === 'online' ? 'В сети' : user.status === 'idle' ? 'Неактивен' : user.status === 'do_not_disturb' ? 'Не беспокоить' : 'Не в сети'}
              </div>
            </div>
            {!isOwnProfile && currentUser && (
              <div className="profile-actions">
                {friendStatus === 'friends' && (
                  <button className="action-btn remove-friend" onClick={handleRemoveFriend} disabled={actionLoading}>
                    Удалить из друнов
                  </button>
                )}
                {friendStatus === 'pending' && (
                  <button className="action-btn pending" disabled>
                    Заявка отправлена
                  </button>
                )}
                {friendStatus === 'none' && (
                  <button className="action-btn add-friend" onClick={handleSendRequest} disabled={actionLoading}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    Добавить в друны
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="profile-stats glass fade-in fade-in-delay-1">
        <h2 className="section-title">Статистика</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{user.games_played || 0}</div>
            <div className="stat-label">Игр</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{user.hours_played || 0}</div>
            <div className="stat-label">Часов</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{(user.friends || []).length}</div>
            <div className="stat-label">Друнов</div>
          </div>
        </div>
      </div>

      <div className="profile-bio glass fade-in fade-in-delay-2">
        <h2 className="section-title">О себе</h2>
        <p className="bio-text">{user.bio || 'Пусто'}</p>
      </div>
    </div>
  );
};

export default UserProfile;
