import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminGetUsers,
  adminDeleteUser,
  adminBanUser,
  adminEditUser,
  adminGetStats,
  isAdmin,
  getActiveUser,
  refreshSession,
} from '../utils/auth';
import VerifyBadge from '../components/VerifyBadge/VerifyBadge';
import './Admin.css';

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      await refreshSession();
      if (!isAdmin()) {
        navigate('/');
        return;
      }
      loadAll();
    })();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [usersData, statsData] = await Promise.all([adminGetUsers(), adminGetStats()]);
    setUsers(usersData);
    setStats(statsData);
    setLoading(false);
  };

  const handleDelete = async (userId) => {
    if (!confirm('Удалить этот аккаунт? Это действие нельзя отменить.')) return;
    await adminDeleteUser(userId);
    loadAll();
  };

  const handleBan = async (userId, currentlyBanned) => {
    await adminBanUser(userId, !currentlyBanned);
    loadAll();
  };

  const handleRoleToggle = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await adminEditUser(userId, { role: newRole });
    loadAll();
  };

  const openEdit = (user) => {
    setEditingUser(user.id);
    setEditForm({
      nickname: user.nickname,
      bio: user.bio,
      games_played: user.games_played || 0,
      hours_played: user.hours_played || 0,
    });
  };

  const saveEdit = async () => {
    await adminEditUser(editingUser, editForm);
    setEditingUser(null);
    loadAll();
  };

  const filteredUsers = users.filter(u => {
    if (search && !u.nickname.toLowerCase().includes(search.toLowerCase()) && !u.username.toLowerCase().includes(search.toLowerCase()) && !u.id.includes(search)) return false;
    if (filter === 'admins' && u.role !== 'admin') return false;
    if (filter === 'banned' && !u.banned) return false;
    if (filter === 'online' && u.status !== 'online') return false;
    return true;
  });

  const currentUser = getActiveUser();

  return (
    <div className="admin-page fade-in">
      <div className="admin-header glass">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="page-title">Админ-панель</h1>
        </div>
        <div className="admin-badge">
          <span className="admin-icon">👑</span>
          {currentUser?.username}
        </div>
      </div>

      {stats && (
        <div className="admin-stats glass fade-in fade-in-delay-1">
          <div className="stat-card">
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Всего пользователей</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.onlineUsers}</div>
            <div className="stat-label">В сети</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalOwners || 0}</div>
            <div className="stat-label">Владельцев</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ff4466' }}>{stats.totalBanned}</div>
            <div className="stat-label">Забанено</div>
          </div>
        </div>
      )}

      <div className="admin-controls glass fade-in fade-in-delay-2">
        <input
          className="admin-search"
          placeholder="Поиск по нику, имени или ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-filters">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Все</button>
          <button className={`filter-btn ${filter === 'online' ? 'active' : ''}`} onClick={() => setFilter('online')}>В сети</button>
          <button className={`filter-btn ${filter === 'admins' ? 'active' : ''}`} onClick={() => setFilter('admins')}>Админы</button>
          <button className={`filter-btn ${filter === 'banned' ? 'active' : ''}`} onClick={() => setFilter('banned')}>Забанены</button>
        </div>
      </div>

      {loading ? (
        <div className="admin-loading">
          <div className="spinner" />
          <span>Загрузка...</span>
        </div>
      ) : (
        <div className="admin-users-list glass fade-in fade-in-delay-3">
          {filteredUsers.length === 0 ? (
            <div className="empty-state"><p>Пользователи не найдены</p></div>
          ) : (
            <div className="users-table">
              <div className="users-header">
                <div className="col col-avatar"></div>
                <div className="col col-name">Пользователь</div>
                <div className="col col-status">Статус</div>
                <div className="col col-role">Роль</div>
                <div className="col col-stats">Статистика</div>
                <div className="col col-actions">Действия</div>
              </div>
              {filteredUsers.map(user => (
                <div className="user-row" key={user.id}>
                  <div className="col col-avatar">
                    <div className="user-avatar-small">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" />
                      ) : (
                        <span>{user.nickname.charAt(0)}</span>
                      )}
                    </div>
                  </div>
                  <div className="col col-name">
                    <div className="user-display-name-row">
                      <span className="user-display-name">{user.nickname}</span>
                      <VerifyBadge role={user.role} size="sm" />
                    </div>
                    <div className="user-username">@{user.username}</div>
                    <div className="user-id">ID: {user.id}</div>
                  </div>
                  <div className="col col-status">
                    <span className={`status-dot-small ${user.status}`} />
                    {user.status === 'online' ? 'В сети' : user.status === 'banned' ? 'Забанен' : 'Не в сети'}
                  </div>
                  <div className="col col-role">
                    {user.role === 'owner' ? (
                      <span className="role-badge owner" title="Владелец">Владелец</span>
                    ) : (
                      <button
                        className={`role-badge ${user.role}`}
                        onClick={() => user.id !== currentUser?.id && handleRoleToggle(user.id, user.role)}
                        disabled={user.id === currentUser?.id}
                      >
                        {user.role === 'admin' ? 'Админ' : 'Пользователь'}
                      </button>
                    )}
                  </div>
                  <div className="col col-stats">
                    <span>{user.games_played || 0} игр</span>
                    <span>{user.hours_played || 0} ч</span>
                  </div>
                  <div className="col col-actions">
                    <button className="action-btn-small edit" onClick={() => openEdit(user)} title="Редактировать">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className={`action-btn-small ${user.banned ? 'unban' : 'ban'}`}
                      onClick={() => handleBan(user.id, user.banned)}
                      title={user.banned ? 'Разбанить' : 'Забанить'}
                    >
                      {user.banned ? '🔓' : '🔒'}
                    </button>
                    <button
                      className="action-btn-small delete"
                      onClick={() => handleDelete(user.id)}
                      title="Удалить"
                      disabled={user.id === currentUser?.id}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editingUser && (
        <div className="edit-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="edit-modal glass" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Редактировать пользователя</h2>
            <div className="modal-form">
              <label>Никнейм</label>
              <input value={editForm.nickname} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })} />
              <label>Био</label>
              <textarea value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} rows={3} />
              <label>Игр</label>
              <input type="number" value={editForm.games_played} onChange={(e) => setEditForm({ ...editForm, games_played: parseInt(e.target.value) || 0 })} />
              <label>Часов</label>
              <input type="number" value={editForm.hours_played} onChange={(e) => setEditForm({ ...editForm, hours_played: parseFloat(e.target.value) || 0 })} />
              <div className="modal-actions">
                <button className="modal-btn cancel" onClick={() => setEditingUser(null)}>Отмена</button>
                <button className="modal-btn save" onClick={saveEdit}>Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
