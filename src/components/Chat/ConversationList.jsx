const ConversationList = ({ conversations, activeId, onSelect }) => {
  if (conversations.length === 0) {
    return (
      <div className="conversation-list">
        <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Нет чатов</p>
          <span style={{ fontSize: '12px' }}>Создайте новый чат или группу</span>
        </div>
      </div>
    );
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const formatContent = (content) => {
    if (!content) return '';
    const maxLen = 30;
    if (content.length > maxLen) return content.slice(0, maxLen) + '...';
    return content;
  };

  return (
    <div className="conversation-list">
      {conversations.map(conv => (
        <div
          className={`conversation-item ${conv.id === activeId ? 'active' : ''}`}
          key={conv.id}
          onClick={() => onSelect(conv)}
        >
          <div className="conv-avatar">
            {conv.type === 'group' ? (
              conv.icon ? (
                <img src={conv.icon} alt="" />
              ) : (
                <span>{(conv.name || 'G').charAt(0).toUpperCase()}</span>
              )
            ) : (
              conv.other_user_avatar ? (
                <img src={conv.other_user_avatar} alt="" />
              ) : (
                <span>{(conv.other_user_name || 'U').charAt(0).toUpperCase()}</span>
              )
            )}
            {conv.type === 'private' && conv.other_user_status && (
              <span className={`conv-status-dot ${conv.other_user_status}`} />
            )}
          </div>
          <div className="conv-info">
            <div className="conv-name">
              {conv.type === 'group' ? (conv.name || 'Группа') : (conv.other_user_name || 'Пользователь')}
            </div>
            <div className="conv-last-message">
              {conv.last_message ? formatContent(conv.last_message) : 'Нет сообщений'}
            </div>
          </div>
          <div className="conv-meta">
            {conv.last_message_time && <span className="conv-time">{formatTime(conv.last_message_time)}</span>}
            {conv.unread_count > 0 && <span className="conv-unread">{conv.unread_count}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversationList;
