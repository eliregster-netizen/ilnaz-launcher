const DEFAULT_SERVER = 'https://ilnaz-launcher.onrender.com';

export function getServerUrl() {
  // Use Vite-injected env var if present (for Railway frontend)
  if (typeof process !== 'undefined' && process.env.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
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
