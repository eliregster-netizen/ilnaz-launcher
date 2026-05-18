import { getApiUrl } from '../config';

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('ilnaz-token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function getToken() {
  return localStorage.getItem('ilnaz-token');
}

export async function fetchGames({ search, genre, tag, page, limit, sort } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (genre) params.set('genre', genre);
  if (tag) params.set('tag', tag);
  if (page) params.set('page', page);
  if (limit) params.set('limit', limit);
  if (sort) params.set('sort', sort);
  const res = await fetch(`${getApiUrl()}/hub/games?${params}`);
  return res.json();
}

export async function fetchGame(slug) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}/hub/games/${slug}`, { headers });
  return res.json();
}

export async function createGame(data) {
  const res = await fetch(`${getApiUrl()}/hub/games`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateGame(id, data) {
  const res = await fetch(`${getApiUrl()}/hub/games/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteGame(id) {
  const res = await fetch(`${getApiUrl()}/hub/games/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return res.json();
}

export async function incrementPlay(id) {
  const res = await fetch(`${getApiUrl()}/hub/games/${id}/play`, {
    method: 'POST', headers: authHeaders(),
  });
  return res.json();
}

export async function incrementDownload(id) {
  const res = await fetch(`${getApiUrl()}/hub/games/${id}/download`, {
    method: 'POST', headers: authHeaders(),
  });
  return res.json();
}

export async function rateGame(id, rating) {
  const res = await fetch(`${getApiUrl()}/hub/games/${id}/rate`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ rating }),
  });
  return res.json();
}

export async function fetchComments(gameId) {
  const res = await fetch(`${getApiUrl()}/hub/games/${gameId}/comments`);
  return res.json();
}

export async function postComment(gameId, content) {
  const res = await fetch(`${getApiUrl()}/hub/games/${gameId}/comments`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ content }),
  });
  return res.json();
}

export async function deleteComment(gameId, commentId) {
  const res = await fetch(`${getApiUrl()}/hub/games/${gameId}/comments/${commentId}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  return res.json();
}

export async function toggleLike(gameId) {
  const res = await fetch(`${getApiUrl()}/hub/games/${gameId}/like`, {
    method: 'POST', headers: authHeaders(),
  });
  return res.json();
}

export async function fetchMyGames() {
  const res = await fetch(`${getApiUrl()}/hub/my-games`, { headers: authHeaders() });
  return res.json();
}

export async function fetchUserGames(userId) {
  const res = await fetch(`${getApiUrl()}/hub/users/${userId}/games`);
  return res.json();
}

export async function approveGame(id) {
  const res = await fetch(`${getApiUrl()}/hub/games/${id}/approve`, {
    method: 'PUT', headers: authHeaders(),
  });
  return res.json();
}

export async function rejectGame(id) {
  const res = await fetch(`${getApiUrl()}/hub/games/${id}/reject`, {
    method: 'PUT', headers: authHeaders(),
  });
  return res.json();
}

export async function fetchPendingGames() {
  const res = await fetch(`${getApiUrl()}/hub/pending`, { headers: authHeaders() });
  return res.json();
}

export async function fetchGenres() {
  const res = await fetch(`${getApiUrl()}/hub/genres`);
  return res.json();
}
