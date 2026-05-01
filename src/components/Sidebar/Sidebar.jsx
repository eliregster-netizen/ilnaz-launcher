import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import VerifyBadge from '../VerifyBadge/VerifyBadge';
import './Sidebar.css';

const statusLabels = {
  online: 'В сети',
  idle: 'Неактивен',
  do_not_disturb: 'Не беспокоить',
  offline: 'Не в сети',
};

const statusColors = {
  online: '#00ff88',
  idle: '#ffaa00',
  do_not_disturb: '#ff4466',
  offline: '#888888',
};

const Sidebar = ({ profile }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: 'home', label: 'Home' },
    { path: '/library', icon: 'library', label: 'Library' },
    { path: '/friends', icon: 'friends', label: 'Друны' },
    { path: '/chat', icon: 'chat', label: 'Чат' },
    { path: '/profile', icon: 'profile', label: 'Profile' },
  ];

  const adminItems = (profile.role === 'admin' || profile.role === 'owner') ? [
    { path: '/admin', icon: 'admin', label: 'Админка' },
  ] : [];

  const getIcon = (icon) => {
    switch (icon) {
      case 'home':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case 'library':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        );
      case 'friends':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'chat':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      case 'profile':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'admin':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside className="sidebar glass">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logo} className="logo-icon" alt="Logo" />
          <span className="logo-text">ILNAZ</span>
        </div>
        <div className="logo-subtitle">GAMING LAUNCHER</div>
      </div>

      <div className="sidebar-profile">
        <Link to="/profile" className="profile-info">
          <div className="profile-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.nickname} />
            ) : (
              <div className="avatar-placeholder">
                {profile.nickname?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <span className={`status-indicator ${profile.status}`} />
          </div>
          <div className="profile-details">
            <span className="profile-nickname-row">
              <span className="profile-nickname">{profile.nickname}</span>
              <VerifyBadge role={profile.role} size="sm" />
            </span>
            <span className="profile-status-text" style={{ color: statusColors[profile.status] || statusColors.offline }}>
              {statusLabels[profile.status] || 'Не в сети'}
            </span>
          </div>
        </Link>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            {getIcon(item.icon)}
            <span>{item.label}</span>
          </Link>
        ))}
        {adminItems.length > 0 && (
          <>
            <div className="nav-divider" />
            {adminItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item admin-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {getIcon(item.icon)}
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="version">v0.1.0 alpha</div>
      </div>
    </aside>
  );
};

export default Sidebar;
