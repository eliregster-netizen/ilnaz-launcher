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

  const isVideoUrl = (text) => {
    return /https?:\/\/.*\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(text);
  };

  const isGifUrl = (text) => {
    return /https?:\/\/.*\.(gif)(\?.*)?$/i.test(text) || text.includes('.gif?');
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
      if (isGifUrl(part)) {
        return (
          <img key={i} className="msg-image-inline msg-gif" src={part} alt="gif"
            onClick={() => onImageClick && onImageClick(part)} />
        );
      }
      if (isImageUrl(part)) {
        return (
          <img key={i} className="msg-image-inline" src={part} alt="attachment"
            onClick={() => onImageClick && onImageClick(part)} />
        );
      }
      if (isVideoUrl(part)) {
        return (
          <video key={i} className="msg-video-inline" controls playsInline>
            <source src={part} />
          </video>
        );
      }
      if (!part.trim()) return null;
      return <span key={i}>{formatInline(part)}</span>;
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type) => {
    if (!type) return '📄';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.startsWith('application/pdf')) return '📕';
    if (type.startsWith('application/zip') || type.startsWith('application/x-rar')) return '📦';
    if (type.startsWith('text/')) return '📝';
    return '📄';
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

          {/* Inline image from URL in content */}
          {message.image && (
            <img
              className="msg-image"
              src={message.image}
              alt="attachment"
              onClick={() => onImageClick && onImageClick(message.image)}
            />
          )}

          {/* Video file attachment */}
          {message.file && message.file_type && message.file_type.startsWith('video/') && (
            <video className="msg-video" controls playsInline preload="metadata">
              <source src={message.file} type={message.file_type} />
            </video>
          )}

          {/* Generic file attachment (non-video, non-image) */}
          {message.file && !message.file_type?.startsWith('video/') && !message.file_type?.startsWith('image/') && (
            <div className="msg-file-attachment" onClick={() => {
              const a = document.createElement('a');
              a.href = message.file;
              a.download = message.file_name || 'file';
              a.click();
            }}>
              <span className="msg-file-icon">{getFileIcon(message.file_type)}</span>
              <div className="msg-file-info">
                <span className="msg-file-name">{message.file_name || 'Файл'}</span>
                <span className="msg-file-size">{formatFileSize(message.file_size)}</span>
              </div>
            </div>
          )}

          {message.edited === 1 && <span className="msg-edited">(ред.)</span>}
        </div>
        <div className="msg-time">{formatTime(message.created_at)}</div>
      </div>
    </div>
  );
};

export default MessageBubble;
