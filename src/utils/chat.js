import { io } from 'socket.io-client';
import { getActiveUser } from './auth';
import { getApiUrl, getSocketUrl } from '../config';

let socket = null;

function getToken() {
  return localStorage.getItem('ilnaz-token');
}

function authHeaders(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function getSocket() {
  if (!socket || !socket.connected) {
    socket = io(getSocketUrl(), {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export async function getConversations(userId) {
  const res = await fetch(`${getApiUrl()}/chat/conversations/${userId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getMessages(conversationId, before = null, limit = 50) {
  const url = `${getApiUrl()}/chat/messages/${conversationId}?limit=${limit}${before ? `&before=${before}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function getConversation(conversationId) {
  const res = await fetch(`${getApiUrl()}/chat/conversation/${conversationId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createConversation(type, name, memberIds) {
  const res = await fetch(`${getApiUrl()}/chat/conversations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type, name, memberIds }),
  });
  return res.json();
}

export async function markAsRead(conversationId, lastMsgId) {
  await fetch(`${getApiUrl()}/chat/conversations/${conversationId}/read`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ lastMsgId }),
  });
}

export async function deleteMessage(messageId) {
  const res = await fetch(`${getApiUrl()}/chat/messages/${messageId}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  return res.json();
}

export function sendMessage(conversationId, content, image = null, file = null, fileName = null, fileType = null, fileSize = null) {
  const user = getActiveUser();
  if (!user || !socket) return;
  socket.emit('send-message', { conversationId, content, image, file, fileName, fileType, fileSize });
}

export function joinConversation(conversationId) {
  if (!socket) return;
  socket.emit('join-conversation', conversationId);
}

export function leaveConversation(conversationId) {
  if (!socket) return;
  socket.emit('leave-conversation', conversationId);
}

export function sendTyping(conversationId) {
  const user = getActiveUser();
  if (!user || !socket) return;
  socket.emit('typing', { conversationId, userId: user.id });
}

export async function editConversation(conversationId, data) {
  const res = await fetch(`${getApiUrl()}/chat/conversations/${conversationId}/edit`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteConversation(conversationId) {
  const res = await fetch(`${getApiUrl()}/chat/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  return res.json();
}

export async function addMembers(conversationId, newMemberIds) {
  const res = await fetch(`${getApiUrl()}/chat/conversations/${conversationId}/add-members`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ newMemberIds }),
  });
  return res.json();
}

export async function leaveConversationAPI(conversationId) {
  const res = await fetch(`${getApiUrl()}/chat/conversations/${conversationId}/leave`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function removeConversationMember(conversationId, memberId) {
  const res = await fetch(`${getApiUrl()}/chat/conversations/${conversationId}/members/${memberId}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  return res.json();
}
