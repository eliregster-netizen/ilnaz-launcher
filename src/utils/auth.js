import { getApiUrl } from '../config';

let activeUser = null;

function getToken() {
  return localStorage.getItem('ilnaz-token');
}

function setToken(token) {
  localStorage.setItem('ilnaz-token', token);
}

function removeToken() {
  localStorage.removeItem('ilnaz-token');
}

function authHeaders(json = true) {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function getActiveUser() {
  if (!activeUser) {
    try {
      const data = localStorage.getItem('ilnaz-session');
      if (data) {
        activeUser = JSON.parse(data);
      }
    } catch (e) {}
  }
  return activeUser;
}

export async function login(username, password) {
  const res = await fetch(`${getApiUrl()}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success) {
    activeUser = data.user;
    localStorage.setItem('ilnaz-session', JSON.stringify(data.user));
    if (data.token) setToken(data.token);
  }
  return data;
}

export async function register(username, password, nickname) {
  const res = await fetch(`${getApiUrl()}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, nickname }),
  });
  const data = await res.json();
  if (data.success) {
    activeUser = data.user;
    localStorage.setItem('ilnaz-session', JSON.stringify(data.user));
    if (data.token) setToken(data.token);
  }
  return data;
}

export async function getUserById(id) {
  const res = await fetch(`${getApiUrl()}/users/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getUserByUsername(username) {
  const res = await fetch(`${getApiUrl()}/users/by-username/${username}`);
  if (!res.ok) return null;
  return res.json();
}

export async function searchUsers(query) {
  if (!query) return [];
  const res = await fetch(`${getApiUrl()}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function updateUser(updates) {
  if (!activeUser) return null;
  const res = await fetch(`${getApiUrl()}/users/${activeUser.id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (data.success) {
    activeUser = data.user;
    localStorage.setItem('ilnaz-session', JSON.stringify(data.user));
  }
  return data;
}

export async function updateUserStats(userId, stats) {
  const res = await fetch(`${getApiUrl()}/users/${userId}/stats`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(stats),
  });
  const data = await res.json();
  if (data.success) {
    activeUser = data.user;
    localStorage.setItem('ilnaz-session', JSON.stringify(data.user));
  }
  return data;
}

export async function sendFriendRequest(toId) {
  if (!activeUser) return null;
  const res = await fetch(`${getApiUrl()}/friends/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ toId }),
  });
  return res.json();
}

export async function getPendingRequests() {
  if (!activeUser) return [];
  const res = await fetch(`${getApiUrl()}/friends/pending/${activeUser.id}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getSentRequests() {
  if (!activeUser) return [];
  const res = await fetch(`${getApiUrl()}/friends/sent/${activeUser.id}`);
  if (!res.ok) return [];
  return res.json();
}

export async function acceptFriendRequest(requestId) {
  if (!activeUser) return null;
  const res = await fetch(`${getApiUrl()}/friends/accept/${requestId}`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  if (res.ok) {
    const updatedUser = await getUserById(activeUser.id);
    if (updatedUser) {
      activeUser = updatedUser;
      localStorage.setItem('ilnaz-session', JSON.stringify(updatedUser));
    }
  }
  return res.json();
}

export async function declineFriendRequest(requestId) {
  if (!activeUser) return null;
  const res = await fetch(`${getApiUrl()}/friends/decline/${requestId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

export async function cancelFriendRequest(requestId) {
  if (!activeUser) return null;
  const res = await fetch(`${getApiUrl()}/friends/request/${requestId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

export async function removeFriend(friendId) {
  if (!activeUser) return null;
  const res = await fetch(`${getApiUrl()}/friends/remove/${friendId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.ok) {
    const updatedUser = await getUserById(activeUser.id);
    if (updatedUser) {
      activeUser = updatedUser;
      localStorage.setItem('ilnaz-session', JSON.stringify(updatedUser));
    }
  }
  return res.json();
}

export async function setStatus(status) {
  if (!activeUser) return;
  await fetch(`${getApiUrl()}/users/${activeUser.id}/status`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
}

export function logout() {
  if (activeUser) {
    setStatus('offline').catch(() => {});
  }
  activeUser = null;
  localStorage.removeItem('ilnaz-session');
  removeToken();
}

export async function getFriendsList() {
  if (!activeUser) return [];
  const res = await fetch(`${getApiUrl()}/friends/list/${activeUser.id}`);
  if (!res.ok) return [];
  return res.json();
}

export function isAdmin() {
  return activeUser && (activeUser.role === 'admin' || activeUser.role === 'owner');
}

export async function refreshSession() {
  if (!activeUser) return false;
  try {
    const res = await fetch(`${getApiUrl()}/users/${activeUser.id}`);
    if (res.ok) {
      const fresh = await res.json();
      activeUser = fresh;
      localStorage.setItem('ilnaz-session', JSON.stringify(fresh));
      return true;
    }
  } catch (e) {}
  return false;
}

export async function adminGetUsers() {
  const res = await fetch(`${getApiUrl()}/api/admin/users`, {
    headers: authHeaders(false),
  });
  if (!res.ok) {
    console.error('[Admin] Failed to fetch users:', res.status, await res.text());
    return [];
  }
  return res.json();
}

export async function adminDeleteUser(userId) {
  const res = await fetch(`${getApiUrl()}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  return res.json();
}

export async function adminBanUser(userId, banned) {
  const res = await fetch(`${getApiUrl()}/admin/users/${userId}/ban`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ banned }),
  });
  return res.json();
}

export async function adminEditUser(userId, data) {
  const res = await fetch(`${getApiUrl()}/admin/users/${userId}/edit`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminGetStats() {
  const res = await fetch(`${getApiUrl()}/api/admin/stats`, {
    headers: authHeaders(false),
  });
  if (!res.ok) {
    console.error('[Admin] Failed to fetch stats:', res.status, await res.text());
    return null;
  }
  return res.json();
}
