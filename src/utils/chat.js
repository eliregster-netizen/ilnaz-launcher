import { io } from 'socket.io-client';
import { getActiveUser } from './auth';
import { getApiUrl, getSocketUrl } from '../config';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(getSocketUrl());
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

export async function createConversation(creatorId, type, name, memberIds) {
  const res = await fetch(`${getApiUrl()}/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creatorId, type, name, memberIds }),
  });
  return res.json();
}

export async function markAsRead(conversationId, lastMsgId) {
  const user = getActiveUser();
  if (!user) return;
  await fetch(`${getApiUrl()}/chat/conversations/${conversationId}/read`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, lastMsgId }),
  });
}

export async function deleteMessage(messageId) {
  const user = getActiveUser();
  if (!user) return null;
  const res = await fetch(`${getApiUrl()}/chat/messages/${messageId}?userId=${user.id}`, {
    method: 'DELETE',
  });
  return res.json();
}

export function sendMessage(conversationId, content, image = null) {
  const user = getActiveUser();
  if (!user || !socket) return;
  socket.emit('send-message', { conversationId, senderId: user.id, content, image });
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
  const user = getActiveUser();
  if (!user) return null;
  const res = await fetch(`${getApiUrl()}/chat/conversations/${conversationId}/edit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, ...data }),
  });
  return res.json();
}

export async function deleteConversation(conversationId) {
  const user = getActiveUser();
  if (!user) return null;
  const res = await fetch(`${getApiUrl()}/chat/conversations/${conversationId}?userId=${user.id}`, {
    method: 'DELETE',
  });
  return res.json();
}
