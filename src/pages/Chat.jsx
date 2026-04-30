import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveUser, getFriendsList } from '../utils/auth';
import {
  getSocket,
  getConversations,
  getMessages,
  markAsRead,
  joinConversation,
  leaveConversation,
  getConversation,
} from '../utils/chat';
import ConversationList from '../components/Chat/ConversationList';
import MessageBubble from '../components/Chat/MessageBubble';
import MessageInput from '../components/Chat/MessageInput';
import ChatHeader from '../components/Chat/ChatHeader';
import NewChatModal from '../components/Chat/NewChatModal';
import EditGroupModal from '../components/Chat/EditGroupModal';
import './Chat.css';

const Chat = () => {
  const navigate = useNavigate();
  const user = getActiveUser();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConvRef = useRef(null);
  const userRef = useRef(null);

  activeConvRef.current = activeConv;
  userRef.current = user;

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const list = await getConversations(user.id);
    setConversations(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadConversations();

    const socket = getSocket();
    socketRef.current = socket;
    socket.emit('join', user.id);

    socket.on('new-message', (msg) => {
      if (msg.conversation_id === activeConvRef.current?.id) {
        setMessages(prev => [...prev, msg]);
        markAsRead(activeConvRef.current.id, msg.id);
      }
      loadConversations();
    });

    socket.on('new-conversation', () => {
      loadConversations();
    });

    socket.on('user-typing', ({ conversationId, userId }) => {
      if (conversationId === activeConvRef.current?.id && userId !== userRef.current?.id) {
        setTypingUsers(prev => ({ ...prev, [userId]: true }));
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        }, 3000);
      }
    });

    socket.on('message-deleted', ({ messageId, conversationId }) => {
      if (conversationId === activeConvRef.current?.id) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted: 1, content: '' } : m));
      }
    });

    socket.on('conversation-updated', ({ conversationId, conversation }) => {
      if (conversationId === activeConvRef.current?.id) {
        setActiveConv(prev => ({ ...prev, ...conversation }));
      }
      loadConversations();
    });

    return () => {
      if (activeConv?.id) leaveConversation(activeConv.id);
      socket.off('new-message');
      socket.off('new-conversation');
      socket.off('user-typing');
      socket.off('message-deleted');
      socket.off('conversation-updated');
    };
  }, []);

  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv.id);
      joinConversation(activeConv.id);
      getConversation(activeConv.id).then(data => {
        if (data) setActiveConv(prev => ({ ...prev, ...data, members: data.members }));
      });
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) markAsRead(activeConv.id, lastMsg.id);
    }
  }, [activeConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (convId) => {
    const msgs = await getMessages(convId);
    setMessages(msgs);
  };

  const handleSelectConversation = (conv) => {
    setActiveConv(conv);
  };

  const handleCreateChat = async () => {
    await loadConversations();
    if (activeConv) {
      const convData = await getConversation(activeConv.id);
      setActiveConv({ ...activeConv, ...convData, members: convData?.members });
    }
  };

  const handleSendMessage = () => {};

  const handleEditGroupUpdated = (updatedConv) => {
    setActiveConv(prev => ({ ...prev, ...updatedConv }));
    loadConversations();
  };

  return (
    <div className="chat-page fade-in">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Чаты</h2>
          <button className="new-chat-btn" onClick={() => setShowNewChat(true)} title="Новый чат">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <ConversationList
          conversations={conversations}
          activeId={activeConv?.id}
          onSelect={handleSelectConversation}
        />
      </div>

      <div className="chat-main">
        {!activeConv ? (
          <div className="chat-main-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>Выберите чат или создайте новый</p>
          </div>
        ) : (
          <>
            <ChatHeader
              conversation={activeConv}
              onShowMembers={() => setShowMembers(true)}
              onEditGroup={() => setShowEditGroup(true)}
            />
            <div className="messages-container">
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === user?.id}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            {Object.keys(typingUsers).length > 0 && (
              <div className="typing-indicator">
                Печатает...
              </div>
            )}
            <MessageInput
              conversationId={activeConv.id}
              onSend={handleSendMessage}
            />
          </>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onCreate={handleCreateChat}
        />
      )}

      {showMembers && activeConv && (
        <div className="members-modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="members-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Участники</h3>
            <div className="members-list">
              {(activeConv.members || []).map(member => (
                <div className="member-item" key={member.id}>
                  <div className="member-item-avatar">
                    {member.avatar ? <img src={member.avatar} alt="" /> : member.nickname?.charAt(0)}
                  </div>
                  <span className="member-item-name">{member.nickname}</span>
                  <span className="member-item-status">
                    {member.status === 'online' ? 'В сети' : 'Не в сети'}
                  </span>
                </div>
              ))}
            </div>
            <div className="modal-actions-row">
              <button className="modal-cancel-btn" onClick={() => setShowMembers(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {showEditGroup && activeConv && (
        <EditGroupModal
          conversation={activeConv}
          onClose={() => setShowEditGroup(false)}
          onUpdated={handleEditGroupUpdated}
        />
      )}
    </div>
  );
};

export default Chat;
