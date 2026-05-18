const DEFAULT_SERVER = 'https://ilnaz-launcher.abrdns.com';

export function getServerUrl() {
  // Use Vite-injected env var if present (for Railway frontend)
  if (typeof import.meta !== 'undefined' && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Same-origin detection: if served from Express (not Vite dev server)
  if (window.location.hostname !== 'localhost' || window.location.port !== '5173') {
    try {
      const stored = localStorage.getItem('ilnaz-server-url');
      if (stored && stored.trim()) {
        return stored.startsWith('http') ? stored : 'https://' + stored;
      }
    } catch (e) {}
    // Same origin — API is on the same host:port
    return window.location.origin;
  }
  try {
    const stored = localStorage.getItem('ilnaz-server-url');
    if (stored && stored.trim()) {
      return stored.startsWith('http') ? stored : 'https://' + stored;
    }
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
