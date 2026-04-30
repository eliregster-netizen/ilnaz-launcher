const DEFAULT_SERVER = 'http://localhost:3001';

export function getServerUrl() {
  try {
    const stored = localStorage.getItem('ilnaz-server-url');
    if (stored) return stored;
  } catch (e) {}
  return DEFAULT_SERVER;
}

export function setServerUrl(url) {
  localStorage.setItem('ilnaz-server-url', url);
  window.location.reload();
}

export function getApiUrl() {
  return getServerUrl() + '/api';
}

export function getSocketUrl() {
  return getServerUrl();
}
