const ChatHeader = ({ conversation, onShowMembers, onEditGroup, onStartCall, onEndCall, callState, isCreator, onDeleteGroup, isInCall, callConversationId }) => {
  if (!conversation) return null;

  const formatMembersCount = (count) => {
    return count === 2 ? '2 участника' : `${count} участников`;
  };

  const isCallInThisConv = isInCall && callConversationId === conversation.id;

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
          {isCallInThisConv ? (
            <span className="call-active-indicator">Идёт звонок...</span>
          ) : conversation.type === 'group'
            ? (conversation.description || formatMembersCount(conversation.members?.length || 2))
            : (conversation.other_user_status === 'online' ? 'В сети' : 'Не в сети')}
        </div>
      </div>

      {isCallInThisConv ? (
        <button className="chat-call-btn chat-call-end-btn" onClick={onEndCall} title="Завершить звонок">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      ) : (
        <button className="chat-call-btn" onClick={onStartCall} title="Позвонить">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>
      )}

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
          {isCreator && (
            <button className="chat-delete-btn" onClick={onDeleteGroup} title="Удалить группу">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ChatHeader;
