import { getApiUrl } from '../config';

let activeUser = null;

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromId: activeUser.id, toId }),
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: activeUser.id }),
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: activeUser.id }),
  });
  return res.json();
}

export async function removeFriend(friendId) {
  if (!activeUser) return null;
  const res = await fetch(`${getApiUrl()}/friends/remove/${activeUser.id}/${friendId}`, {
    method: 'DELETE',
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function logout() {
  if (activeUser) {
    setStatus('offline').catch(() => {});
  }
  activeUser = null;
  localStorage.removeItem('ilnaz-session');
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
  const res = await fetch(`${getApiUrl()}/admin/users`, {
    headers: { 'X-User-Id': activeUser.id },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function adminDeleteUser(userId) {
  const res = await fetch(`${getApiUrl()}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': activeUser.id },
  });
  return res.json();
}

export async function adminBanUser(userId, banned) {
  const res = await fetch(`${getApiUrl()}/admin/users/${userId}/ban`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': activeUser.id },
    body: JSON.stringify({ banned }),
  });
  return res.json();
}

export async function adminEditUser(userId, data) {
  const res = await fetch(`${getApiUrl()}/admin/users/${userId}/edit`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': activeUser.id },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminGetStats() {
  const res = await fetch(`${getApiUrl()}/admin/stats`, {
    headers: { 'X-User-Id': activeUser.id },
  });
  if (!res.ok) return null;
  return res.json();
}
