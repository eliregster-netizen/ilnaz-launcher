import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useTheme } from '../../context/ThemeContext';
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

const Sidebar = ({ profile, onBrowserOpen }) => {
  const location = useLocation();
  const { sidebarLogoSrc, activeTheme } = useTheme();

  const launcherTitle = activeTheme?.launcherTitle || 'ILNAZ GAMING LAUNCHER';
  
  const navItems = [
    { path: '/', icon: 'home', label: 'Home' },
    { path: '/library', icon: 'library', label: 'Библиотека' },
    { path: '/friends', icon: 'friends', label: 'Друзья' },
    { path: '/chat', icon: 'chat', label: 'Чат' },
    { path: '/themes', icon: 'themes', label: 'Темы' },
    { path: '/music', icon: 'music', label: 'Музыка' },
    { path: '/settings', icon: 'settings', label: 'Настройки' },
    { path: '/profile', icon: 'profile', label: 'Профиль' },
    { type: 'browser', icon: 'browser', label: 'Браузер' },
  ];

  const adminItems = (profile?.role === 'admin' || profile?.role === 'owner') ? [
    { path: '/admin', icon: 'admin', label: 'Админка' },
  ] : [];

  const getIcon = (icon) => {
    switch (icon) {
      case 'home':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7" />
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
            <path d="M16 3.13a4 4 0 1 1-2 0" />
          </svg>
        );
      case 'chat':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2L7 17a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      case 'settings':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83l-1.42 1.42a2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 2 2 0 0 1-1-1.73V17a2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.74-1.74 2 2 0 0 1 1.73-1H21a2 2 0 0 1 2 2v.09a2 2 0 0 1-1.73 1" />
          </svg>
        );
      case 'admin':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--warning)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        );
      case 'themes':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        );
      case 'music':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        );
      case 'profile':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'browser':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
          <img src={sidebarLogoSrc || logo} className="logo-icon" alt="Logo" />
          <span className="logo-text">{launcherTitle}</span>
        </div>
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
        {navItems.map((item) => {
          if (item.type === 'browser') {
            return (
              <button
                key="browser"
                className="nav-item"
                onClick={onBrowserOpen}
              >
                {getIcon(item.icon)}
                <span>{item.label}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {getIcon(item.icon)}
              <span>{item.label}</span>
            </Link>
          );
        })}
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
