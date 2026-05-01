import { useState } from 'react';
import { getActiveUser, isAdmin } from '../../utils/auth';
import { deleteMessage } from '../../utils/chat';

const MessageBubble = ({ message, isOwn, onDelete, onImageClick }) => {
  const user = getActiveUser();
  const [showActions, setShowActions] = useState(false);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isImageUrl = (text) => {
    return /https?:\/\/.*\.(png|jpg|jpeg|gif|webp|bmp)(\?.*)?$/i.test(text);
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  };

  const formatInline = (text) => {
    const result = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/^\*(.+?)\*/);
      const codeMatch = remaining.match(/^`(.+?)`/);

      if (boldMatch) {
        result.push(<strong key={keyIdx++}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
      } else if (italicMatch) {
        result.push(<em key={keyIdx++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch[0].length);
      } else if (codeMatch) {
        result.push(<code key={keyIdx++}>{codeMatch[1]}</code>);
        remaining = remaining.slice(codeMatch[0].length);
      } else {
        result.push(<span key={keyIdx++}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      }
    }
    return result;
  };

  const formatContent = (content) => {
    if (!content) return null;
    const parts = content.split(/(https?:\/\/\S+)/g);
    return parts.map((part, i) => {
      if (isImageUrl(part)) {
        const isGif = part.toLowerCase().endsWith('.gif') || part.includes('.gif?');
        return (
          <img
            key={i}
            className={`msg-image-inline ${isGif ? 'msg-gif' : ''}`}
            src={part}
            alt="attachment"
            onClick={() => onImageClick && onImageClick(part)}
          />
        );
      }
      if (!part.trim()) return null;
      return <span key={i}>{formatInline(part)}</span>;
    });
  };

  const handleDelete = async () => {
    if (message.deleted) return;
    await deleteMessage(message.id);
    if (onDelete) onDelete(message.id);
  };

  if (message.is_system) {
    return (
      <div className="system-message">
        <span>{message.content}</span>
        <span className="msg-time">{formatTime(message.created_at)}</span>
      </div>
    );
  }

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
          <div className="msg-text">{formatContent(message.content)}</div>
          {message.image && (
            <img
              className="msg-image"
              src={message.image}
              alt="attachment"
              onClick={() => onImageClick && onImageClick(message.image)}
            />
          )}
          {message.edited === 1 && <span className="msg-edited">(ред.)</span>}
        </div>
        <div className="msg-time">{formatTime(message.created_at)}</div>
      </div>
    </div>
  );
};

export default MessageBubble;
