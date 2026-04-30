import { useState, useRef, useEffect } from 'react';
import { sendMessage } from '../../utils/chat';

const EMOJI_LIST = [
  '😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡',
  '👍', '👎', '👋', '🙌', '🤝', '💪', '🎮', '🎯',
  '🔥', '❤️', '💜', '💙', '💚', '💛', '⭐', '🌟',
  '😈', '👻', '💀', '🤖', '🎉', '🎊', '🏆', '🥇',
];

const MessageInput = ({ conversationId, onSend }) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageData, setImageData] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() && !imageData) return;
    sendMessage(conversationId, text.trim(), imageData);
    if (onSend) onSend();
    setText('');
    setImagePreview(null);
    setImageData(null);
    setShowEmoji(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji) => {
    setText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой (макс. 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setImageData(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageData(null);
  };

  return (
    <div className="message-input-container">
      {imagePreview && (
        <div className="image-preview">
          <img src={imagePreview} alt="preview" />
          <button className="image-preview-remove" onClick={removeImage}>✕</button>
        </div>
      )}
      {showEmoji && (
        <div className="emoji-picker" style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          padding: '8px',
          marginBottom: '8px',
          background: 'var(--glass-bg)',
          borderRadius: '10px',
          border: '1px solid var(--glass-border)',
        }}>
          {EMOJI_LIST.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '18px',
                borderRadius: '6px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="message-input-wrapper">
        <textarea
          ref={textareaRef}
          className="message-input-textarea"
          placeholder="Написать сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <div className="input-actions">
          <button className="input-action-btn" onClick={() => setShowEmoji(!showEmoji)} title="Эмодзи">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <button className="input-action-btn" onClick={() => fileInputRef.current?.click()} title="Прикрепить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <button className="send-btn" onClick={handleSend} disabled={!text.trim() && !imageData}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />
    </div>
  );
};

export default MessageInput;
