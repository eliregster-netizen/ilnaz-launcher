const ChatHeader = ({ conversation, onShowMembers, onEditGroup }) => {
  if (!conversation) return null;

  const formatMembersCount = (count) => {
    return count === 2 ? '2 участника' : `${count} участников`;
  };

  return (
    <div className="chat-header-bar">
      <div className="chat-header-avatar">
        {conversation.type === 'group' ? (
          conversation.icon ? (
            <img src={conversation.icon} alt="" />
          ) : (
            <span>{(conversation.name || 'G').charAt(0).toUpperCase()}</span>
          )
        ) : null}
      </div>
      <div className="chat-header-info">
        <div className="chat-header-name">
          {conversation.type === 'group'
            ? (conversation.name || 'Группа')
            : (conversation.other_user_name || 'Пользователь')}
        </div>
        <div className="chat-header-subtitle">
          {conversation.type === 'group'
            ? (conversation.description || formatMembersCount(conversation.members?.length || 2))
            : (conversation.other_user_status === 'online' ? 'В сети' : 'Не в сети')}
        </div>
      </div>
      {conversation.type === 'group' && (
        <>
          <button className="chat-members-btn" onClick={onEditGroup}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '6px' }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Настройки
          </button>
          <button className="chat-members-btn" onClick={onShowMembers}>
            Участники
          </button>
        </>
      )}
    </div>
  );
};

export default ChatHeader;
