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
  deleteConversation,
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
  const [expandedImage, setExpandedImage] = useState(null);

  const [callActive, setCallActive] = useState(false);
  const [callConversationId, setCallConversationId] = useState(null);
  const [callInitiatorId, setCallInitiatorId] = useState(null);
  const [callJoinedMembers, setCallJoinedMembers] = useState([]);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [mutedUsers, setMutedUsers] = useState({});

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConvRef = useRef(null);
  const userRef = useRef(null);
  const conversationsRef = useRef([]);
  const callActiveRef = useRef(false);
  const callConvIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({});
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyzersRef = useRef({});
  const animFrameRef = useRef(null);

  activeConvRef.current = activeConv;
  userRef.current = user;
  conversationsRef.current = conversations;
  callActiveRef.current = callActive;
  callConvIdRef.current = callConversationId;

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const list = await getConversations(user.id);
    setConversations(list);
    setLoading(false);
  }, [user]);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const list = await getConversations(user.id);
    setConversations(list);
  }, [user]);

  const getMemberById = useCallback((memberId) => {
    const conv = callConversationId
      ? conversationsRef.current.find(c => c.id === callConversationId)
      : activeConv;
    if (!conv) return null;
    return (conv.members || []).find(m => m.id === memberId);
  }, [activeConv, callConversationId]);

  const findConversationById = useCallback((convId) => {
    return conversationsRef.current.find(c => c.id === convId);
  }, []);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getOrCreateRemoteVideo = (userId) => {
    if (!remoteVideosRef.current[userId]) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);
      remoteVideosRef.current[userId] = video;
    }
    return remoteVideosRef.current[userId];
  };

  const setupAnalyzer = (userId, stream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyzersRef.current[userId] = analyser;
  };

  const startAudioLevelMonitoring = () => {
    if (animFrameRef.current) return;
    const checkLevels = () => {
      const newSpeaking = {};
      for (const userId in analyzersRef.current) {
        const analyser = analyzersRef.current[userId];
        if (analyser) {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          newSpeaking[userId] = avg > 15;
        }
      }
      setSpeakingUsers(prev => {
        let changed = false;
        for (const key in newSpeaking) {
          if (prev[key] !== newSpeaking[key]) { changed = true; break; }
        }
        if (Object.keys(newSpeaking).length !== Object.keys(prev).length) changed = true;
        return changed ? newSpeaking : prev;
      });
      animFrameRef.current = requestAnimationFrame(checkLevels);
    };
    checkLevels();
  };

  const stopAudioLevelMonitoring = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setSpeakingUsers({});
    Object.values(analyzersRef.current).forEach(a => {
      try { a.disconnect(); } catch (e) {}
    });
    analyzersRef.current = {};
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const setupPeerConnection = (pc, remoteUserId, convId, stream) => {
    stream.getTracks().forEach(track => pc.addTrack(track));

    pc.ontrack = (event) => {
      const video = getOrCreateRemoteVideo(remoteUserId);
      if (video.srcObject !== event.streams[0]) {
        video.srcObject = event.streams[0];
        if (event.streams[0].getAudioTracks().length > 0) {
          setupAnalyzer(remoteUserId, event.streams[0]);
          startAudioLevelMonitoring();
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('call-signal', {
          to: remoteUserId,
          from: user.id,
          conversationId: convId,
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    peerConnectionsRef.current[remoteUserId] = pc;
    return pc;
  };

  const createPeerAndOffer = async (remoteUserId, stream, convId) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      setupPeerConnection(pc, remoteUserId, convId, stream);

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      socketRef.current.emit('call-offer', {
        to: remoteUserId,
        from: user.id,
        conversationId: convId,
        sdp: pc.localDescription,
      });

      return pc;
    } catch (err) {
      console.error('Failed to create offer for', remoteUserId, err);
      return null;
    }
  };

  const handlePeerAnswer = async (data) => {
    const pc = peerConnectionsRef.current[data.from];
    if (pc && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        console.error('Failed to set remote description:', err);
      }
    }
  };

  const handlePeerSignal = async (data) => {
    const pc = peerConnectionsRef.current[data.from];
    if (pc && data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    }
  };

  const handlePeerOffer = async (data) => {
    if (!localStreamRef.current) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      setupPeerConnection(pc, data.from, data.conversationId, localStreamRef.current);

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('call-answer', {
        to: data.from,
        from: user.id,
        conversationId: data.conversationId,
        sdp: pc.localDescription,
      });
    } catch (err) {
      console.error('Failed to handle offer:', err);
    }
  };

  const cleanupCall = useCallback(() => {
    Object.values(peerConnectionsRef.current).forEach(pc => {
      try { pc.close(); } catch (e) {}
    });
    peerConnectionsRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    Object.values(remoteVideosRef.current).forEach(video => {
      if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      try { video.remove(); } catch (e) {}
    });
    remoteVideosRef.current = {};

    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    stopAudioLevelMonitoring();

    setCallActive(false);
    callActiveRef.current = false;
    setCallConversationId(null);
    callConvIdRef.current = null;
    setCallInitiatorId(null);
    setCallJoinedMembers([]);
    setIsInitiator(false);
    setIsMuted(false);
    setIsVideoOn(false);
    setIsScreenSharing(false);
    setCallDuration(0);
    setShowIncomingCall(false);
    setMutedUsers({});
  }, []);

  const startCall = useCallback(async () => {
    if (!activeConv || !user || callActiveRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const convId = activeConv.id;

      setCallConversationId(convId);
      callConvIdRef.current = convId;
      setCallInitiatorId(user.id);
      setCallJoinedMembers([user.id]);
      setIsInitiator(true);
      setCallActive(true);
      callActiveRef.current = true;
      callStartTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);

      socketRef.current.emit('call-start', {
        conversationId: convId,
        initiatorId: user.id,
      });
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  }, [activeConv, user]);

  const joinCall = useCallback(async () => {
    if (!callConversationId || !user || callActiveRef.current) return;
    setShowIncomingCall(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      setCallActive(true);
      callActiveRef.current = true;
      callStartTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);

      socketRef.current.emit('call-join-request', {
        conversationId: callConversationId,
        userId: user.id,
      });
    } catch (err) {
      console.error('Failed to join call:', err);
      cleanupCall();
    }
  }, [callConversationId, user, cleanupCall]);

  const leaveCall = useCallback(() => {
    const convId = callConvIdRef.current;
    if (convId) {
      socketRef.current?.emit('call-leave', {
        conversationId: convId,
        userId: user.id,
      });
    }
    cleanupCall();
  }, [user, cleanupCall]);

  const endCall = useCallback(() => {
    const convId = callConvIdRef.current;
    if (convId) {
      socketRef.current?.emit('call-end', { conversationId: convId });
    }
    cleanupCall();
  }, [cleanupCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const muted = !audioTrack.enabled;
        setIsMuted(muted);
        const convId = callConvIdRef.current;
        if (convId) {
          socketRef.current?.emit('call-mute', {
            conversationId: convId,
            userId: user.id,
            muted,
          });
        }
      }
    }
  }, [user.id]);

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;

    if (isVideoOn) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(videoTrack);
        setIsVideoOn(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        Object.values(peerConnectionsRef.current).forEach(pc => {
          const senders = pc.getSenders();
          const hasVideo = senders.some(s => s.track && s.track.kind === 'video');
          if (!hasVideo) {
            pc.addTrack(videoTrack);
          }
        });
      } catch (err) {
        console.error('Failed to enable video:', err);
      }
    }
  }, [isVideoOn]);

  const toggleScreenShare = useCallback(async () => {
    if (!localStreamRef.current) return;

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }

      const oldVideoTracks = localStreamRef.current.getVideoTracks();
      oldVideoTracks.forEach(t => {
        localStreamRef.current.removeTrack(t);
        t.stop();
      });

      try {
        const newVideo = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newVideo.getVideoTracks()[0];
        localStreamRef.current.addTrack(newTrack);
      } catch (err) {
        console.error('Failed to restore camera:', err);
      }

      setIsScreenSharing(false);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        screenStreamRef.current = displayStream;
        const displayTrack = displayStream.getVideoTracks()[0];
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        localStreamRef.current.addTrack(displayTrack);
        setIsScreenSharing(true);
        setIsVideoOn(false);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        Object.values(peerConnectionsRef.current).forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(displayTrack);
          }
        });

        displayTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.error('Failed to start screen share:', err);
      }
    }
  }, [isScreenSharing]);

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
        markAsRead(activeConvRef.current.id, msg.id).then(() => refreshConversations());
      }
      loadConversations();
    });

    socket.on('new-conversation', () => loadConversations());

    socket.on('conversation-deleted', ({ conversationId }) => {
      if (activeConvRef.current?.id === conversationId) {
        setActiveConv(null);
        setMessages([]);
      }
      loadConversations();
    });

    socket.on('members-added', ({ conversationId }) => {
      if (conversationId === activeConvRef.current?.id) {
        getConversation(conversationId).then(data => {
          if (data) setActiveConv(prev => ({ ...prev, members: data.members }));
        });
      }
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

    socket.on('call-incoming', (data) => {
      if (callActiveRef.current) return;
      const conv = findConversationById(data.conversationId);
      if (!conv) return;
      setCallConversationId(data.conversationId);
      callConvIdRef.current = data.conversationId;
      setCallInitiatorId(data.initiatorId);
      setShowIncomingCall(true);
    });

    socket.on('call-offer', (data) => {
      handlePeerOffer(data);
    });

    socket.on('call-answer', (data) => {
      handlePeerAnswer(data);
    });

    socket.on('call-signal', (data) => {
      handlePeerSignal(data);
    });

    socket.on('call-peer-joined', (data) => {
      setCallJoinedMembers(data.joined);
      if (data.userId === user.id && !callActiveRef.current) {
        setCallActive(true);
        callActiveRef.current = true;
        callStartTimeRef.current = Date.now();
        durationIntervalRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }, 1000);
      }
      if (isInitiator && data.userId !== user.id && localStreamRef.current) {
        createPeerAndOffer(data.userId, localStreamRef.current, data.conversationId);
      }
    });

    socket.on('call-peer-left', (data) => {
      setCallJoinedMembers(data.joined);
      if (data.userId !== user.id) {
        const pc = peerConnectionsRef.current[data.userId];
        if (pc) {
          try { pc.close(); } catch (e) {}
          delete peerConnectionsRef.current[data.userId];
        }
        const video = remoteVideosRef.current[data.userId];
        if (video) {
          if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
          video.srcObject = null;
          try { video.remove(); } catch (e) {}
          delete remoteVideosRef.current[data.userId];
        }
        delete analyzersRef.current[data.userId];
      }
      if (data.joined.length === 0) {
        cleanupCall();
      }
    });

    socket.on('call-initiator-changed', (data) => {
      setCallInitiatorId(data.newInitiatorId);
      setCallJoinedMembers(data.joined);
      if (data.newInitiatorId === user.id) {
        setIsInitiator(true);
      }
    });

    socket.on('call-member-muted', (data) => {
      setMutedUsers(prev => ({ ...prev, [data.userId]: data.muted }));
    });

    socket.on('call-ended', () => {
      cleanupCall();
    });

    return () => {
      if (activeConv?.id) leaveConversation(activeConv.id);
      socket.off('new-message');
      socket.off('new-conversation');
      socket.off('conversation-deleted');
      socket.off('members-added');
      socket.off('user-typing');
      socket.off('message-deleted');
      socket.off('conversation-updated');
      socket.off('call-incoming');
      socket.off('call-offer');
      socket.off('call-answer');
      socket.off('call-signal');
      socket.off('call-peer-joined');
      socket.off('call-peer-left');
      socket.off('call-initiator-changed');
      socket.off('call-member-muted');
      socket.off('call-ended');
    };
  }, [user]);

  useEffect(() => {
    if (!activeConv) return;
    loadMessages(activeConv.id).then((msgs) => {
      joinConversation(activeConv.id);
      getConversation(activeConv.id).then(data => {
        if (data) setActiveConv(prev => ({ ...prev, ...data, members: data.members }));
      });
      if (msgs && msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        markAsRead(activeConv.id, lastMsg.id).then(() => {
          refreshConversations();
        });
      }
    });
  }, [activeConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (convId) => {
    const msgs = await getMessages(convId);
    setMessages(msgs);
    return msgs;
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

  const handleDeleteGroup = async () => {
    if (!activeConv || !user) return;
    if (!confirm('Удалить эту группу?')) return;
    const res = await deleteConversation(activeConv.id);
    if (res?.success) {
      setActiveConv(null);
      setMessages([]);
      loadConversations();
    }
  };

  const handleImageClick = (imageUrl) => {
    setExpandedImage(imageUrl);
  };

  const callMembersObjects = callJoinedMembers.map(id => {
    const member = getMemberById(id);
    if (member) return member;
    return { id, nickname: id === user?.id ? 'Вы' : id, avatar: null };
  });

  const isCreator = activeConv && user && activeConv.creator_id === user.id;
  const currentCallConv = callConversationId ? findConversationById(callConversationId) : null;
  const isCallInThisConv = callActive && callConversationId === activeConv?.id;

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
              onStartCall={startCall}
              callState={callActive ? 'active' : null}
              onEndCall={isInitiator ? endCall : leaveCall}
              isCreator={isCreator}
              onDeleteGroup={handleDeleteGroup}
              isInCall={callActive}
              callConversationId={callConversationId}
            />
            <div className="messages-container">
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === user?.id}
                  onImageClick={handleImageClick}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            {Object.keys(typingUsers).length > 0 && (
              <div className="typing-indicator">
                Печатает...
              </div>
            )}

            {showIncomingCall && (
              <div className="call-overlay call-incoming-overlay">
                <div className="call-incoming-panel">
                  <div className="call-incoming-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div className="call-incoming-title">
                    {currentCallConv
                      ? (currentCallConv.type === 'group' ? currentCallConv.name : currentCallConv.other_user_name)
                      : 'Входящий звонок'}
                  </div>
                  <div className="call-incoming-subtitle">
                    {getMemberById(callInitiatorId)?.nickname || 'Участник'} звонит...
                  </div>
                  <div className="call-incoming-controls">
                    <button className="call-btn call-accept-btn" onClick={joinCall} title="Принять">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </button>
                    <button className="call-btn call-end" onClick={cleanupCall} title="Отклонить">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {callActive && (
              <div className="call-overlay">
                <div className="call-panel">
                  <div className="call-header">
                    <div className="call-title">
                      {currentCallConv
                        ? (currentCallConv.type === 'group' ? currentCallConv.name : currentCallConv.other_user_name)
                        : 'Звонок'}
                    </div>
                    <div className="call-timer">{formatDuration(callDuration)}</div>
                  </div>
                  <div className="call-members-grid">
                    {callMembersObjects.map(member => {
                      const isSpeaking = speakingUsers[member.id];
                      const isSelf = member.id === user?.id;
                      const isRemoteMuted = !isSelf && mutedUsers[member.id];
                      return (
                        <div
                          key={member.id}
                          className={`call-member-avatar ${isSpeaking ? 'speaking' : ''} ${isRemoteMuted ? 'muted' : ''}`}
                        >
                          <div className="call-member-avatar-inner">
                            {member.avatar ? (
                              <img src={member.avatar} alt="" />
                            ) : (
                              <span>{member.nickname?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="call-member-name">{member.nickname}</div>
                          {isRemoteMuted && (
                            <div className="call-member-muted-badge">
                              <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.01.97l2.04 2.04.97-.97-3-3-.97.93h1zm-4.02.97c0 1.19.34 2.3.9 3.28l1.23-1.23c-.27-.62-.43-1.31-.43-2.05H7l-.97.93 2.04 2.04-.97.97-3-3-.97.93 3.96 3.96c-.79.47-1.69.76-2.66.85V21h6.04c-.97-.09-1.87-.38-2.66-.85L3.29 17.29a.996.996 0 0 1-.29-.71c0-.28.11-.53.29-.71l2.48-2.48c.18-.18.43-.29.71-.29.27 0 .52.1.7.28l1.23 1.23c-.27-.62-.43-1.31-.43-2.05H5v-2h2V8.67l2 2V11h1v1.97z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="call-video-area">
                    {Object.keys(remoteVideosRef.current).length > 0 ? (
                      Object.entries(remoteVideosRef.current).map(([userId]) => (
                        <div key={userId} className="remote-video-container">
                          <video
                            ref={el => {
                              if (el && remoteVideosRef.current[userId]) {
                                el.srcObject = remoteVideosRef.current[userId].srcObject;
                              }
                            }}
                            autoPlay
                            playsInline
                            className="remote-video"
                          />
                        </div>
                      ))
                    ) : (
                      <div className="call-no-video">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                        <p>Аудиозвонок</p>
                      </div>
                    )}
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`local-video ${isVideoOn || isScreenSharing ? 'visible' : 'hidden'}`}
                    />
                  </div>
                  <div className="call-controls">
                    <button className={`call-btn ${isMuted ? 'call-btn-active' : ''}`} onClick={toggleMute} title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}>
                      {isMuted ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      )}
                    </button>
                    <button className={`call-btn ${isVideoOn ? 'call-btn-active' : ''}`} onClick={toggleVideo} title={isVideoOn ? 'Выключить камеру' : 'Включить камеру'}>
                      {isVideoOn ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                    <button className={`call-btn ${isScreenSharing ? 'call-btn-active' : ''}`} onClick={toggleScreenShare} title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </button>
                    <button className="call-btn call-end" onClick={isInitiator ? endCall : leaveCall} title={isInitiator ? 'Завершить' : 'Выйти'}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <MessageInput
              conversationId={activeConv.id}
              onSend={handleSendMessage}
            />
          </>
        )}
      </div>

      {expandedImage && (
        <div className="image-modal-overlay" onClick={() => setExpandedImage(null)}>
          <div className="image-modal" onClick={e => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setExpandedImage(null)}>✕</button>
            <img src={expandedImage} alt="preview" className="image-modal-img" />
          </div>
        </div>
      )}

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
