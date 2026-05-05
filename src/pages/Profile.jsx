import { useState, useRef, useEffect } from 'react';
import { updateUser, setStatus, isAdmin, getActiveUser } from '../utils/auth';
import { getApiUrl } from '../config';
import VerifyBadge from '../components/VerifyBadge/VerifyBadge';
import './Profile.css';

const statusOptions = [
  { value: 'online', label: 'В сети', color: '#00ff88' },
  { value: 'idle', label: 'Неактивен', color: '#ffaa00' },
  { value: 'do_not_disturb', label: 'Не беспокоить', color: '#ff4466' },
  { value: 'offline', label: 'Не в сети', color: '#888888' },
];

const Profile = ({ profile, onUpdate, onLogout }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const statusRef = useRef(null);
  const [mcVersionsCount, setMcVersionsCount] = useState(0);
  const [formData, setFormData] = useState({
    nickname: profile.nickname,
    bio: profile.bio,
    avatar: profile.avatar,
    banner: profile.banner,
  });


  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showStatusPicker) {
        const isInside = statusRef.current && statusRef.current.contains(e.target);
        const isDropdown = e.target.closest('.status-dropdown-portal');
        if (!isInside && !isDropdown) {
          setShowStatusPicker(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusPicker]);

  useEffect(() => {
    loadMcVersions();
  }, []);

  const loadMcVersions = async () => {
    try {
      const versions = await window.electron.getMinecraftVersions();
      setMcVersionsCount(versions.length);
    } catch (e) {}
  };

  useEffect(() => {
    if (showStatusPicker && statusRef.current) {
      const rect = statusRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [showStatusPicker]);

  const handleSave = async () => {
    setSaving(true);
    await updateUser(formData);
    onUpdate(formData);
    setSaving(false);
    setEditing(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const newData = { ...formData, avatar: reader.result };
        setFormData(newData);
        await updateUser({ avatar: reader.result });
        onUpdate(newData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const newData = { ...formData, banner: reader.result };
        setFormData(newData);
        await updateUser({ banner: reader.result });
        onUpdate(newData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await setStatus(newStatus);
      setShowStatusPicker(false);
      const freshUser = await fetch(`${getApiUrl()}/users/${profile.id}`).then(r => r.json());
      onUpdate(freshUser);
    } catch (err) {
      console.error('Status change error:', err);
    }
  };

  const currentStatus = statusOptions.find(s => s.value === profile.status) || statusOptions[3];

  return (
    <div className="profile-page fade-in">
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        style={{ display: 'none' }}
        onChange={handleAvatarChange}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/gif"
        style={{ display: 'none' }}
        onChange={handleBannerChange}
      />

      <div className="profile-header glass">
        <div className="profile-banner-container">
          {profile.banner ? (
            <img className="profile-banner" src={profile.banner} alt="banner" />
          ) : (
            <div className="profile-banner" />
          )}
          <div className="profile-overlay">
            <div className="profile-avatar-large" onClick={() => avatarInputRef.current?.click()} style={{ cursor: 'pointer' }} title="Изменить аватар">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.nickname} />
              ) : (
                <div className="avatar-large-placeholder">
                  {profile.nickname.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="avatar-edit-overlay">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            </div>
            <div className="profile-info-main">
              {editing ? (
                <input
                  className="nickname-input"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                />
              ) : (
                <div className="profile-title-row">
                  <h1 className="nickname">{profile.nickname}</h1>
                  <VerifyBadge role={profile.role} size="md" />
                </div>
              )}
              {isAdmin() && <div className="profile-id">ID: {profile.id}</div>}
              <div ref={statusRef} className="status-selector-container" onClick={() => setShowStatusPicker(!showStatusPicker)}>
                <span className="status-dot" style={{ background: currentStatus.color }} />
                <span className={`status-badge ${profile.status}`}>
                  {currentStatus.label}
                </span>
                <svg className="status-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>
          <button className="banner-edit-btn" onClick={() => bannerInputRef.current?.click()} title="Изменить баннер">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </div>

      {showStatusPicker && (
        <div
          className="status-dropdown-portal"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              className={`status-option ${profile.status === opt.value ? 'active' : ''}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => handleStatusChange(opt.value)}
            >
              <span className="status-option-dot" style={{ background: opt.color }} />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="profile-stats glass fade-in fade-in-delay-1">
        <h2 className="section-title">Статистика</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{(profile.games_played || 0) + mcVersionsCount}</div>
            <div className="stat-label">Игр</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{profile.hours_played || 0}</div>
            <div className="stat-label">Часов</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{(profile.friends || []).length}</div>
            <div className="stat-label">Друнов</div>
          </div>
        </div>
      </div>

      <div className="profile-bio glass fade-in fade-in-delay-2">
        <div className="bio-header">
          <h2 className="section-title">О себе</h2>
          <button
            className="edit-btn"
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
          >
            {saving ? 'Сохранение...' : editing ? 'Сохранить' : 'Редактировать'}
          </button>
        </div>
        {editing ? (
          <textarea
            className="bio-input"
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={3}
          />
        ) : (
          <p className="bio-text">{profile.bio}</p>
        )}
      </div>

      <div className="profile-settings glass fade-in fade-in-delay-3">
        <h2 className="section-title">Аккаунт</h2>
        <div className="settings-actions">
          <button className="logout-btn" onClick={onLogout}>
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
