import { useState } from 'react';
import { getActiveUser, isAdmin } from '../../utils/auth';
import { deleteMessage } from '../../utils/chat';

const MessageBubble = ({ message, isOwn, onDelete }) => {
  const user = getActiveUser();
  const [showActions, setShowActions] = useState(false);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatContent = (content) => {
    if (!content) return null;
    let formatted = content;
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
    return { __html: formatted };
  };

  const handleDelete = async () => {
    if (message.deleted) return;
    await deleteMessage(message.id);
    if (onDelete) onDelete(message.id);
  };

  if (message.deleted) {
    return (
      <div className={`message-group ${isOwn ? 'sent' : 'received'}`}>
        {!isOwn && (
          <div className="msg-avatar">
            {message.avatar ? <img src={message.avatar} alt="" /> : message.nickname?.charAt(0)}
          </div>
        )}
        <div className="msg-content">
          {!isOwn && <div className="msg-author">{message.nickname}</div>}
          <div className="msg-bubble">
            <span className="msg-deleted">Сообщение удалено</span>
          </div>
          <div className="msg-time">{formatTime(message.created_at)}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`message-group ${isOwn ? 'sent' : 'received'}`}
      onMouseEnter={() => isOwn && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwn && (
        <div className="msg-avatar">
          {message.avatar ? <img src={message.avatar} alt="" /> : message.nickname?.charAt(0)}
        </div>
      )}
      <div className="msg-content">
        {!isOwn && <div className="msg-author">{message.nickname}</div>}
        <div className="msg-bubble">
          {showActions && (
            <div className="msg-actions">
              <button className="msg-action-btn" onClick={handleDelete} title="Удалить">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          )}
          <div className="msg-text" dangerouslySetInnerHTML={formatContent(message.content)} />
          {message.image && (
            <img className="msg-image" src={message.image} alt="attachment" onClick={() => window.open(message.image, '_blank')} />
          )}
          {message.edited === 1 && <span className="msg-edited">(ред.)</span>}
        </div>
        <div className="msg-time">{formatTime(message.created_at)}</div>
      </div>
    </div>
  );
};

export default MessageBubble;
