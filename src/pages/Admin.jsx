import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  adminGetUsers, adminDeleteUser, adminBanUser, adminEditUser,
  adminGetStats, isAdmin, getActiveUser, refreshSession,
} from '../utils/auth';
import { fetchPendingGames, approveGame, rejectGame } from '../utils/hubApi';
import VerifyBadge from '../components/VerifyBadge/VerifyBadge';
import './Admin.css';

const Admin = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'users');

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [pendingGames, setPendingGames] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

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

  useEffect(() => {
    if (tab === 'hub') loadPending();
  }, [tab]);

  const loadAll = async () => {
    setLoading(true);
    const [usersData, statsData] = await Promise.all([adminGetUsers(), adminGetStats()]);
    setUsers(usersData);
    setStats(statsData);
    setLoading(false);
  };

  const loadPending = async () => {
    setPendingLoading(true);
    const data = await fetchPendingGames();
    if (Array.isArray(data)) setPendingGames(data);
    setPendingLoading(false);
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    setSearchParams(newTab === 'hub' ? { tab: 'hub' } : {});
  };

  const handleDelete = async (userId) => {
    if (!confirm('Удалить этот аккаунт?')) return;
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
      nickname: user.nickname, bio: user.bio,
      games_played: user.games_played || 0, hours_played: user.hours_played || 0,
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
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ color: 'var(--warning)' }}><path d="M2 19h20v3H2v-3zM3.3 5.5l4.7 3.5L12 2l4 7 4.7-3.5L19 16H5L3.3 5.5z"/></svg>
          {currentUser?.username}
        </div>
      </div>

      <div className="admin-tabs glass">
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => switchTab('users')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Пользователи
        </button>
        <button className={`admin-tab ${tab === 'hub' ? 'active' : ''}`} onClick={() => switchTab('hub')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/><path d="M7 18v2M17 18v2"/></svg>
          Game Hub {pendingGames.length > 0 && <span className="pending-badge">{pendingGames.length}</span>}
        </button>
      </div>

      {tab === 'users' && (
        <>
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
            <input className="admin-search" placeholder="Поиск по нику, имени или ID..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="admin-filters">
              <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Все</button>
              <button className={`filter-btn ${filter === 'online' ? 'active' : ''}`} onClick={() => setFilter('online')}>В сети</button>
              <button className={`filter-btn ${filter === 'admins' ? 'active' : ''}`} onClick={() => setFilter('admins')}>Админы</button>
              <button className={`filter-btn ${filter === 'banned' ? 'active' : ''}`} onClick={() => setFilter('banned')}>Забанены</button>
            </div>
          </div>

          {loading ? (
            <div className="admin-loading"><div className="spinner" /><span>Загрузка...</span></div>
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
                          {user.avatar ? <img src={user.avatar} alt="" /> : <span>{user.nickname.charAt(0)}</span>}
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
                          <span className="role-badge owner">Владелец</span>
                        ) : (
                          <button className={`role-badge ${user.role}`}
                            onClick={() => user.id !== currentUser?.id && handleRoleToggle(user.id, user.role)}
                            disabled={user.id === currentUser?.id}>
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
                        <button className={`action-btn-small ${user.banned ? 'unban' : 'ban'}`}
                          onClick={() => handleBan(user.id, user.banned)}
                          title={user.banned ? 'Разбанить' : 'Забанить'}>
                          {user.banned ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>
                          )}
                        </button>
                        <button className="action-btn-small delete"
                          onClick={() => handleDelete(user.id)} title="Удалить"
                          disabled={user.id === currentUser?.id}>
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
        </>
      )}

      {tab === 'hub' && (
        <div className="admin-hub glass fade-in">
          <h2 className="admin-hub-title">Игры на проверке</h2>
          {pendingLoading ? (
            <div className="admin-loading"><div className="spinner" /><span>Загрузка...</span></div>
          ) : pendingGames.length === 0 ? (
            <div className="empty-state"><p>Нет игр на проверке</p></div>
          ) : (
            <div className="pending-games-list">
              {pendingGames.map(game => (
                <div key={game.id} className="pending-game-card">
                  <div className="pending-game-cover">
                    {game.coverUrl ? <img src={game.coverUrl} alt="" /> : (
                      <div className="no-cover">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="pending-game-info">
                    <div className="pending-game-title">{game.title}</div>
                    <div className="pending-game-dev">от {game.developerName}</div>
                    <div className="pending-game-meta">
                      <span>Жанр: {game.genre}</span>
                      <span>Создана: {new Date(game.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="pending-game-links">
                      {game.webUrl && <a href={game.webUrl} target="_blank" rel="noreferrer">🌐 Веб-версия</a>}
                      {game.downloadUrl && <a href={game.downloadUrl} target="_blank" rel="noreferrer">⬇ Скачать</a>}
                    </div>
                    <div className="pending-game-actions">
                      <button className="hub-btn primary small" onClick={async () => { await approveGame(game.id); loadPending(); }}>
                        Одобрить
                      </button>
                      <button className="hub-btn outline small" onClick={async () => { await rejectGame(game.id); loadPending(); }} style={{ color: 'var(--danger)' }}>
                        Отклонить
                      </button>
                    </div>
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
