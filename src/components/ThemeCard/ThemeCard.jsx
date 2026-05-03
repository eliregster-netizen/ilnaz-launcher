import './ThemeCard.css';

const ThemeCard = ({ theme, isActive, onSelect, onEdit, onDelete, onExport, onPublish, isPublishing }) => {
  const c = theme.colors || {};
  const bg = theme.background || {};

  const isBgImage = bg.type === 'image' && bg.value;
  const isGradient = bg.type === 'gradient' && bg.value;

  const cardBgStyle = isBgImage
    ? {
        backgroundImage: `url(${bg.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : isGradient
      ? { background: bg.value }
      : bg.type === 'solid'
        ? { backgroundColor: c.bgPrimary || '#0a0a1a' }
        : { background: `linear-gradient(135deg, ${c.bgSecondary || '#12122e'}, ${c.bgTertiary || '#1a1a3e'})` };

  const accentStyle = {
    background: `linear-gradient(135deg, ${c.accentPrimary || '#7b2ff7'}, ${c.accentSecondary || '#00d4ff'})`,
  };

  return (
    <div
      className={`theme-card ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(theme.id)}
    >
      <div className="theme-preview" style={cardBgStyle}>
        {isBgImage && <div className="theme-preview-blur" style={{ backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        <div className="theme-preview-overlay" />

        <div className="theme-preview-bar" style={accentStyle} />
        <div className="theme-preview-sidebar" style={{ background: c.glassBg || 'rgba(255,255,255,0.05)' }}>
          <div className="theme-preview-dot" style={{ background: c.accentPrimary || '#7b2ff7' }} />
          <div className="theme-preview-line" style={{ background: c.textPrimary || '#fff', width: '70%', opacity: 0.6 }} />
          <div className="theme-preview-line" style={{ background: c.textPrimary || '#fff', width: '50%', opacity: 0.4 }} />
        </div>
        <div className="theme-preview-content">
          <div className="theme-preview-block" style={{ background: c.glassBg || 'rgba(255,255,255,0.05)', border: `1px solid ${c.glassBorder || 'rgba(255,255,255,0.1)'}` }}>
            <div className="theme-preview-line" style={{ background: accentStyle.background, width: '40%' }} />
            <div className="theme-preview-line" style={{ background: c.textPrimary || '#fff', width: '80%', opacity: 0.3 }} />
          </div>
          <div className="theme-preview-block" style={{ background: c.glassBg || 'rgba(255,255,255,0.05)', border: `1px solid ${c.glassBorder || 'rgba(255,255,255,0.1)'}` }}>
            <div className="theme-preview-line" style={{ background: c.textPrimary || '#fff', width: '60%', opacity: 0.5 }} />
          </div>
        </div>
      </div>

      {isActive && (
        <div className="theme-active-badge" style={accentStyle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Активна
        </div>
      )}

      <div className="theme-info">
        <div className="theme-name-row">
          <h4 className="theme-name">{theme.name}</h4>
          {theme.isBuiltIn && <span className="theme-built-in-tag">Built-in</span>}
        </div>
        {theme.author && <p className="theme-author">by {theme.author}</p>}
        {theme.description && <p className="theme-desc">{theme.description}</p>}
        <div className="theme-color-dots">
          <span style={{ background: c.accentPrimary || '#7b2ff7' }} />
          <span style={{ background: c.accentSecondary || '#00d4ff' }} />
          <span style={{ background: c.bgPrimary || '#0a0a1a', border: '1px solid rgba(255,255,255,0.2)' }} />
          <span style={{ background: c.textPrimary || '#fff' }} />
        </div>
      </div>

      <div className="theme-actions">
        {onPublish && (
          <button className="theme-action-btn theme-action-publish" onClick={(e) => { e.stopPropagation(); onPublish(); }} title="Опубликовать" disabled={isPublishing}>
            {isPublishing ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="spinning">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            )}
          </button>
        )}
        {!theme.isBuiltIn && onEdit && (
          <button className="theme-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(theme); }} title="Редактировать">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {onExport && (
          <button className="theme-action-btn" onClick={(e) => { e.stopPropagation(); onExport(theme.id); }} title="Экспорт">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
        {!theme.isBuiltIn && onDelete && (
          <button className="theme-action-btn theme-action-danger" onClick={(e) => { e.stopPropagation(); onDelete(theme.id); }} title="Удалить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ThemeCard;
